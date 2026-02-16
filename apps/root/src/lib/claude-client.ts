import Anthropic from '@anthropic-ai/sdk';
import type { ExamQuestionWithChoices } from '@edenschool/common';
import type { PassageSet } from '@edenschool/common/queries/passage-question';
import type { LiteraturePassageSet } from '@edenschool/common/queries/literature';
import type { ReadingPassageSet } from '@edenschool/common/queries/reading';
import { CIRCLED_NUMBERS } from './constants';

let client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

const EXAM_DIFFICULTY_GUIDE: Record<string, string> = {
  '상': '심화 사고력을 요구하는 높은 난이도',
  '중': '수능/모의고사 기출 수준의 표준 난이도',
  '하': '기본 개념 이해를 확인하는 낮은 난이도',
};

const VARIANT_DIFFICULTY_GUIDE: Record<string, string> = {
  easier: '원본보다 약간 쉬운 수준으로, 기본 개념 이해를 확인하는 방향으로',
  same: '원본과 동일한 난이도로',
  harder: '원본보다 약간 어려운 수준으로, 심화 사고력을 요구하는 방향으로',
};

// ── 참고문항 포맷팅 헬퍼 ──
function formatReferenceQuestions(questions: ExamQuestionWithChoices[], max = 3): string {
  let section = '';
  for (const q of questions.slice(0, max)) {
    section += `- 유형: ${q.questionPattern || q.category || ''}\n`;
    section += `- 문제: ${q.questionText}\n`;
    if (q.choices && q.choices.length > 0) {
      section += q.choices
        .map(c => `  ${CIRCLED_NUMBERS[c.choiceNumber - 1] || c.choiceNumber} ${c.choiceText}`)
        .join('\n') + '\n';
    }
    if (q.answer) section += `- 정답: ${q.answer}\n`;
    if (q.explanation) section += `- 해설: ${q.explanation}\n`;
    section += '\n';
  }
  return section;
}

// ── 공통 출력 형식 ──
const COMMON_OUTPUT_FORMAT = `## 출력 형식

반드시 아래 형식과 태그를 정확히 지켜서 작성하세요:

### 형식 A: 지문이 있는 문제 (여러 문제가 하나의 지문을 공유)

---
### [시작번호~끝번호] 다음을 읽고 물음에 답하시오.

[지문]
(지문 내용을 작성합니다.
여러 줄로 작성할 수 있습니다.)
[/지문]

### [번호]. (문제 질문 내용)

① 선택지1
② 선택지2
③ 선택지3
④ 선택지4
⑤ 선택지5

**정답**: ①
**해설**: 해설 내용

---

### 형식 B: 지문 없는 독립 문제

---
### [번호]. (문제 질문 내용)

[보기]
(보기가 필요한 경우에만 작성합니다.)
[/보기]

① 선택지1
② 선택지2
③ 선택지3
④ 선택지4
⑤ 선택지5

**정답**: ②
**해설**: 해설 내용

---

## 주의사항
- 참고 문항을 그대로 복사하지 말고 변형하세요
- 선택지는 매력적인 오답 포함, 정답은 명확하게
- 해설에서 정답 근거와 오답 이유를 설명하세요
- 수능/모의고사 출제 기준을 따르세요
- 보기는 항상 해당 문제의 질문 아래에 배치하세요
- 각 문제에는 반드시 문항 번호를 붙이세요
- 서술형 문제는 선택지 대신 "서술하시오." 형태로 작성하세요
- 보기가 없는 문제는 [보기] 태그를 사용하지 마세요`;

// ── 변형문제 프롬프트 ──
export interface VariantQuestionOptions {
  difficulty?: 'same' | 'easier' | 'harder';
  count?: number;
  userPrompt?: string;
}

