/**
 * 문제 유형 분류 함수
 *
 * 수능형 표준 유형 체계 (4개 영역, 34개 유형)
 * 문제 텍스트(발문)에서 키워드 매칭 + 스코어링으로 유형을 분류합니다.
 */

// ── 유형 코드 정의 ──

export type QuestionTypeCode =
  // 문학 (9)
  | 'LIT_EXPRESSION' | 'LIT_CONTENT' | 'LIT_SPEAKER' | 'LIT_MEANING'
  | 'LIT_BOGI' | 'LIT_CHARACTER' | 'LIT_COMPARE' | 'LIT_FUNCTION' | 'LIT_CRITICISM'
  // 독서 (9)
  | 'READ_MATCH' | 'READ_DETAIL' | 'READ_STRUCTURE' | 'READ_INFER'
  | 'READ_APPLY' | 'READ_COMPARE' | 'READ_VOCAB' | 'READ_AUTHOR' | 'READ_LOGIC'
  // 문법 (7)
  | 'GRAM_PHONOL' | 'GRAM_MORPH' | 'GRAM_SYNTAX' | 'GRAM_EXPR'
  | 'GRAM_HISTORY' | 'GRAM_ORTHO' | 'GRAM_DISCOURSE'
  // 화작 (8)
  | 'HW_SPEAK_METHOD' | 'HW_SPEAK_CONTENT' | 'HW_LISTENER' | 'HW_PLAN'
  | 'HW_MATERIAL' | 'HW_REVISION' | 'HW_CONDITION' | 'HW_MEDIA'
  // 미분류
  | 'UNKNOWN';

export type Category = '문학' | '독서' | '문법' | '화작';

export interface QuestionTypeInfo {
  code: QuestionTypeCode;
  category: Category;
  nameKo: string;
  sortOrder: number;
}

export interface ClassifyResult {
  code: QuestionTypeCode;
  category: Category;
  nameKo: string;
  confidence: number;  // 0~1
}

// ── 키워드 규칙 정의 ──

interface TypeRule {
  code: QuestionTypeCode;
  nameKo: string;
  keywords: string[];
  weight: number;       // 기본 가중치
  priority: number;     // 높을수록 우선 (겹치는 키워드 처리)
}

const LIT_RULES: TypeRule[] = [
  {
    code: 'LIT_BOGI', nameKo: '보기감상', priority: 90, weight: 3,
    keywords: ['보기를 참고', '보기를 바탕', '감상한 내용', '보기의 관점', '보기를 통해', '감상으로 적절', '감상한 것'],
  },
  {
    code: 'LIT_COMPARE', nameKo: '작품비교', priority: 80, weight: 3,
    keywords: ['(가)와 (나)', '(가)와(나)', '공통점', '차이점', '비교하여', '비교한 것', '(가), (나)',
               '(가)에 대한', '(나)에 대한', '(가)를', '(나)를', '(가)의', '(나)의'],
  },
  {
    code: 'LIT_EXPRESSION', nameKo: '표현/서술특징', priority: 70, weight: 2,
    keywords: ['표현상의 특징', '서술 방식', '표현 방법', '전개 방식', '서술상의 특징', '표현의 특징',
               '표현방식', '서술상 특징', '표현 특징', '표현에 대한', '표현으로'],
  },
  {
    code: 'LIT_SPEAKER', nameKo: '화자의태도', priority: 60, weight: 2,
    keywords: ['화자', '정서', '말하는 이', '시적 화자', '화자의 태도', '화자의 정서', '어조'],
  },
  {
    code: 'LIT_MEANING', nameKo: '시어/구절의미', priority: 55, weight: 2,
    keywords: ['시어', '구절', '밑줄 친', '함축적', '상징', '이미지', '의미하는', '함축', '밑줄',
               '의미를 이해', '의미로 적절'],
  },
  {
    code: 'LIT_CHARACTER', nameKo: '인물파악', priority: 50, weight: 2,
    keywords: ['인물', '심리', '성격', '행동', '인물에 대한', '등장인물'],
  },
  {
    code: 'LIT_FUNCTION', nameKo: '소재/배경기능', priority: 45, weight: 2,
    keywords: ['소재', '배경', '공간', '기능', '역할', '시간적 배경', '공간적 배경'],
  },
  {
    code: 'LIT_CRITICISM', nameKo: '외적준거감상', priority: 40, weight: 2,
    keywords: ['관점', '비평', '해석', '외적 준거', '비평적'],
  },
  {
    code: 'LIT_CONTENT', nameKo: '내용이해', priority: 10, weight: 1,
    keywords: ['내용에 대한 이해', '내용으로 적절', '대한 설명으로', '이해한 내용', '적절하지 않은',
               '적절한 것', '이해로 적절', '옳은 것', '옳지 않은', '설명으로 가장', '대한 설명',
               '이해한 것으로', '않은 것은', '적절하지 않은 것은', '설명으로 적절'],
  },
];

