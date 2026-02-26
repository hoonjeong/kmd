/**
 * HWP 추출 텍스트 및 AI 생성 텍스트에서 개별 문제를 파싱합니다.
 */

import { classifyQuestionType, type ClassifyResult, type Category } from './classify-question-type';

export interface ParsedQuestion {
  questionNumber: number;
  questionText: string;       // 발문 (선택지 제외)
  choices: string[];           // ["선택지1", "선택지2", ...]
  answer: string | null;       // "①" 등 또는 null
  explanation: string | null;  // 해설
  questionType: ClassifyResult;
}

// 원문자 ①~⑤
const CIRCLED_NUMBERS = ['①', '②', '③', '④', '⑤'];
const CIRCLED_PATTERN = /^[①②③④⑤]\s*/;

/**
 * AI 생성 텍스트 (마크다운 형식)에서 문제를 파싱합니다.
 * claude-client.ts의 출력 형식(### [번호]. 형식)에 맞춰 파싱합니다.
 */
export function parseGeneratedQuestions(text: string, category?: Category | string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];

  // ### [번호]. 패턴으로 문제 시작 지점 분리
  // 예: ### 1. / ### [1]. / ### [1~3]은 범위 안내문이므로 제외
  const questionPattern = /^###\s*\[?(\d+)\]?\.\s*(.+)/gm;
  const matches: { index: number; number: number; firstLine: string }[] = [];

  let match: RegExpExecArray | null;
  while ((match = questionPattern.exec(text)) !== null) {
    matches.push({
      index: match.index,
      number: parseInt(match[1], 10),
      firstLine: match[2].trim(),
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const block = text.substring(start, end).trim();

    const parsed = parseQuestionBlock(block, matches[i].number, matches[i].firstLine, category);
    if (parsed) {
      questions.push(parsed);
    }
  }

  return questions;
}

/**
 * HWP 추출 텍스트에서 문제를 파싱합니다.
 *
 * HWP 텍스트는 번호 없이 다음 구조를 가짐:
 *   (발문 텍스트)...?
 *   ① 선택지1
 *   ...
 *   [출판사]학교시험 ④    ← 정답 라인 (문제 경계)
 *
 * 정답 라인으로 문제를 구분합니다.
 */
export function parseHwpQuestions(text: string, category?: Category | string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  const lines = text.split('\n');

  // 정답 라인 패턴: [출판사]시험정보 ①~⑤ (쉼표 구분 복수 정답 포함)
  const answerLinePattern = /\[.+\].+\s+([①②③④⑤](?:\s*,\s*[①②③④⑤])*)$/;

  // 1단계: 정답 라인의 인덱스를 모두 찾기
  const answerLineIndices: { lineIndex: number; answer: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const m = trimmed.match(answerLinePattern);
    if (m) {
      answerLineIndices.push({ lineIndex: i, answer: m[1].trim() });
    }
  }

  if (answerLineIndices.length === 0) return questions;

  // 2단계: 각 정답 라인에서 위로 올라가며 해당 문제 블록 추출
  for (let qi = 0; qi < answerLineIndices.length; qi++) {
    const { lineIndex: answerIdx, answer } = answerLineIndices[qi];

    // 이전 정답 라인 다음부터 ~ 현재 정답 라인까지가 문제 블록
    const prevEnd = qi > 0 ? answerLineIndices[qi - 1].lineIndex + 1 : 0;
    const blockLines = lines.slice(prevEnd, answerIdx); // 정답 라인 제외

    // 블록에서 선택지, 발문 분리
    const choices: string[] = [];
    const questionLines: string[] = [];
    let firstChoiceIdx = -1;

    for (let j = 0; j < blockLines.length; j++) {
      const line = blockLines[j].trim();
      if (!line) continue;
      if (CIRCLED_PATTERN.test(line)) {
        if (firstChoiceIdx < 0) firstChoiceIdx = j;
        choices.push(line.replace(CIRCLED_PATTERN, '').trim());
      }
    }

    // 발문: 선택지 시작 전의 텍스트에서 물음표로 끝나는 줄을 찾아 위로 수집
    // 발문은 '~것은?', '~않은 것은?' 등으로 끝남
    const textBeforeChoices = firstChoiceIdx >= 0
      ? blockLines.slice(0, firstChoiceIdx)
      : blockLines;

    // 물음표(?)로 끝나는 마지막 줄 찾기
    let questionEndIdx = -1;
    for (let j = textBeforeChoices.length - 1; j >= 0; j--) {
      const trimmed = textBeforeChoices[j].trim();
      if (trimmed.endsWith('?') || trimmed.endsWith('것은') || trimmed.endsWith('않은')) {
        questionEndIdx = j;
        break;
      }
    }

    if (questionEndIdx < 0) {
      // 물음표가 없으면 선택지 바로 위 비어있지 않은 줄부터
      for (let j = textBeforeChoices.length - 1; j >= 0; j--) {
        if (textBeforeChoices[j].trim()) {
          questionEndIdx = j;
          break;
        }
      }
    }

    if (questionEndIdx >= 0) {
      // 발문 줄 수집 (questionEndIdx 줄 포함, 위로 올라가며 보기/지문이 아닌 발문 줄 수집)
      // 간단히: questionEndIdx 줄 하나만 발문으로 사용 (복수 줄 발문도 연결)
      // 발문 시작: 이전 보기/지문 태그 또는 빈 줄 다음
      let questionStartIdx = questionEndIdx;
      for (let j = questionEndIdx - 1; j >= 0; j--) {
        const trimmed = textBeforeChoices[j].trim();
        // 보기/지문 종료 태그 또는 빈 줄이면 여기서 멈춤
        if (!trimmed || trimmed === '[/보기]' || trimmed === '[/지문]' ||
            trimmed.startsWith('- ') || trimmed.match(/^[가-힣]+,\s*[「」『』]/)) {
          break;
        }
        questionStartIdx = j;
      }

      for (let j = questionStartIdx; j <= questionEndIdx; j++) {
        const trimmed = textBeforeChoices[j].trim();
        if (trimmed) questionLines.push(trimmed);
      }
    }

    const questionText = questionLines.join(' ').replace(/\s+/g, ' ').trim();
    if (!questionText && choices.length === 0) continue;

    const questionType = classifyQuestionType(questionText || '(발문 없음)', category);

    questions.push({
      questionNumber: qi + 1,
      questionText: questionText || '(발문 파싱 실패)',
      choices,
      answer,
      explanation: null,
      questionType,
    });
  }

  return questions;
}

// ── 내부 파싱 헬퍼 ──

function parseQuestionBlock(
  block: string,
  questionNumber: number,
  firstLine: string,
  category?: Category | string
): ParsedQuestion | null {
  const lines = block.split('\n');

  // 발문 수집 (선택지/정답/해설 전까지)
  const questionLines: string[] = [firstLine];
  const choices: string[] = [];
  let answer: string | null = null;
  let explanation: string | null = null;

  let phase: 'question' | 'choices' | 'answer' | 'explanation' = 'question';

  for (let j = 1; j < lines.length; j++) {
    const line = lines[j].trim();
    if (!line) continue;

    // 정답 라인
    if (line.startsWith('**정답**:') || line.startsWith('**정답**：')) {
      const answerText = line.replace(/\*\*정답\*\*[:：]\s*/, '').trim();
      answer = answerText;
      phase = 'answer';
      continue;
    }

    // 해설 라인
    if (line.startsWith('**해설**:') || line.startsWith('**해설**：')) {
      explanation = line.replace(/\*\*해설\*\*[:：]\s*/, '').trim();
      phase = 'explanation';
      continue;
    }

    // 유형 라인 (5단계에서 추가될 태그) - 스킵
    if (line.startsWith('**유형**:') || line.startsWith('**유형**：')) {
      continue;
    }

    // 선택지
    if (CIRCLED_PATTERN.test(line)) {
      const choiceText = line.replace(CIRCLED_PATTERN, '').trim();
      choices.push(choiceText);
      phase = 'choices';
      continue;
    }

    // 해설 계속
    if (phase === 'explanation' && explanation !== null) {
      explanation += ' ' + line;
      continue;
    }

    // 다음 문제의 ### 시작이면 중단
    if (line.startsWith('### ')) break;
    if (line === '---') continue;

    // [보기], [지문] 태그는 발문에 포함
    if (phase === 'question') {
      questionLines.push(line);
    }
  }

  const questionText = questionLines.join(' ').replace(/\s+/g, ' ').trim();
  if (!questionText) return null;

  const questionType = classifyQuestionType(questionText, category);

  return {
    questionNumber,
    questionText,
    choices,
    answer,
    explanation,
    questionType,
  };
}