export function buildVariantQuestionPrompt(
  text: string,
  options: VariantQuestionOptions = {}
): string {
  const { difficulty = 'same', count = 3, userPrompt } = options;

  const userInstruction = userPrompt
    ? `\n7. **추가 요청사항**: ${userPrompt}`
    : '';

  return `당신은 대한민국 중·고등학교 국어 시험 출제 전문가입니다.

아래는 학교 시험에 출제된 국어 시험지의 원본 텍스트입니다. 이 텍스트를 분석한 후, 변형 문제를 만들어 주세요.

## 지시사항

1. **원본 분석**: 원본 텍스트에서 출제된 문제의 유형, 지문, 선택지 구조를 파악하세요.
2. **변형문제 생성**: ${VARIANT_DIFFICULTY_GUIDE[difficulty]} 총 ${count}개의 변형문제를 생성하세요.
3. **형식 유지**: 원본의 출제 형식(객관식/서술형)을 유지하되, 선택지와 질문 내용을 변형하세요.
4. **정답 및 해설**: 각 변형문제에 대한 정답과 간략한 해설을 포함하세요.
5. **시험지 양식**: 아래 출력 형식의 태그를 반드시 지켜주세요. 지문이 있는 문제는 반드시 [지문]...[/지문] 태그를 사용하고, 보기가 있으면 [보기]...[/보기] 태그를 사용하세요.
6. **구조 규칙**:
   - 지문이 있는 경우: 지문 위에는 개별 문제가 아니라 **문제 범위 안내문**을 작성합니다. 예) "[1~3] 다음을 읽고 물음에 답하시오." 그 아래에 지문이 오고, 지문 이후에 개별 문제들이 번호와 함께 나옵니다.
   - 보기(참고 자료)는 **개별 문제 질문 아래**에 배치합니다. 즉, 문항 번호가 붙은 문제 질문이 먼저 나오고, 그 아래에 [보기] 태그가 옵니다.
   - 지문이 없는 독립 문제는 바로 문항 번호와 질문으로 시작합니다.${userInstruction}

## 출력 형식

반드시 아래 형식과 태그를 정확히 지켜서 작성하세요:

### 형식 A: 지문이 있는 문제 (여러 문제가 하나의 지문을 공유)

---
### [시작번호~끝번호] 다음을 읽고 물음에 답하시오.

[지문]
(지문 내용을 작성합니다.
여러 줄로 작성할 수 있습니다.)
[/지문]

### [번호]. (문제 질문 내용)

① 선택지1
② 선택지2
③ 선택지3
④ 선택지4
⑤ 선택지5

**정답**: ①
**해설**: 해설 내용

### [번호]. (문제 질문 내용)

[보기]
(이 문제에 보기가 필요한 경우 여기에 작성합니다.)
[/보기]

① 선택지1
② 선택지2
③ 선택지3
④ 선택지4
⑤ 선택지5

**정답**: ③
**해설**: 해설 내용

---

### 형식 B: 지문 없는 독립 문제

---
### [번호]. (문제 질문 내용)

[보기]
(보기가 필요한 경우에만 작성합니다.)
[/보기]

① 선택지1
② 선택지2
③ 선택지3
④ 선택지4
⑤ 선택지5

**정답**: ②
**해설**: 해설 내용

---

## 참고사항
- 하나의 지문에서 여러 문제를 출제할 경우, 반드시 "[시작~끝] 다음을 읽고 물음에 답하시오." 형식의 범위 안내문을 사용하세요.
- 보기는 항상 해당 문제의 질문 아래에 배치하세요. 지문 바로 아래에 보기를 넣지 마세요.
- 각 문제에는 반드시 문항 번호(1, 2, 3...)를 붙이세요.
- 지문이 없는 문제(문법, 어휘 등)는 [지문] 태그 없이 바로 문항 번호와 질문으로 시작하세요.
- 서술형 문제는 선택지 대신 "서술하시오." 형태로 작성하세요.
- 보기가 없는 문제는 [보기] 태그를 사용하지 마세요.

## 원본 텍스트

${text}`;
}

// ── 기출 기반 문제생성 프롬프트 ──
export interface ExamQuestionPromptOptions {
  categories?: string[];
  subCategories?: string[];
  questionPatterns?: string[];
  keyword?: string;
  difficulty: string;
  count: number;
  userNotes?: string;
}