const READ_RULES: TypeRule[] = [
  {
    code: 'READ_VOCAB', nameKo: '어휘', priority: 90, weight: 3,
    keywords: ['어휘', '문맥', '바꾸어 쓸', '사전적 의미', '문맥적 의미', '밑줄 친', '의미가 가장'],
  },
  {
    code: 'READ_APPLY', nameKo: '적용', priority: 80, weight: 3,
    keywords: ['적용', '사례', '보기를', '보기에', '보기의'],
  },
  {
    code: 'READ_STRUCTURE', nameKo: '전개방식', priority: 70, weight: 2,
    keywords: ['전개 방식', '설명 방식', '글의 구조', '서술 방식', '논지 전개'],
  },
  {
    code: 'READ_INFER', nameKo: '추론', priority: 65, weight: 2,
    keywords: ['추론', '미루어', '짐작', '유추', '예측할 수'],
  },
  {
    code: 'READ_COMPARE', nameKo: '비교대조', priority: 60, weight: 2,
    keywords: ['비교', '대조', '차이', '관점', '(가)와 (나)', '(가)와(나)'],
  },
  {
    code: 'READ_AUTHOR', nameKo: '필자관점', priority: 55, weight: 2,
    keywords: ['필자', '글쓴이', '주장', '견해', '입장'],
  },
  {
    code: 'READ_LOGIC', nameKo: '논리추론', priority: 50, weight: 2,
    keywords: ['논증', '전제', '결론', '귀납', '연역', '논리'],
  },
  {
    code: 'READ_MATCH', nameKo: '내용일치', priority: 20, weight: 1.5,
    keywords: ['내용과 일치', '일치하는', '일치하지 않는'],
  },
  {
    code: 'READ_DETAIL', nameKo: '세부정보', priority: 10, weight: 1,
    keywords: ['알 수 있는', '언급된', '세부'],
  },
];

const GRAM_RULES: TypeRule[] = [
  {
    code: 'GRAM_PHONOL', nameKo: '음운', priority: 90, weight: 3,
    keywords: ['음운', '발음', '비음화', '구개음화', '경음화', '유음화', '음절', '자음', '모음', '음운 변동',
               '변동이 일어', '소리가 나는', '음절의 끝소리'],
  },
  {
    code: 'GRAM_MORPH', nameKo: '형태소/단어', priority: 80, weight: 2,
    keywords: ['형태소', '품사', '파생어', '합성어', '접사', '어근', '단어 형성', '접미사', '접두사',
               '단어의 구조', '용언', '체언', '관형사', '부사', '조사', '어미'],
  },
  {
    code: 'GRAM_SYNTAX', nameKo: '문장구조', priority: 70, weight: 2,
    keywords: ['문장 성분', '주어', '서술어', '안은문장', '안긴문장', '이어진문장', '문장의 구조',
               '홑문장', '겹문장', '목적어', '이어진 문장', '자연스러운 문장', '문장의 유형',
               '안은 문장', '안긴 문장', '문장을 분석', '필수 성분'],
  },
  {
    code: 'GRAM_EXPR', nameKo: '문장표현', priority: 60, weight: 2,
    keywords: ['높임', '피동', '사동', '시제', '인용', '높임법', '피동 표현', '사동 표현', '시간 표현',
               '선어말 어미', '종결 어미', '연결 어미', '관형사형 어미'],
  },
  {
    code: 'GRAM_HISTORY', nameKo: '국어사', priority: 85, weight: 3,
    keywords: ['중세국어', '훈민정음', '옛말', '언해', '중세 국어', '근대 국어', '고대 국어',
               '현대어로', '현대어 풀이', '현대국어', '15세기', '원문', '풀이',
               '세종어제', '용비어천가', '두시언해', '월인천강지곡', 'ᄒᆞ', 'ᅀᆞ',
               '옛 글', '문헌을'],
  },
  {
    code: 'GRAM_ORTHO', nameKo: '맞춤법/표기', priority: 55, weight: 2,
    keywords: ['맞춤법', '띄어쓰기', '사이시옷', '외래어', '표기법', '표준어', '로마자',
               '표기가 올바', '올바르지 않은', '올바른 것', '바르게 표기', '표기를'],
  },
  {
    code: 'GRAM_DISCOURSE', nameKo: '담화', priority: 50, weight: 2,
    keywords: ['담화', '맥락', '발화', '대화', '의사소통'],
  },
];

