import Link from 'next/link';

export default function TermsPage() {
  return (
    <div>
      <Link href="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 14 }}>
        &larr; 홈으로 돌아가기
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', margin: '24px 0 8px' }}>이용약관</h1>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 32 }}>최종 수정일: 2026년 2월 16일</p>

      <div style={{ color: '#334155', fontSize: 14, lineHeight: 1.8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>제1조 (목적)</h2>
        <p>본 약관은 웬더키즈슬립(이하 &quot;회사&quot;)이 운영하는 &quot;국문당&quot; 서비스(이하 &quot;서비스&quot;)의 이용 조건 및 절차, 회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>제2조 (용어의 정의)</h2>
        <p>1. &quot;서비스&quot;란 회사가 제공하는 고등국어 기출문제 검색, 변형문제 제작, AI 문제 생성 등 온라인 교육 콘텐츠 제작 관련 일체의 서비스를 말합니다.</p>
        <p>2. &quot;이용자&quot;란 본 약관에 동의하고 서비스를 이용하는 자를 말합니다.</p>
        <p>3. &quot;회원&quot;이란 서비스에 가입하여 이용자 아이디를 부여받은 자를 말합니다.</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>제3조 (약관의 효력과 변경)</h2>
        <p>1. 본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</p>
        <p>2. 회사는 관련 법률을 위배하지 않는 범위에서 본 약관을 개정할 수 있습니다.</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>제4조 (서비스의 제공)</h2>
        <p>회사는 다음과 같은 서비스를 제공합니다.</p>
        <ul>
          <li>고등국어 기출문제 데이터베이스 검색</li>
          <li>AI 기반 변형문제 생성</li>
          <li>문제지 편집 및 다운로드</li>
          <li>기타 회사가 정하는 교육 콘텐츠 관련 서비스</li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>제5조 (회원가입)</h2>
        <p>1. 이용자는 회사가 정한 가입 절차에 따라 회원가입을 신청하며, 회사는 이를 승낙함으로써 회원가입이 완료됩니다.</p>
        <p>2. 회원가입 시 전화번호 인증이 필수이며, 허위 정보로 가입한 경우 서비스 이용이 제한될 수 있습니다.</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>제6조 (회원의 의무)</h2>
        <p>1. 회원은 서비스를 통해 제공받은 문제 및 콘텐츠를 상업적으로 무단 배포하거나 제3자에게 판매할 수 없습니다.</p>
        <p>2. 회원은 자신의 아이디와 비밀번호를 관리할 의무가 있으며, 이를 제3자에게 양도하거나 대여할 수 없습니다.</p>
        <p>3. 회원은 서비스의 정상적인 운영을 방해하는 행위를 하여서는 안 됩니다.</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>제7조 (저작권)</h2>
        <p>1. 서비스에서 제공하는 기출문제의 저작권은 원저작권자에게 있으며, 회사는 교육 목적의 공정 이용 범위 내에서 해당 콘텐츠를 제공합니다.</p>
        <p>2. AI를 통해 생성된 변형문제의 활용 권한은 해당 문제를 생성한 회원에게 있으나, 서비스 개선 목적으로 회사가 활용할 수 있습니다.</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>제8조 (서비스의 중단)</h2>
        <p>회사는 시스템 점검, 설비 보수, 기타 불가피한 사유가 발생한 경우 서비스의 전부 또는 일부를 일시적으로 중단할 수 있습니다.</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>제9조 (면책조항)</h2>
        <p>1. 회사는 천재지변, 전쟁 등 불가항력적 사유로 서비스를 제공할 수 없는 경우 책임을 지지 않습니다.</p>
        <p>2. 회사는 이용자의 귀책사유로 인한 서비스 이용 장애에 대하여 책임을 지지 않습니다.</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>제10조 (분쟁해결)</h2>
        <p>본 약관에서 정하지 않은 사항이나 해석에 대해서는 관련 법령 및 상관례에 따릅니다.</p>
      </div>
    </div>
  );
}
