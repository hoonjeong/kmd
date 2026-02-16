'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Footer from '@/components/Footer';

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const registered = searchParams.get('registered');
  const errorParam = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      rememberMe: rememberMe ? 'true' : 'false',
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('이메일 또는 비밀번호가 일치하지 않습니다.');
    } else {
      // 자동 로그인 체크 여부에 따라 session_guard 쿠키 설정
      if (rememberMe) {
        document.cookie = 'session_guard=1; path=/; max-age=2592000; SameSite=Lax';
      } else {
        document.cookie = 'session_guard=1; path=/; SameSite=Lax';
      }
      router.push('/dashboard');
    }
  }

  return (
    <div className="landing-page">
      <div className="landing-top">
        <div className="landing-container">
          {/* Left: branding & features */}
          <div className="landing-left">
            <div className="landing-brand">
              <span className="landing-brand-sub">국어 문제를 만드는 집</span>
              <span className="landing-brand-text">국문당</span>
            </div>
            <h1 className="landing-title">
              고등국어 문제 제작,<br />
              더 쉽고 빠르게
            </h1>
            <p className="landing-desc">
              문학 작품별, 문법 영역별, 독서 소재별<br />
              AI로 나만의 변형문제를 만들어보세요.
            </p>
            <div className="landing-features">
              <div className="landing-feature">
                <div className="landing-feature-icon" style={{ background: '#f0fdf4' }}>🤖</div>
                <span>유형별 변형문제 생성</span>
              </div>
              <div className="landing-feature">
                <div className="landing-feature-icon" style={{ background: '#fef3c7' }}>📄</div>
                <span>HWPX 양식 다운로드</span>
              </div>
            </div>
          </div>

          {/* Right: login form */}
          <div className="landing-right">
            <div className="auth-box">
              {registered && (
                <div className="alert alert-success">회원가입이 완료되었습니다. 로그인해주세요.</div>
              )}
              {(error || errorParam) && (
                <div className="alert alert-danger">
                  {error || '로그인에 실패했습니다. 다시 시도해주세요.'}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>이메일</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="이메일을 입력하세요"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>비밀번호</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="비밀번호를 입력하세요"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  margin: '12px 0 4px',
                }}>
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#3b82f6' }}
                  />
                  <label htmlFor="rememberMe" style={{
                    fontSize: 13,
                    color: '#64748b',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}>
                    자동 로그인
                  </label>
                </div>
                <div className="form-group" style={{ marginTop: 12 }}>
                  <button type="submit" className="btn-auth" disabled={loading}>
                    {loading ? '로그인 중...' : '로그인'}
                  </button>
                </div>
              </form>

              <div className="auth-links" style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                <Link href="/signup">회원가입</Link>
                <span style={{ color: '#e2e8f0' }}>|</span>
                <Link href="/find-email">이메일 찾기</Link>
                <span style={{ color: '#e2e8f0' }}>|</span>
                <Link href="/find-password">비밀번호 찾기</Link>
              </div>

              <div className="auth-divider"><span>소셜 로그인</span></div>

              <button className="btn-social google" onClick={() => alert('준비 중입니다.')}>
                <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
                Google로 로그인
              </button>

              <button className="btn-social kakao" onClick={() => alert('준비 중입니다.')}>
                <svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 1C4.582 1 1 3.877 1 7.396c0 2.237 1.467 4.215 3.68 5.378l-.934 3.426a.3.3 0 00.452.326l3.876-2.577c.303.028.612.047.926.047 4.418 0 8-2.877 8-6.4S13.418 1 9 1z" fill="#191919"/></svg>
                카카오로 로그인
              </button>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="landing-page">
        <div className="landing-top">
          <div style={{ textAlign: 'center' }}>
            <div className="spinner-border text-primary" role="status" />
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
