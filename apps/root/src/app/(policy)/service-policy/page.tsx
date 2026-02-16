import Link from 'next/link';

export default function ServicePolicyPage() {
  return (
    <div>
      <Link href="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 14 }}>
        &larr; 홈으로 돌아가기
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', margin: '24px 0 8px' }}>서비스 이용 정책</h1>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 32 }}>최종 수정일: 2026년 2월 16일</p>

      <div style={{ color: '#334155', fontSize: 14, lineHeight: 1.8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>1. 서비스 개요</h2>
        <p>&quot;국문당&quot;은 고등국어 교사를 위한 기출문제 검색 및 AI 변형문제 제작 서비스입니다. 전국 고등학교 국어 기출문제를 데이터베이스로 구축하여, 교사가 효율적으로 시험 문제를 검색하고 변형문제를 생성할 수 있도록 지원합니다.</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>2. 이용 대상</h2>
        <p>본 서비스는 고등국어 교육에 종사하는 교사 및 교육 관계자를 주요 대상으로 합니다. 회원가입 시 전화번호 인증을 통해 실명 확인 절차를 거칩니다.</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>3. 콘텐츠 이용 범위</h2>
        <ul>
          <li><strong>기출문제:</strong> 교육 목적의 비상업적 이용에 한해 검색 및 열람이 가능합니다.</li>
          <li><strong>AI 생성 문제:</strong> 생성된 변형문제는 교육 활동(수업, 시험, 과제 등)에 자유롭게 활용 가능합니다.</li>
          <li><strong>금지 행위:</strong> 서비스를 통해 제공받은 콘텐츠를 상업적으로 판매, 유료 배포하거나 타 플랫폼에 무단 게시하는 행위는 금지됩니다.</li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>4. AI 문제 생성 관련</h2>
        <p>1. AI가 생성한 문제는 참고 자료로 활용하시되, 교사의 검수를 거쳐 사용하시기를 권장합니다.</p>
        <p>2. AI 생성 결과의 정확성을 100% 보장하지 않으며, 최종 활용에 대한 책임은 이용자에게 있습니다.</p>
        <p>3. 서비스 품질 향상을 위해 생성 이력이 익명화되어 분석에 활용될 수 있습니다.</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>5. 이용 제한</h2>
        <p>다음의 경우 사전 통보 없이 서비스 이용이 제한될 수 있습니다.</p>
        <ul>
          <li>허위 정보로 가입한 경우</li>
          <li>서비스를 이용한 상업적 콘텐츠 판매 행위</li>
          <li>비정상적인 대량 요청(크롤링, 자동화 도구 사용 등)</li>
          <li>타 이용자의 정상적인 서비스 이용을 방해하는 행위</li>
          <li>기타 관련 법령에 위반되는 행위</li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>6. 서비스 변경 및 중단</h2>
        <p>회사는 서비스의 내용, 이용 방법, 이용 시간 등을 변경하거나 중단할 수 있으며, 이 경우 변경 사항을 사전에 공지합니다.</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>7. 문의</h2>
        <p>서비스 이용 관련 문의사항은 아래로 연락해 주시기 바랍니다.</p>
        <p>이메일: hoonjeong.eden@gmail.com</p>
      </div>
    </div>
  );
}
