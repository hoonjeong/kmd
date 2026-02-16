'use client';

import { useState, useEffect } from 'react';
import { useSSEGeneration } from '@/hooks/useSSEGeneration';
import { DIFFICULTY_OPTIONS, COUNT_OPTIONS } from '@/lib/constants';
import GenerationResultCard from '@/components/GenerationResultCard';

import type { GenerationCompleteData } from './LiteratureClient';

interface Props {
  userName: string;
  initialTotalCount: number;
  isAdmin?: boolean;
  onGenerated?: () => void;
  onGenerationComplete?: (data: GenerationCompleteData) => void;
}

interface GrammarFile {
  id: number;
  grade?: string;
  publisher?: string;
  searchKeyword?: string;
  schoolName?: string;
  year?: number;
  term?: number;
}

export default function GrammarClient({ userName, initialTotalCount, isAdmin, onGenerated, onGenerationComplete }: Props) {
  const [keyword, setKeyword] = useState('');
  const [count, setCount] = useState(3);
  const [difficulty, setDifficulty] = useState('중');
  const [userNotes, setUserNotes] = useState('');
  const [template, setTemplate] = useState<'SAMPLE' | 'SAMPLE2'>('SAMPLE2');

  const [totalCount, setTotalCount] = useState(initialTotalCount);

  // 검색 결과
  const [files, setFiles] = useState<GrammarFile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchDone, setSearchDone] = useState(false);

  // 펼쳐보기 (파일 콘텐츠)
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedContent, setExpandedContent] = useState<string>('');
  const [contentLoading, setContentLoading] = useState(false);

  // 선택된 파일 (AI 생성용)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { status, generatedText, error, generate, reset: resetGeneration } = useSSEGeneration();

  async function handleSearch() {
    if (!keyword.trim()) return;
    setSearchLoading(true);
    setSearchError('');
    setFiles([]);
    setSearchDone(false);
    setExpandedId(null);
    setSelectedIds(new Set());
    try {
      const res = await fetch('/api/admin/grammar/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `서버 오류 (HTTP ${res.status})`);
      }
      const data = await res.json();
      setFiles(data.files || []);
      setTotalCount(data.totalCount ?? 0);
      setSearchDone(true);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : '검색에 실패했습니다.');
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleExpand(metaId: number) {
    if (expandedId === metaId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(metaId);
    setExpandedContent('');
    setContentLoading(true);
    try {
      const res = await fetch(`/api/admin/grammar/content?metaId=${metaId}`);
      if (!res.ok) {
        setExpandedContent('콘텐츠를 불러올 수 없습니다.');
        return;
      }
      const data = await res.json();
      const content = data.fileContent?.content;
      setExpandedContent(typeof content === 'string' ? content : '(콘텐츠 없음)');
    } catch {
      setExpandedContent('콘텐츠를 불러올 수 없습니다.');
    } finally {
      setContentLoading(false);
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map(f => f.id)));
    }
  }

  function handleReset() {
    setKeyword('');
    setFiles([]);
    setSearchDone(false);
    setExpandedId(null);
    setSelectedIds(new Set());
    setCount(3);
    setDifficulty('중');
    setUserNotes('');
    setSearchError('');
    resetGeneration();
  }

  function handleGenerate() {
    if (selectedIds.size === 0) {
      return;
    }
    generate('/api/admin/grammar/generate', {
      metaIds: Array.from(selectedIds),
      difficulty,
      count,
      userNotes: userNotes.trim() || undefined,
    });
  }

  const isGenerating = status === 'generating';
  const downloadTitle = keyword.trim() ? `${keyword.trim()}_문법_변형문제` : '문법_변형문제';

  useEffect(() => {
    if (status === 'generated') {
      onGenerated?.();
      if (generatedText) {
        onGenerationComplete?.({
          category: '문법',
          title: downloadTitle,
          generatedText,
          requestParams: {
            metaIds: Array.from(selectedIds),
            keyword: keyword.trim() || undefined,
          },
          difficulty,
          questionCount: count,
          template,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <>
      <div className="card mb-3">
        <div className="card-body">
          {/* 세부영역 검색 */}
          <div className="form-group" style={{ marginBottom: 22 }}>
            <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>세부영역 검색</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" className="form-control" value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="음운변동, 품사, 문장성분 등" disabled={isGenerating}
                style={{ flex: 1 }} />
              <button className="btn btn-outline-primary" onClick={handleSearch}
                disabled={isGenerating || searchLoading || !keyword.trim()} style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                {searchLoading ? <><span className="spinner-border spinner-border-sm mr-2" role="status" />검색 중...</> : '검색'}
              </button>
            </div>
          </div>

          {/* 문항수 + 난이도 + 양식 */}
          <div style={{ display: 'flex', gap: 32, marginBottom: 22, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>문항 수</label>
              <select className="form-control form-control-sm" value={count}
                onChange={e => setCount(Number(e.target.value))} disabled={isGenerating} style={{ width: 80 }}>
                {COUNT_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>난이도</label>
              <div style={{ display: 'flex', gap: 16, paddingTop: 4 }}>
                {DIFFICULTY_OPTIONS.map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 14 }}>
                    <input type="radio" name="gram-difficulty" value={opt.value}
                      checked={difficulty === opt.value} onChange={() => setDifficulty(opt.value)} disabled={isGenerating} />{opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>시험지 양식</label>
              <select className="form-control form-control-sm" value={template}
                onChange={e => setTemplate(e.target.value as 'SAMPLE' | 'SAMPLE2')} disabled={isGenerating} style={{ width: 220 }}>
                <option value="SAMPLE2">양식 1 (회색 테두리)</option>
                <option value="SAMPLE">양식 2 (청록 테두리)</option>
              </select>
            </div>
          </div>

          {/* 요청사항 */}
          <div className="form-group" style={{ marginBottom: 22 }}>
            <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>문제제작 요청사항</label>
            <textarea className="form-control" value={userNotes} onChange={e => setUserNotes(e.target.value)}
              rows={2} placeholder="문제제작에 참고해야할 지침을 넣어주세요." disabled={isGenerating} />
          </div>

          {/* 버튼 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleGenerate}
              disabled={isGenerating || selectedIds.size === 0} style={{ fontWeight: 600 }}>
              {isGenerating ? <><span className="spinner-border spinner-border-sm mr-2" role="status" />생성 중...</> : `문제 생성 (${selectedIds.size}개 선택)`}
            </button>
            <button className="btn btn-outline-secondary" onClick={handleReset} disabled={isGenerating}>초기화</button>
            {searchDone && (
              <span style={{ marginLeft: 12, fontSize: 13, color: '#64748b' }}>
                참고 문항 <strong style={{ color: totalCount > 0 ? '#3b82f6' : '#ef4444', fontSize: 14 }}>{totalCount.toLocaleString()}</strong>건
                {totalCount === 0 && (
                  <span style={{ marginLeft: 8, color: '#ef4444', fontSize: 12 }}>참고 데이터가 너무 부족합니다. 조건을 다르게 설정해보세요.</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 검색 에러 */}
      {searchError && <div className="alert alert-danger"><strong>오류:</strong> {searchError}</div>}

      {/* 검색 결과 */}
      {searchDone && (
        <div className="card mb-3">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>검색 결과</strong>
              <span style={{ marginLeft: 8, fontSize: 13, color: '#64748b' }}>({files.length}건)</span>
            </div>
            {files.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13, margin: 0 }}>
                <input type="checkbox" checked={selectedIds.size === files.length} onChange={toggleSelectAll} />전체 선택
              </label>
            )}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {files.length === 0 ? (
              <p style={{ color: '#94a3b8', margin: 0, padding: 16 }}>조건에 맞는 파일이 없습니다.</p>
            ) : (
              <div>
                {files.map(f => (
                  <div key={f.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', cursor: isAdmin ? 'pointer' : 'default' }}
                      onClick={() => isAdmin && handleExpand(f.id)}>
                      <input type="checkbox" checked={selectedIds.has(f.id)}
                        onChange={e => { e.stopPropagation(); toggleSelect(f.id); }}
                        onClick={e => e.stopPropagation()} />
                      <span style={{ fontSize: 13, color: '#64748b', minWidth: 40 }}>{f.grade || ''}</span>
                      <span style={{ fontSize: 13, color: '#475569', minWidth: 60 }}>{f.publisher || ''}</span>
                      <span style={{ fontSize: 13, color: '#1e293b', flex: 1 }}>{f.searchKeyword || ''}</span>
                      <span style={{ fontSize: 13, color: '#94a3b8' }}>
                        {f.schoolName || ''} {f.year || ''}{f.term ? `-${f.term}` : ''}
                      </span>
                      {isAdmin && (
                        <span style={{ fontSize: 12, color: '#3b82f6' }}>
                          {expandedId === f.id ? '접기' : '펼치기'}
                        </span>
                      )}
                    </div>
                    {isAdmin && expandedId === f.id && (
                      <div style={{ padding: '0 16px 12px', background: '#f8fafc' }}>
                        {contentLoading ? (
                          <div style={{ padding: 12, textAlign: 'center', color: '#94a3b8' }}>
                            <span className="spinner-border spinner-border-sm mr-2" role="status" />불러오는 중...
                          </div>
                        ) : (
                          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, lineHeight: 1.7, maxHeight: 400, overflow: 'auto', margin: 0, padding: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                            {expandedContent}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 에러 */}
      {error && <div className="alert alert-danger"><strong>오류:</strong> {error}</div>}

      {/* 생성 결과 */}
      <GenerationResultCard status={status} generatedText={generatedText} title={downloadTitle} template={template} />
    </>
  );
}
