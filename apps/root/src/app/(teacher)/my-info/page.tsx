'use client';

import { useState, useEffect } from 'react';

export default function MyInfoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [schoolName, setSchoolName] = useState('');

  // 원본 값 (변경 감지용)
  const [origName, setOrigName] = useState('');
  const [origSchoolName, setOrigSchoolName] = useState('');

  useEffect(() => {
    fetch('/api/teacher/profile')
      .then(res => res.json())
      .then(data => {
        const p = data.profile;
        if (p) {
          setName(p.name || '');
          setEmail(p.email || '');
          setPhone(p.phone || '');
          setSchoolName(p.school_name || '');
          setOrigName(p.name || '');
          setOrigSchoolName(p.school_name || '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hasChanges = name !== origName || schoolName !== origSchoolName;

  async function handleSave() {
    if (!hasChanges) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/teacher/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, schoolName }),
      });
      if (res.ok) {
        setOrigName(name);
        setOrigSchoolName(schoolName);
        setMessage({ type: 'success', text: '정보가 수정되었습니다.' });
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: data.error || '수정에 실패했습니다.' });
      }
    } catch {
      setMessage({ type: 'error', text: '수정에 실패했습니다.' });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
        <span className="spinner-border spinner-border-sm" role="status" /> 불러오는 중...
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 24 }}>
        내 정보
      </h2>

      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        maxWidth: 480,
      }}>
        {/* 이름 (편집 가능) */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>이름</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: 14,
              color: '#1e293b',
              outline: 'none',
            }}
          />
        </div>

        {/* 학원명 (편집 가능) */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>학원명</label>
          <input
            type="text"
            value={schoolName}
            onChange={e => setSchoolName(e.target.value)}
            placeholder="학원명을 입력해주세요"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: 14,
              color: '#1e293b',
              outline: 'none',
            }}
          />
        </div>

        {/* 이메일 (읽기 전용) */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>이메일</label>
          <div style={{ fontSize: 14, color: '#64748b', padding: '8px 0' }}>{email || '-'}</div>
        </div>

        {/* 전화번호 (읽기 전용) */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>전화번호</label>
          <div style={{ fontSize: 14, color: '#64748b', padding: '8px 0' }}>{phone || '-'}</div>
        </div>

        {/* 메시지 */}
        {message && (
          <div style={{
            padding: '8px 12px',
            borderRadius: 6,
            marginBottom: 12,
            fontSize: 13,
            background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: message.type === 'success' ? '#16a34a' : '#dc2626',
            border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          }}>
            {message.text}
          </div>
        )}

        {/* 수정 버튼 */}
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          style={{
            background: hasChanges ? '#3b82f6' : '#e2e8f0',
            color: hasChanges ? '#fff' : '#94a3b8',
            border: 'none',
            borderRadius: 8,
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: hasChanges ? 'pointer' : 'default',
          }}
        >
          {saving ? '저장 중...' : '수정하기'}
        </button>
      </div>
    </div>
  );
}
