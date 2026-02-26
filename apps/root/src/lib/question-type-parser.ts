/**
 * AI 생성 텍스트에서 **유형** 태그를 파싱하여 JSON 배열로 변환합니다.
 */

export interface QuestionTypeEntry {
  number: number;
  type: string;    // 예: "LIT_EXPRESSION"
  name: string;    // 예: "표현/서술특징"
}

/**
 * AI 생성 텍스트에서 문제별 유형 정보를 추출합니다.
 *
 * 파싱 대상 패턴:
 *   ### [번호]. (문제 내용)
 *   ...
 *   **유형**: CODE (한국어명)
 *
 * @returns JSON-ready 배열. 유형 태그가 없으면 빈 배열 반환.
 */
export function parseQuestionTypes(generatedText: string): QuestionTypeEntry[] {
  const results: QuestionTypeEntry[] = [];

  // ### [번호]. 패턴으로 문제 번호 추출
  const questionPattern = /^###\s*\[?(\d+)\]?\.\s/gm;
  const typePattern = /\*\*유형\*\*[:：]\s*(\S+)\s*\(([^)]+)\)/g;

  // 문제 번호별 위치 맵핑
  const questions: { number: number; startIndex: number }[] = [];
  let qMatch: RegExpExecArray | null;
  while ((qMatch = questionPattern.exec(generatedText)) !== null) {
    questions.push({
      number: parseInt(qMatch[1], 10),
      startIndex: qMatch.index,
    });
  }

  // 유형 태그 위치별로 가장 가까운 앞쪽 문제 번호와 매칭
  let tMatch: RegExpExecArray | null;
  while ((tMatch = typePattern.exec(generatedText)) !== null) {
    const typeIndex = tMatch.index;
    const typeCode = tMatch[1];
    const typeName = tMatch[2];

    // 이 유형 태그 앞에 있는 가장 가까운 문제 번호 찾기
    let closestQuestion: number | null = null;
    for (let i = questions.length - 1; i >= 0; i--) {
      if (questions[i].startIndex < typeIndex) {
        closestQuestion = questions[i].number;
        break;
      }
    }

    if (closestQuestion !== null) {
      // 중복 방지: 같은 번호가 이미 있으면 스킵
      if (!results.some(r => r.number === closestQuestion)) {
        results.push({
          number: closestQuestion,
          type: typeCode,
          name: typeName,
        });
      }
    }
  }

  // 번호순 정렬
  results.sort((a, b) => a.number - b.number);
  return results;
}
