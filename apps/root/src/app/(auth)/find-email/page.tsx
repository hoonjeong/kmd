'use client';

import { useState } from 'react';
import Link from 'next/link';
import Footer from '@/components/Footer';

export default function FindEmailPage() {
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/find-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(data.error || '이메일을 찾을 수 없습니다.');
      } else {
        setResult(`등록된 이메일: ${data.email}`);
      }
    } catch {
      setResult('오류가 발생했습니다.');
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
        <h4>이메일 찾기</h4>
        <p>가입 시 등록한 전화번호로 이메일을 찾을 수 있습니다</p>
      </div>

      {result && (
        <div className={`alert ${result.startsWith('등록된') ? 'alert-success' : 'alert-danger'}`}>
          {result}
        </div>
      )}

      <form onSubmit={handleSubmit}>
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
            {loading ? '찾는 중...' : '이메일 찾기'}
          </button>
        </div>
      </form>

      <div className="auth-links">
        <Link href="/login">로그인으로 돌아가기</Link>
      </div>
    </div>
    </div>
    <Footer />
    </div>
  );
}