export function buildExamQuestionPrompt(
  passageSets: PassageSet[],
  options: ExamQuestionPromptOptions
): string {
  const { categories, subCategories, questionPatterns, keyword, difficulty, count, userNotes } = options;

  const referenceSections = passageSets.map((set, idx) => {
    const p = set.passage;
    const catLabel = p ? `${p.category || ''}/${p.subCategory || ''}` : '';
    let section = `### 참고 ${idx + 1} [${catLabel}]\n`;

    if (p && p.content) {
      section += `[지문] ${p.content.substring(0, 2000)} [/지문]\n`;
      if (p.title) section += `- 제목: ${p.title}\n`;
      if (p.author) section += `- 작가: ${p.author}\n`;
    }

    section += formatReferenceQuestions(set.questions);
    return section;
  }).join('\n');

  const categoriesStr = categories?.length ? categories.join(', ') : '전체';
  const subCategoriesStr = subCategories?.length ? subCategories.join(', ') : '전체';
  const patternsStr = questionPatterns?.length ? questionPatterns.join(', ') : '전체';
  const userNotesLine = userNotes ? `- 추가 요청: ${userNotes}\n` : '';
  const keywordLine = keyword ? `- 키워드/작품명: ${keyword} (반드시 이 키워드와 관련된 지문·작품을 사용하여 문제를 생성하세요)\n` : '';

  return `당신은 대한민국 고등학교 국어 시험 출제 전문가입니다.
아래 참고 자료는 실제 기출문제 DB에서 추출한 문항입니다.
이 문항들의 출제 패턴, 지문 활용 방식, 선지 구성을 참고하여
유사하지만 새로운 변형 문제를 생성해주세요.

## 생성 조건
- 영역: ${categoriesStr} / 세부: ${subCategoriesStr}
- 문제 유형: ${patternsStr}
- 난이도: ${difficulty} (${EXAM_DIFFICULTY_GUIDE[difficulty] || '기출 수준'})
- 생성할 문항 수: ${count}개
${keywordLine}${userNotesLine}
## 참고 문항

${referenceSections}

## 출력 형식

반드시 아래 형식과 태그를 정확히 지켜서 작성하세요:

### 형식 A: 지문이 있는 문제 (여러 문제가 하나의 지문을 공유)

---
### [시작번호~끝번호] 다음을 읽고 물음에 답하시오.

[지문]
(지문 내용을 작성합니다.
여러 줄로 작성할 수 있습니다.)
[/지문]

### [번호]. (문제 질문 내용)

① 선택지1
② 선택지2
③ 선택지3
④ 선택지4
⑤ 선택지5

**정답**: ①
**해설**: 해설 내용

### [번호]. (문제 질문 내용)

[보기]
(이 문제에 보기가 필요한 경우 여기에 작성합니다.)
[/보기]

① 선택지1
② 선택지2
③ 선택지3
④ 선택지4
⑤ 선택지5

**정답**: ③
**해설**: 해설 내용

---

### 형식 B: 지문 없는 독립 문제

---
### [번호]. (문제 질문 내용)

[보기]
(보기가 필요한 경우에만 작성합니다.)
[/보기]

① 선택지1
② 선택지2
③ 선택지3
④ 선택지4
⑤ 선택지5

**정답**: ②
**해설**: 해설 내용

---

## 주의사항
- 참고 문항을 그대로 복사하지 말고 변형하세요
- 지문은 참고 문항의 지문을 변형하거나 새로 작성하세요
- 선택지는 매력적인 오답 포함, 정답은 명확하게
- 해설에서 정답 근거와 오답 이유를 설명하세요
- 수능/모의고사 출제 기준을 따르세요
- 하나의 지문에서 여러 문제를 출제할 경우, 반드시 "[시작~끝] 다음을 읽고 물음에 답하시오." 형식의 범위 안내문을 사용하세요
- 보기는 항상 해당 문제의 질문 아래에 배치하세요. 지문 바로 아래에 보기를 넣지 마세요
- 각 문제에는 반드시 문항 번호(1, 2, 3...)를 붙이세요
- 지문이 없는 문제(문법, 어휘 등)는 [지문] 태그 없이 바로 문항 번호와 질문으로 시작하세요
- 서술형 문제는 선택지 대신 "서술하시오." 형태로 작성하세요
- 보기가 없는 문제는 [보기] 태그를 사용하지 마세요`;
}

// ── 문학 전용 프롬프트 ──
export interface LiteraturePromptOptions {
  subCategories?: string[];
  questionPatterns?: string[];
  title?: string;
  author?: string;
  difficulty: string;
  count: number;
  userNotes?: string;
}

