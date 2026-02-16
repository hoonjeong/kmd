import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{
      background: '#1e293b',
      color: '#94a3b8',
      padding: '32px 24px 24px',
      fontSize: 13,
      lineHeight: 1.7,
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginBottom: 16 }}>
          <Link href="/terms" style={{ color: '#cbd5e1', textDecoration: 'none' }}>이용약관</Link>
          <span style={{ color: '#475569' }}>|</span>
          <Link href="/privacy" style={{ color: '#cbd5e1', textDecoration: 'none', fontWeight: 600 }}>개인정보 처리방침</Link>
          <span style={{ color: '#475569' }}>|</span>
          <Link href="/service-policy" style={{ color: '#cbd5e1', textDecoration: 'none' }}>서비스 이용 정책</Link>
        </div>
        <div style={{ textAlign: 'center', color: '#64748b', fontSize: 12 }}>
          <p style={{ margin: '0 0 4px' }}>
            웬더키즈슬립 | 사업자등록번호: 857-60-00832 | 문의: hoonjeong.eden@gmail.com
          </p>
          <p style={{ margin: 0 }}>
            &copy; {new Date().getFullYear()} 국문당. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
