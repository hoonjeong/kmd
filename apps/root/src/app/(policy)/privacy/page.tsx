import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div>
      <Link href="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 14 }}>
        &larr; 홈으로 돌아가기
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', margin: '24px 0 8px' }}>개인정보 처리방침</h1>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 32 }}>최종 수정일: 2026년 2월 16일</p>

      <div style={{ color: '#334155', fontSize: 14, lineHeight: 1.8 }}>
        <p>웬더키즈슬립(이하 &quot;회사&quot;)은 &quot;국문당&quot; 서비스 이용자의 개인정보를 소중히 여기며, 개인정보 보호법 등 관련 법률을 준수합니다.</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>1. 수집하는 개인정보 항목</h2>
        <p><strong>필수항목:</strong> 이름, 이메일, 비밀번호, 전화번호</p>
        <p><strong>선택항목:</strong> 학교명</p>
        <p><strong>자동수집항목:</strong> 접속 IP, 서비스 이용 기록, 접속 일시</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>2. 개인정보의 수집 및 이용 목적</h2>
        <ul>
          <li>회원 가입 및 관리: 본인 확인, 가입 의사 확인, 회원 식별</li>
          <li>서비스 제공: 문제 검색, AI 문제 생성, 문제지 다운로드 등 서비스 제공</li>
          <li>고객 지원: 불만 처리, 공지사항 전달</li>
          <li>서비스 개선: 이용 통계 분석, 서비스 품질 향상</li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>3. 개인정보의 보유 및 이용 기간</h2>
        <p>회원 탈퇴 시까지 보유하며, 탈퇴 후 지체 없이 파기합니다. 단, 관련 법령에 따라 보존이 필요한 경우 해당 법령에서 정한 기간 동안 보관합니다.</p>
        <ul>
          <li>전자상거래 등에서의 소비자 보호에 관한 법률: 계약 또는 청약철회에 관한 기록 5년</li>
          <li>통신비밀보호법: 로그인 기록 3개월</li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>4. 개인정보의 제3자 제공</h2>
        <p>회사는 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다. 다만, 법령에 의해 요구되는 경우에 한하여 제공될 수 있습니다.</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>5. 개인정보의 파기</h2>
        <p>개인정보의 보유 기간이 경과하거나 처리 목적이 달성된 경우, 지체 없이 해당 개인정보를 파기합니다. 전자적 파일 형태의 정보는 복구할 수 없는 방법으로 영구 삭제합니다.</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>6. 이용자의 권리</h2>
        <p>이용자는 언제든지 자신의 개인정보를 조회하거나 수정할 수 있으며, 회원 탈퇴를 통해 개인정보 처리 정지를 요청할 수 있습니다.</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>7. 개인정보 보호를 위한 기술적 대책</h2>
        <ul>
          <li>비밀번호 암호화 저장 (bcrypt)</li>
          <li>SSL/TLS 암호화 통신</li>
          <li>접근 권한 관리 및 접근 통제</li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>8. 개인정보 보호 책임자</h2>
        <p>이메일: hoonjeong.eden@gmail.com</p>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px' }}>9. 개인정보 처리방침 변경</h2>
        <p>본 방침은 법령, 정책 또는 보안 기술의 변경에 따라 내용이 추가, 삭제 및 수정될 수 있으며, 변경 사항은 시행 7일 전에 서비스 내 공지합니다.</p>
      </div>
    </div>
  );
}
