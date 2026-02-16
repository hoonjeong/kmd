'use client';

import { useState, useEffect } from 'react';

interface Generation {
  id: number;
  category: string;
  title: string;
  difficulty: string;
  question_count: number;
  template: string;
  has_hwpx: number;
  created_at: string;
}

interface GenerationDetail extends Generation {
  generated_text: string;
}

const CATEGORY_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  '문학': { bg: '#e0f2fe', color: '#0369a1', label: '문학' },
  '문법': { bg: '#fef3c7', color: '#92400e', label: '문법' },
  '독서': { bg: '#dcfce7', color: '#166534', label: '독서' },
};

export default function MyQuestionsPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedText, setExpandedText] = useState<string>('');
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetch('/api/teacher/generations')
      .then(res => res.json())
      .then(data => setGenerations(data.generations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setExpandedText('');
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/teacher/generations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setExpandedText(data.generation?.generated_text || '');
      }
    } catch { /* ignore */ }
    setDetailLoading(false);
  }

  function handleDownload(id: number) {
    window.open(`/api/teacher/generations/${id}/download`, '_blank');
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 24 }}>
        내가 생성한 문항
      </h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <span className="spinner-border spinner-border-sm" role="status" /> 불러오는 중...
        </div>
      ) : generations.length === 0 ? (
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 40,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 15, color: '#64748b', marginBottom: 8 }}>
            아직 생성한 문항이 없습니다.
          </p>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
            대시보드에서 문제를 생성하면 이곳에서 확인할 수 있습니다.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {generations.map(gen => {
            const badge = CATEGORY_BADGE[gen.category] || { bg: '#f1f5f9', color: '#475569', label: gen.category };
            const isExpanded = expandedId === gen.id;

            return (
              <div key={gen.id} style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}>
                {/* 헤더 행 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleExpand(gen.id)}
                >
                  <span style={{
                    display: 'inline-block',
                    background: badge.bg,
                    color: badge.color,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                    flexShrink: 0,
                  }}>
                    {badge.label}
                  </span>
                  <span style={{ fontSize: 14, color: '#1e293b', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {gen.title}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>
                    난이도: {gen.difficulty} | {gen.question_count}문항
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>
                    {formatDate(gen.created_at)}
                  </span>
                  {gen.has_hwpx ? (
                    <button
                      onClick={e => { e.stopPropagation(); handleDownload(gen.id); }}
                      style={{
                        background: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <i className="fas fa-download" style={{ fontSize: 10 }} />
                      HWPX
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: '#cbd5e1', flexShrink: 0 }}>HWPX 없음</span>
                  )}
                  <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`} style={{ fontSize: 12, color: '#94a3b8' }} />
                </div>

                {/* 펼쳐진 내용 */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f1f5f9' }}>
                    {detailLoading ? (
                      <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>
                        <span className="spinner-border spinner-border-sm" role="status" /> 불러오는 중...
                      </div>
                    ) : (
                      <pre style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: 13,
                        lineHeight: 1.7,
                        margin: 0,
                        padding: 16,
                        background: '#f8fafc',
                        borderRadius: 6,
                        marginTop: 12,
                        maxHeight: 500,
                        overflow: 'auto',
                      }}>
                        {expandedText}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