const HW_RULES: TypeRule[] = [
  {
    code: 'HW_SPEAK_METHOD', nameKo: '말하기방식', priority: 80, weight: 2,
    keywords: ['말하기 방식', '말하기 전략', '의사소통 전략', '대화 전략'],
  },
  {
    code: 'HW_SPEAK_CONTENT', nameKo: '화법내용이해', priority: 70, weight: 2,
    keywords: ['발표 내용', '토론 내용', '강연 내용', '토의 내용', '발표에서', '토론에서'],
  },
  {
    code: 'HW_LISTENER', nameKo: '청자반응', priority: 65, weight: 2,
    keywords: ['청중', '청자', '반응', '메모', '듣기 활동'],
  },
  {
    code: 'HW_PLAN', nameKo: '글쓰기계획', priority: 60, weight: 2,
    keywords: ['글쓰기 계획', '개요', '초고', '작문 계획', '계획서'],
  },
  {
    code: 'HW_MATERIAL', nameKo: '자료활용', priority: 55, weight: 2,
    keywords: ['자료 활용', '자료를 활용', '통계', '도표', '그래프'],
  },
  {
    code: 'HW_REVISION', nameKo: '고쳐쓰기', priority: 50, weight: 2,
    keywords: ['고쳐쓰기', '수정', '퇴고', '고쳐 쓰기', '고친'],
  },
  {
    code: 'HW_CONDITION', nameKo: '조건표현', priority: 45, weight: 2,
    keywords: ['조건에 맞', '조건을 모두', '조건에 따라'],
  },
  {
    code: 'HW_MEDIA', nameKo: '매체', priority: 85, weight: 3,
    keywords: ['매체', '인터넷', '블로그', 'SNS', '뉴스', '미디어'],
  },
];

// ── 전체 유형 정보 맵 ──

export const QUESTION_TYPE_MAP: Map<QuestionTypeCode, QuestionTypeInfo> = new Map();

function registerTypes(category: Category, rules: TypeRule[]) {
  rules.forEach((r, idx) => {
    QUESTION_TYPE_MAP.set(r.code, {
      code: r.code,
      category,
      nameKo: r.nameKo,
      sortOrder: idx,
    });
  });
}

registerTypes('문학', LIT_RULES);
registerTypes('독서', READ_RULES);
registerTypes('문법', GRAM_RULES);
registerTypes('화작', HW_RULES);

// ── 분류 함수 ──

function scoreText(text: string, rules: TypeRule[]): ClassifyResult | null {
  const scores: { rule: TypeRule; score: number; matchCount: number }[] = [];

  for (const rule of rules) {
    let matchCount = 0;
    for (const keyword of rule.keywords) {
      if (text.includes(keyword)) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      const score = matchCount * rule.weight + rule.priority / 100;
      scores.push({ rule, score, matchCount });
    }
  }

  if (scores.length === 0) return null;

  // 점수순 정렬, 동점이면 priority가 높은 것 우선
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.rule.priority - a.rule.priority;
  });

  const best = scores[0];
  const info = QUESTION_TYPE_MAP.get(best.rule.code)!;

  // confidence: 매칭된 키워드 비율 + 2위와의 점수 차이
  const maxKeywords = best.rule.keywords.length;
  const keywordRatio = best.matchCount / maxKeywords;
  const secondScore = scores.length > 1 ? scores[1].score : 0;
  const gap = best.score > 0 ? (best.score - secondScore) / best.score : 0;
  const confidence = Math.min(1, keywordRatio * 0.6 + gap * 0.4);

  return {
    code: best.rule.code,
    category: info.category,
    nameKo: best.rule.nameKo,
    confidence: Math.round(confidence * 100) / 100,
  };
}

/**
 * 문제 텍스트(발문)에서 유형을 분류합니다.
 *
 * @param questionText  문제 발문 텍스트
 * @param category      이미 알려진 영역 (문학/독서/문법/화작). 없으면 전 영역 스캔.
 */
