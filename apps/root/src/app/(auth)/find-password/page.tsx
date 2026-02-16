'use client';

import { useState } from 'react';
import Link from 'next/link';
import Footer from '@/components/Footer';

export default function FindPasswordPage() {
  const [step, setStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneToken, setPhoneToken] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/find-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-code', email, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '인증번호 발송에 실패했습니다.');
      } else {
        setMessage('인증번호가 발송되었습니다.');
        setStep('verify');
      }
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/find-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-code', phone, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '인증에 실패했습니다.');
      } else {
        setPhoneToken(data.phoneToken);
        setStep('reset');
      }
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/find-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', email, phone, phoneToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '비밀번호 변경에 실패했습니다.');
      } else {
        setMessage('비밀번호가 변경되었습니다. 로그인해주세요.');
      }
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-center-page">
    <div className="auth-center-body">
    <div className="auth-box">
      <div className="auth-header">
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, color: '#1e293b' }}>국문당</div>
        <h4>비밀번호 찾기</h4>
        <p>가입 시 등록한 이메일과 전화번호로 비밀번호를 재설정합니다</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {step === 'request' && (
        <form onSubmit={handleSendCode}>
          <div className="form-group">
            <label>이메일</label>
            <input
              type="email"
              className="form-control"
              placeholder="가입한 이메일을 입력하세요"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>전화번호</label>
            <input
              type="tel"
              className="form-control"
              placeholder="01012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ marginTop: 20 }}>
            <button type="submit" className="btn-auth" disabled={loading}>
              {loading ? '발송 중...' : '인증번호 발송'}
            </button>
          </div>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={handleVerifyCode}>
          <div className="form-group">
            <label>인증번호</label>
            <input
              type="text"
              className="form-control"
              placeholder="6자리 인증번호"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              required
            />
          </div>
          <div className="form-group" style={{ marginTop: 20 }}>
            <button type="submit" className="btn-auth" disabled={loading}>
              {loading ? '확인 중...' : '인증번호 확인'}
            </button>
          </div>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={handleResetPassword}>
          <div className="form-group">
            <label>새 비밀번호</label>
            <input
              type="password"
              className="form-control"
              placeholder="8자 이상 입력하세요"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="form-group">
            <label>새 비밀번호 확인</label>
            <input
              type="password"
              className="form-control"
              placeholder="비밀번호를 다시 입력하세요"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ marginTop: 20 }}>
            <button type="submit" className="btn-auth" disabled={loading}>
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </div>
        </form>
      )}

      <div className="auth-links">
        <Link href="/login">로그인으로 돌아가기</Link>
      </div>
    </div>
    </div>
    <Footer />
    </div>
  );
}