export function buildLiteratureQuestionPrompt(
  passageSets: LiteraturePassageSet[],
  options: LiteraturePromptOptions
): string {
  const { subCategories, questionPatterns, title, author, difficulty, count, userNotes } = options;

  const referenceSections = passageSets.map((set, idx) => {
    const p = set.passage;
    let section = `### 참고 ${idx + 1} [문학/${p.subCategory || ''}]\n`;
    if (p.content) section += `[지문] ${p.content.substring(0, 2000)} [/지문]\n`;
    if (p.title) section += `- 제목: ${p.title}\n`;
    if (p.author) section += `- 작가: ${p.author}\n`;
    section += formatReferenceQuestions(set.questions);
    return section;
  }).join('\n');

  const subCategoriesStr = subCategories?.length ? subCategories.join(', ') : '전체';
  const patternsStr = questionPatterns?.length ? questionPatterns.join(', ') : '전체';
  const userNotesLine = userNotes ? `- 추가 요청: ${userNotes}\n` : '';
  const titleLine = title ? `- 작품명: ${title}\n` : '';
  const authorLine = author ? `- 작가명: ${author}\n` : '';

  return `당신은 대한민국 고등학교 국어 시험 출제 전문가입니다.
아래 참고 자료는 실제 기출문제 DB에서 추출한 문학 문항입니다.
이 문항들의 출제 패턴, 지문 활용 방식, 선지 구성을 참고하여
유사하지만 새로운 변형 문제를 생성해주세요.

## 생성 조건
- 영역: 문학 / 세부: ${subCategoriesStr}
- 문제 유형: ${patternsStr}
- 난이도: ${difficulty} (${EXAM_DIFFICULTY_GUIDE[difficulty] || '기출 수준'})
- 생성할 문항 수: ${count}개
${titleLine}${authorLine}${userNotesLine}
## 참고 문항

${referenceSections}

${COMMON_OUTPUT_FORMAT}`;
}

// ── 독서 전용 프롬프트 ──
export interface ReadingPromptOptions {
  subCategories?: string[];
  questionPatterns?: string[];
  keyword?: string;
  difficulty: string;
  count: number;
  userNotes?: string;
}

export function buildReadingQuestionPrompt(
  passageSets: ReadingPassageSet[],
  options: ReadingPromptOptions
): string {
  const { subCategories, questionPatterns, keyword, difficulty, count, userNotes } = options;

  const referenceSections = passageSets.map((set, idx) => {
    const p = set.passage;
    let section = `### 참고 ${idx + 1} [독서/${p.subCategory || ''}]\n`;
    if (p.content) section += `[지문] ${p.content.substring(0, 2000)} [/지문]\n`;
    if (p.keywords) section += `- 키워드: ${p.keywords}\n`;
    section += formatReferenceQuestions(set.questions);
    return section;
  }).join('\n');

  const subCategoriesStr = subCategories?.length ? subCategories.join(', ') : '전체';
  const patternsStr = questionPatterns?.length ? questionPatterns.join(', ') : '전체';
  const userNotesLine = userNotes ? `- 추가 요청: ${userNotes}\n` : '';
  const keywordLine = keyword ? `- 키워드: ${keyword} (반드시 이 키워드와 관련된 지문을 사용하여 문제를 생성하세요)\n` : '';

  return `당신은 대한민국 고등학교 국어 시험 출제 전문가입니다.
아래 참고 자료는 실제 기출문제 DB에서 추출한 독서 문항입니다.
이 문항들의 출제 패턴, 지문 활용 방식, 선지 구성을 참고하여
유사하지만 새로운 변형 문제를 생성해주세요.

## 생성 조건
- 영역: 독서 / 세부: ${subCategoriesStr}
- 문제 유형: ${patternsStr}
- 난이도: ${difficulty} (${EXAM_DIFFICULTY_GUIDE[difficulty] || '기출 수준'})
- 생성할 문항 수: ${count}개
${keywordLine}${userNotesLine}
## 참고 문항

${referenceSections}

${COMMON_OUTPUT_FORMAT}`;
}

// ── 문법 전용 프롬프트 ──
export interface GrammarPromptOptions {
  difficulty: string;
  count: number;
  userNotes?: string;
}

export function buildGrammarQuestionPrompt(
  contentText: string,
  options: GrammarPromptOptions
): string {
  const { difficulty, count, userNotes } = options;
  const userNotesLine = userNotes ? `- 추가 요청: ${userNotes}\n` : '';

  return `당신은 대한민국 고등학교 국어 시험 출제 전문가입니다.
아래는 문법 영역의 기출문제 텍스트입니다.
이 텍스트의 문법 개념과 출제 패턴을 참고하여
유사하지만 새로운 변형 문제를 생성해주세요.

## 생성 조건
- 영역: 문법
- 난이도: ${difficulty} (${EXAM_DIFFICULTY_GUIDE[difficulty] || '기출 수준'})
- 생성할 문항 수: ${count}개
${userNotesLine}
## 참고 자료

${contentText}

${COMMON_OUTPUT_FORMAT}`;
}
