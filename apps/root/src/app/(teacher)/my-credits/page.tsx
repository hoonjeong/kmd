'use client';

import { useState, useEffect } from 'react';

interface CreditLog {
  id: number;
  type: 'charge' | 'deduct';
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

export default function MyCreditsPage() {
  const [credits, setCredits] = useState<number | null>(null);
  const [logs, setLogs] = useState<CreditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/teacher/credit-log')
      .then(res => res.json())
      .then(data => {
        setCredits(data.credits ?? 0);
        setLogs(data.logs || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 24 }}>
        내 크레딧 정보
      </h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <span className="spinner-border spinner-border-sm" role="status" /> 불러오는 중...
        </div>
      ) : (
        <>
          {/* 잔여 크레딧 */}
          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#f0f9ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              flexShrink: 0,
            }}>
              <i className="fas fa-coins" style={{ color: '#0369a1' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 2 }}>잔여 크레딧</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#0369a1' }}>
                {credits !== null ? credits.toLocaleString() : '-'}
              </div>
            </div>
          </div>

          {/* 이용 내역 */}
          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', margin: 0 }}>이용 내역</h3>
            </div>

            {logs.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                아직 이용 내역이 없습니다.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>날짜</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>설명</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>변동</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>잔액</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {formatDate(log.created_at)}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#1e293b' }}>
                        {log.description || (log.type === 'charge' ? '크레딧 충전' : '크레딧 사용')}
                      </td>
                      <td style={{
                        padding: '10px 16px',
                        textAlign: 'right',
                        fontWeight: 600,
                        color: log.type === 'charge' ? '#16a34a' : '#dc2626',
                      }}>
                        {log.type === 'charge' ? '+' : '-'}{log.amount}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#475569', fontWeight: 500 }}>
                        {log.balance_after.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
