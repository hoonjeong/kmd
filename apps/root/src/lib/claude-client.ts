import Anthropic from '@anthropic-ai/sdk';

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
**유형**: LIT_EXPRESSION (표현/서술특징)
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
**유형**: GRAM_MORPH (형태소/단어)
**해설**: 해설 내용

---

## 유형 코드 참조

각 문제의 **유형** 태그에는 아래 코드 중 하나를 사용하세요:

- 문학: LIT_EXPRESSION(표현/서술특징), LIT_CONTENT(내용이해), LIT_SPEAKER(화자의태도), LIT_MEANING(시어/구절의미), LIT_BOGI(보기감상), LIT_CHARACTER(인물파악), LIT_COMPARE(작품비교), LIT_FUNCTION(소재/배경기능), LIT_CRITICISM(외적준거감상)
- 독서: READ_MATCH(내용일치), READ_DETAIL(세부정보), READ_STRUCTURE(전개방식), READ_INFER(추론), READ_APPLY(적용), READ_COMPARE(비교대조), READ_VOCAB(어휘), READ_AUTHOR(필자관점), READ_LOGIC(논리추론)
- 문법: GRAM_PHONOL(음운), GRAM_MORPH(형태소/단어), GRAM_SYNTAX(문장구조), GRAM_EXPR(문장표현), GRAM_HISTORY(국어사), GRAM_ORTHO(맞춤법/표기), GRAM_DISCOURSE(담화)
- 화작: HW_SPEAK_METHOD(말하기방식), HW_SPEAK_CONTENT(화법내용이해), HW_LISTENER(청자반응), HW_PLAN(글쓰기계획), HW_MATERIAL(자료활용), HW_REVISION(고쳐쓰기), HW_CONDITION(조건표현), HW_MEDIA(매체)

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
**유형**: LIT_EXPRESSION (표현/서술특징)
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
**유형**: LIT_BOGI (보기감상)
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
**유형**: GRAM_MORPH (형태소/단어)
**해설**: 해설 내용

---

## 유형 코드 참조

각 문제의 **유형** 태그에는 문제 유형에 맞는 코드를 사용하세요:
- 문학: LIT_EXPRESSION(표현/서술특징), LIT_CONTENT(내용이해), LIT_SPEAKER(화자의태도), LIT_MEANING(시어/구절의미), LIT_BOGI(보기감상), LIT_CHARACTER(인물파악), LIT_COMPARE(작품비교), LIT_FUNCTION(소재/배경기능), LIT_CRITICISM(외적준거감상)
- 독서: READ_MATCH(내용일치), READ_DETAIL(세부정보), READ_STRUCTURE(전개방식), READ_INFER(추론), READ_APPLY(적용), READ_COMPARE(비교대조), READ_VOCAB(어휘), READ_AUTHOR(필자관점), READ_LOGIC(논리추론)
- 문법: GRAM_PHONOL(음운), GRAM_MORPH(형태소/단어), GRAM_SYNTAX(문장구조), GRAM_EXPR(문장표현), GRAM_HISTORY(국어사), GRAM_ORTHO(맞춤법/표기), GRAM_DISCOURSE(담화)
- 화작: HW_SPEAK_METHOD(말하기방식), HW_SPEAK_CONTENT(화법내용이해), HW_LISTENER(청자반응), HW_PLAN(글쓰기계획), HW_MATERIAL(자료활용), HW_REVISION(고쳐쓰기), HW_CONDITION(조건표현), HW_MEDIA(매체)

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

// ── 문학 전용 프롬프트 (HWP 추출 텍스트 기반) ──
export interface LiteraturePromptOptions {
  title?: string;
  author?: string;
  grade?: string;
  publisher?: string;
  difficulty: string;
  count: number;
  userNotes?: string;
}

export function buildLiteratureQuestionPrompt(
  contentTexts: string[],
  options: LiteraturePromptOptions
): string {
  const { title, author, grade, publisher, difficulty, count, userNotes } = options;

  const referenceSections = contentTexts.map((text, idx) => {
    return `### 참고 자료 ${idx + 1}\n\n${text}`;
  }).join('\n\n');

  const userNotesLine = userNotes ? `- 추가 요청: ${userNotes}\n` : '';
  const titleLine = title ? `- 작품명: ${title}\n` : '';
  const authorLine = author ? `- 작가명: ${author}\n` : '';
  const gradeLine = grade ? `- 학년: ${grade}\n` : '';
  const publisherLine = publisher ? `- 출판사: ${publisher}\n` : '';

  return `당신은 대한민국 고등학교 국어 시험 출제 전문가입니다.
아래 참고 자료는 교과서/시험지에서 추출한 문학 관련 텍스트입니다.
이 텍스트의 내용과 출제 패턴을 참고하여
유사하지만 새로운 변형 문제를 생성해주세요.

## 생성 조건
- 영역: 문학
- 난이도: ${difficulty} (${EXAM_DIFFICULTY_GUIDE[difficulty] || '기출 수준'})
- 생성할 문항 수: ${count}개
${titleLine}${authorLine}${gradeLine}${publisherLine}${userNotesLine}
## 참고 자료

${referenceSections}

## 작품 원문 보존 원칙 (필수)
- 검색된 지문에 나오는 작품(시, 소설, 수필 등)의 내용을 절대 변경하지 마세요.
- 작품은 참고 문항의 본문 그대로 사용하고, 문제만 변경하세요.
- 새로운 작품을 창작하거나 기존 작품을 수정·각색하지 마세요.
- 절대로 원문 그대로만 사용해야 합니다. 문제와 선택지, 해설만 변형하세요.

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