export function classifyQuestionType(
  questionText: string,
  category?: Category | string
): ClassifyResult {
  const text = questionText.replace(/\s+/g, ' ').trim();

  // 영역이 지정된 경우 해당 영역만 스캔
  if (category) {
    const rulesMap: Record<string, TypeRule[]> = {
      '문학': LIT_RULES,
      '독서': READ_RULES,
      '문법': GRAM_RULES,
      '화작': HW_RULES,
    };
    const rules = rulesMap[category];
    if (rules) {
      const result = scoreText(text, rules);
      if (result) return result;
    }
  }

  // 영역 미지정이거나 지정 영역에서 매칭 실패 → 전체 스캔
  const allRuleSets: { category: Category; rules: TypeRule[] }[] = [
    { category: '문학', rules: LIT_RULES },
    { category: '독서', rules: READ_RULES },
    { category: '문법', rules: GRAM_RULES },
    { category: '화작', rules: HW_RULES },
  ];

  let bestResult: ClassifyResult | null = null;
  let bestScore = -1;

  for (const { rules } of allRuleSets) {
    for (const rule of rules) {
      let matchCount = 0;
      for (const keyword of rule.keywords) {
        if (text.includes(keyword)) {
          matchCount++;
        }
      }
      if (matchCount > 0) {
        const score = matchCount * rule.weight + rule.priority / 100;
        if (score > bestScore) {
          bestScore = score;
          const info = QUESTION_TYPE_MAP.get(rule.code)!;
          bestResult = {
            code: rule.code,
            category: info.category,
            nameKo: rule.nameKo,
            confidence: 0, // 나중에 재계산
          };
        }
      }
    }
  }

  if (bestResult) {
    // 간단 confidence
    bestResult.confidence = Math.min(1, Math.round((bestScore / 10) * 100) / 100);
    return bestResult;
  }

  // 최후 폴백: 소스 영역 기반 일반 패턴 매칭
  const fallback = fallbackClassify(text, category);
  if (fallback) return fallback;

  return { code: 'UNKNOWN', category: (category as Category) || '문학', nameKo: '미분류', confidence: 0 };
}

/**
 * 키워드 매칭 실패 시 소스 영역 + 일반 패턴으로 폴백 분류
 */
function fallbackClassify(text: string, category?: Category | string): ClassifyResult | null {
  // 문법 소스: 발문 내 힌트로 세부 분류 시도
  if (category === '문법') {
    // 중세국어 특수문자 감지 (아래아, 반치음 등)
    if (/[ᄀ-ᇿꥠ-ꥼ]/.test(text) || /원문.*풀이|풀이.*원문/.test(text) || /문헌/.test(text)) {
      return { code: 'GRAM_HISTORY', category: '문법', nameKo: '국어사', confidence: 0.3 };
    }
    // 표기 관련
    if (/올바르|바르게|바른 것/.test(text)) {
      return { code: 'GRAM_ORTHO', category: '문법', nameKo: '맞춤법/표기', confidence: 0.2 };
    }
    // "탐구한 내용", "분석한" 등 일반 문법 탐구
    if (/탐구|분석한|분류한|짝지은|연결한|묶은|골라/.test(text)) {
      return { code: 'GRAM_MORPH', category: '문법', nameKo: '형태소/단어', confidence: 0.15 };
    }
    // 문장 관련
    if (/문장/.test(text)) {
      return { code: 'GRAM_SYNTAX', category: '문법', nameKo: '문장구조', confidence: 0.2 };
    }
    // 단어 관련
    if (/단어|기본형|활용/.test(text)) {
      return { code: 'GRAM_MORPH', category: '문법', nameKo: '형태소/단어', confidence: 0.2 };
    }
    // 변화, 변동 → 음운
    if (/변화|변동/.test(text)) {
      return { code: 'GRAM_PHONOL', category: '문법', nameKo: '음운', confidence: 0.2 };
    }
    // 서술형
    if (/서술하시오|쓰시오|쓰세요|직역/.test(text)) {
      return { code: 'GRAM_HISTORY', category: '문법', nameKo: '국어사', confidence: 0.15 };
    }
    // 최후: 문법 소스인데 아무것도 안 걸리면 → 형태소/단어 (가장 일반적)
    if (/것은|고른 것|보기/.test(text)) {
      return { code: 'GRAM_MORPH', category: '문법', nameKo: '형태소/단어', confidence: 0.1 };
    }
  }

  // 문학 소스: 일반 패턴
  if (category === '문학') {
    if (/감상/.test(text)) {
      return { code: 'LIT_BOGI', category: '문학', nameKo: '보기감상', confidence: 0.2 };
    }
    if (/\(가\)|\(나\)/.test(text)) {
      return { code: 'LIT_COMPARE', category: '문학', nameKo: '작품비교', confidence: 0.2 };
    }
    if (/의미/.test(text)) {
      return { code: 'LIT_MEANING', category: '문학', nameKo: '시어/구절의미', confidence: 0.2 };
    }
    if (/표현/.test(text)) {
      return { code: 'LIT_EXPRESSION', category: '문학', nameKo: '표현/서술특징', confidence: 0.2 };
    }
    // 최후: 내용이해
    if (/것은|설명|이해/.test(text)) {
      return { code: 'LIT_CONTENT', category: '문학', nameKo: '내용이해', confidence: 0.1 };
    }
  }

  return null;
}

/**
 * question_type_ref 테이블에 넣을 전체 유형 목록을 반환합니다.
 */
export function getAllQuestionTypes(): QuestionTypeInfo[] {
  return Array.from(QUESTION_TYPE_MAP.values());
}
