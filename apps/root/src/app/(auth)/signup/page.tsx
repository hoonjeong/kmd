'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Footer from '@/components/Footer';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    phone: '',
    schoolName: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Phone verification state
  const [verifyCode, setVerifyCode] = useState('');
  const [phoneToken, setPhoneToken] = useState('');
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneConfirming, setPhoneConfirming] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSendCode() {
    if (!form.phone) {
      setPhoneMessage('전화번호를 입력해주세요.');
      return;
    }
    setPhoneMessage('');
    setPhoneSending(true);

    try {
      const res = await fetch('/api/auth/phone-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhoneMessage(data.error || '인증번호 발송에 실패했습니다.');
      } else {
        setPhoneMessage('인증번호가 발송되었습니다. 문자가 오지 않으면 전화번호를 확인 후 다시 시도해주세요.');
      }
    } catch {
      setPhoneMessage('인증번호 발송 중 오류가 발생했습니다.');
    } finally {
      setPhoneSending(false);
    }
  }

  async function handleConfirmCode() {
    if (!verifyCode) {
      setPhoneMessage('인증번호를 입력해주세요.');
      return;
    }
    setPhoneMessage('');
    setPhoneConfirming(true);

    try {
      const res = await fetch('/api/auth/phone-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.phone, code: verifyCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhoneMessage(data.error || '인증에 실패했습니다.');
      } else {
        setPhoneToken(data.phoneToken);
        setPhoneVerified(true);
        setPhoneMessage('전화번호 인증이 완료되었습니다. 나머지 정보를 입력 후 가입해주세요.');
      }
    } catch {
      setPhoneMessage('인증 확인 중 오류가 발생했습니다.');
    } finally {
      setPhoneConfirming(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (form.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (!phoneVerified) {
      setError('전화번호 인증을 완료해주세요.');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        phoneToken,
        schoolName: form.schoolName || undefined,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || '회원가입에 실패했습니다.');
      return;
    }

    router.push('/login?registered=1');
  }

  return (
    <div className="auth-center-page">
    <div className="auth-center-body">
    <div className="auth-box">
      <div className="auth-header">
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, color: '#1e293b' }}>국문당</div>
        <h4>회원가입</h4>
        <p>국문당 서비스를 이용하려면 가입해주세요</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>이름 *</label>
          <input
            type="text"
            name="name"
            className="form-control"
            placeholder="이름을 입력하세요"
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label>이메일 *</label>
          <input
            type="email"
            name="email"
            className="form-control"
            placeholder="이메일을 입력하세요"
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label>비밀번호 *</label>
          <input
            type="password"
            name="password"
            className="form-control"
            placeholder="8자 이상 입력하세요"
            value={form.password}
            onChange={handleChange}
            required
            minLength={8}
          />
        </div>
        <div className="form-group">
          <label>비밀번호 확인 *</label>
          <input
            type="password"
            name="passwordConfirm"
            className="form-control"
            placeholder="비밀번호를 다시 입력하세요"
            value={form.passwordConfirm}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label>전화번호 *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="tel"
              name="phone"
              className="form-control"
              placeholder="01012345678"
              value={form.phone}
              onChange={handleChange}
              required
              disabled={phoneVerified}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn-auth"
              onClick={handleSendCode}
              disabled={phoneSending || phoneVerified}
              style={{ width: 120, flexShrink: 0 }}
            >
              {phoneSending ? '발송 중...' : phoneVerified ? '인증완료' : '인증번호 발송'}
            </button>
          </div>
        </div>
        {!phoneVerified && (
          <div className="form-group">
            <label>인증번호</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="form-control"
                placeholder="6자리 인증번호"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                maxLength={6}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn-auth"
                onClick={handleConfirmCode}
                disabled={phoneConfirming}
                style={{ width: 120, flexShrink: 0 }}
              >
                {phoneConfirming ? '확인 중...' : '확인'}
              </button>
            </div>
          </div>
        )}
        {phoneMessage && (
          <div
            className={`alert ${phoneVerified ? 'alert-success' : 'alert-info'}`}
            style={{ marginTop: 8 }}
          >
            {phoneMessage}
          </div>
        )}
        <div className="form-group">
          <label>학원명 (선택)</label>
          <input
            type="text"
            name="schoolName"
            className="form-control"
            placeholder="재직 중인 학원"
            value={form.schoolName}
            onChange={handleChange}
          />
        </div>
        <div className="form-group" style={{ marginTop: 20 }}>
          <button type="submit" className="btn-auth" disabled={loading || !phoneVerified}>
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </div>
      </form>

      <div className="auth-links" style={{ fontSize: 12, color: '#94a3b8', marginTop: 12, paddingTop: 12, borderTop: 'none' }}>
        가입 시 <Link href="/terms">이용약관</Link> 및 <Link href="/privacy">개인정보 처리방침</Link>에 동의하게 됩니다.
      </div>

      <div className="auth-links">
        이미 계정이 있으신가요? <Link href="/login">로그인</Link>
      </div>
    </div>
    </div>
    <Footer />
    </div>
  );
}
