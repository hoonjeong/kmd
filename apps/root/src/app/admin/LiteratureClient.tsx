'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSSEGeneration } from '@/hooks/useSSEGeneration';
import { DIFFICULTY_OPTIONS, COUNT_OPTIONS, CIRCLED_NUMBERS } from '@/lib/constants';
import GenerationResultCard from '@/components/GenerationResultCard';

export interface GenerationCompleteData {
  category: string;
  title: string;
  generatedText: string;
  requestParams: Record<string, unknown>;
  difficulty: string;
  questionCount: number;
  template: string;
}

interface Props {
  userName: string;
  initialSubCategories: string[];
  initialQuestionPatterns: string[];
  initialTotalCount: number;
  isAdmin?: boolean;
  onGenerated?: () => void;
  onGenerationComplete?: (data: GenerationCompleteData) => void;
}

interface PreviewPassageSet {
  passage: {
    id: number;
    content: string;
    category: string;
    subCategory: string;
    title: string | null;
    author: string | null;
  };
  questions: {
    id: number;
    questionNumber: number;
    questionText: string;
    questionPattern: string | null;
    answer: string | null;
    explanation: string | null;
    choices: { choiceNumber: number; choiceText: string; isAnswer: boolean }[];
  }[];
}

export default function LiteratureClient({
  userName,
  initialSubCategories,
  initialQuestionPatterns,
  initialTotalCount,
  isAdmin,
  onGenerated,
  onGenerationComplete,
}: Props) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [subCategories, setSubCategories] = useState<string[]>(initialSubCategories);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [questionPatterns, setQuestionPatterns] = useState<string[]>(initialQuestionPatterns);
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const [count, setCount] = useState(3);
  const [difficulty, setDifficulty] = useState('중');
  const [userNotes, setUserNotes] = useState('');
  const [template, setTemplate] = useState<'SAMPLE' | 'SAMPLE2'>('SAMPLE2');

  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [countLoading, setCountLoading] = useState(false);
  const [filtersActivated, setFiltersActivated] = useState(false);

  const [previewSets, setPreviewSets] = useState<PreviewPassageSet[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  const { status, generatedText, error, generate, reset: resetGeneration } = useSSEGeneration();
  const fetchSeqRef = useRef(0);

  const fetchFilters = useCallback(async (opts: {
    subCats?: string[];
    patterns?: string[];
    titleVal?: string;
    authorVal?: string;
  }) => {
    const seq = ++fetchSeqRef.current;
    setCountLoading(true);
    const sp = new URLSearchParams();
    if (opts.subCats && opts.subCats.length > 0) sp.set('subCategories', opts.subCats.join(','));
    if (opts.patterns && opts.patterns.length > 0) sp.set('questionPatterns', opts.patterns.join(','));
    if (opts.titleVal) sp.set('title', opts.titleVal);
    if (opts.authorVal) sp.set('author', opts.authorVal);
    const qs = sp.toString();

    try {
      const res = await fetch(`/api/admin/literature/filters${qs ? '?' + qs : ''}`);
      if (seq !== fetchSeqRef.current) return;
      if (!res.ok) return;
      const data = await res.json();
      setSubCategories(data.subCategories || []);
      setQuestionPatterns(data.questionPatterns || []);
      setSelectedSubCategories(prev => prev.filter(s => (data.subCategories || []).includes(s)));
      setSelectedPatterns(prev => prev.filter(p => (data.questionPatterns || []).includes(p)));
      setTotalCount(data.totalCount ?? 0);
    } catch {
      // ignore
    } finally {
      if (seq === fetchSeqRef.current) setCountLoading(false);
    }
  }, []);

  const titleRef = useRef(title);
  titleRef.current = title;
  const authorRef = useRef(author);
  authorRef.current = author;
  const selectedSubCategoriesRef = useRef(selectedSubCategories);
  selectedSubCategoriesRef.current = selectedSubCategories;
  const selectedPatternsRef = useRef(selectedPatterns);
  selectedPatternsRef.current = selectedPatterns;

  function refreshCount(subCats: string[], patterns: string[]) {
    setFiltersActivated(true);
    fetchFilters({ subCats, patterns, titleVal: titleRef.current.trim() || undefined, authorVal: authorRef.current.trim() || undefined });
  }

  // 제목/작가 입력 시 디바운스로 자동 갱신
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (title.trim() || author.trim() || selectedSubCategoriesRef.current.length > 0 || selectedPatternsRef.current.length > 0) {
        refreshCount(selectedSubCategoriesRef.current, selectedPatternsRef.current);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, author]);

  function handleAllSubCategoriesToggle() {
    const next = selectedSubCategories.length === subCategories.length ? [] : [...subCategories];
    setSelectedSubCategories(next);
    refreshCount(next, selectedPatternsRef.current);
  }
  function handleSubCategoryToggle(sub: string) {
    setSelectedSubCategories(prev => {
      const next = prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub];
      refreshCount(next, selectedPatternsRef.current);
      return next;
    });
  }
  function handleAllPatternsToggle() {
    const next = selectedPatterns.length === questionPatterns.length ? [] : [...questionPatterns];
    setSelectedPatterns(next);
    refreshCount(selectedSubCategoriesRef.current, next);
  }
  function handlePatternToggle(pattern: string) {
    setSelectedPatterns(prev => {
      const next = prev.includes(pattern) ? prev.filter(p => p !== pattern) : [...prev, pattern];
      refreshCount(selectedSubCategoriesRef.current, next);
      return next;
    });
  }

  function handleReset() {
    setTitle('');
    setAuthor('');
    setSelectedSubCategories([]);
    setSelectedPatterns([]);
    setCount(3);
    setDifficulty('중');
    setUserNotes('');
    setPreviewSets(null);
    setSearchError('');
    setFiltersActivated(false);
    resetGeneration();
    fetchFilters({});
  }

  async function handleSearch() {
    setSearchLoading(true);
    setSearchError('');
    setPreviewSets(null);
    try {
      const res = await fetch('/api/admin/literature/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || undefined,
          author: author.trim() || undefined,
          subCategories: selectedSubCategories.length > 0 ? selectedSubCategories : undefined,
          questionPatterns: selectedPatterns.length > 0 ? selectedPatterns : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `서버 오류 (HTTP ${res.status})`);
      }
      const data = await res.json();
      setPreviewSets(data.passageSets || []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : '문항 검색에 실패했습니다.');
    } finally {
      setSearchLoading(false);
    }
  }

  function handleGenerate() {
    generate('/api/admin/literature/generate', {
      title: title.trim() || undefined,
      author: author.trim() || undefined,
      subCategories: selectedSubCategories.length > 0 ? selectedSubCategories : undefined,
      questionPatterns: selectedPatterns.length > 0 ? selectedPatterns : undefined,
      difficulty,
      count,
      userNotes: userNotes.trim() || undefined,
    });
  }

  function buildTitle() {
    const parts: string[] = [];
    if (title.trim()) parts.push(title.trim());
    if (author.trim()) parts.push(author.trim());
    parts.push('변형문제');
    return parts.join('_');
  }

  const isGenerating = status === 'generating';

  useEffect(() => {
    if (status === 'generated') {
      onGenerated?.();
      if (generatedText) {
        onGenerationComplete?.({
          category: '문학',
          title: buildTitle(),
          generatedText,
          requestParams: {
            title: title.trim() || undefined,
            author: author.trim() || undefined,
            subCategories: selectedSubCategories.length > 0 ? selectedSubCategories : undefined,
            questionPatterns: selectedPatterns.length > 0 ? selectedPatterns : undefined,
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
          {/* 작품명 */}
          <div className="form-group" style={{ marginBottom: 22 }}>
            <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>작품명</label>
            <input type="text" className="form-control" value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="사미인곡, 봄봄, 홍길동전 등" disabled={isGenerating} />
          </div>

          {/* 작가명 */}
          <div className="form-group" style={{ marginBottom: 22 }}>
            <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>작가명</label>
            <input type="text" className="form-control" value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="정철, 김소월, 윤동주 등" disabled={isGenerating} />
          </div>

          {/* 세부 영역 */}
          <div className="form-group" style={{ marginBottom: 22 }}>
            <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>세부 영역</label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {subCategories.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
                  <input type="checkbox" checked={selectedSubCategories.length === subCategories.length && subCategories.length > 0}
                    onChange={handleAllSubCategoriesToggle} disabled={isGenerating} />전체
                </label>
              )}
              {subCategories.map(sub => (
                <label key={sub} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={selectedSubCategories.includes(sub)}
                    onChange={() => handleSubCategoryToggle(sub)} disabled={isGenerating} />{sub}
                </label>
              ))}
            </div>
          </div>

          {/* 문제 유형 */}
          <div className="form-group" style={{ marginBottom: 22 }}>
            <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>문제 유형</label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {questionPatterns.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
                  <input type="checkbox" checked={selectedPatterns.length === questionPatterns.length && questionPatterns.length > 0}
                    onChange={handleAllPatternsToggle} disabled={isGenerating} />전체
                </label>
              )}
              {questionPatterns.map(p => (
                <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={selectedPatterns.includes(p)}
                    onChange={() => handlePatternToggle(p)} disabled={isGenerating} />{p}
                </label>
              ))}
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
                    <input type="radio" name="lit-difficulty" value={opt.value}
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
            {isAdmin && (
              <button className="btn btn-outline-primary" onClick={handleSearch}
                disabled={isGenerating || searchLoading} style={{ fontWeight: 600 }}>
                {searchLoading ? <><span className="spinner-border spinner-border-sm mr-2" role="status" />검색 중...</> : '관련 문항 검색'}
              </button>
            )}
            <button className="btn btn-primary" onClick={handleGenerate}
              disabled={isGenerating || searchLoading} style={{ fontWeight: 600 }}>
              {isGenerating ? <><span className="spinner-border spinner-border-sm mr-2" role="status" />생성 중...</> : '문제 생성'}
            </button>
            <button className="btn btn-outline-secondary" onClick={handleReset} disabled={isGenerating || searchLoading}>초기화</button>
            {filtersActivated && (
              <span style={{ marginLeft: 12, fontSize: 13, color: '#64748b' }}>
                참고 문항 <strong style={{ color: totalCount > 0 ? '#3b82f6' : '#ef4444', fontSize: 14 }}>{totalCount.toLocaleString()}</strong>건
                {countLoading && <span className="spinner-border spinner-border-sm" role="status" style={{ marginLeft: 6, width: 12, height: 12, borderWidth: 2 }} />}
                {totalCount === 0 && !countLoading && (
                  <span style={{ marginLeft: 8, color: '#ef4444', fontSize: 12 }}>참고 데이터가 너무 부족합니다. 조건을 다르게 설정해보세요.</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 검색 에러 */}
      {searchError && <div className="alert alert-danger"><strong>오류:</strong> {searchError}</div>}

      {/* 검색 프리뷰 (관리자만) */}
      {isAdmin && previewSets !== null && (
        <div className="card mb-3">
          <div className="card-header">
            <strong>관련 문항 검색 결과</strong>
            <span style={{ marginLeft: 8, fontSize: 13, color: '#64748b' }}>(지문 {previewSets.length}세트)</span>
          </div>
          <div className="card-body" style={{ padding: 16 }}>
            {previewSets.length === 0 ? (
              <p style={{ color: '#94a3b8', margin: 0 }}>조건에 맞는 문항이 없습니다. 필터를 조정해주세요.</p>
            ) : previewSets.map((set, setIdx) => (
              <div key={setIdx} style={{
                marginBottom: setIdx < previewSets.length - 1 ? 24 : 0,
                paddingBottom: setIdx < previewSets.length - 1 ? 24 : 0,
                borderBottom: setIdx < previewSets.length - 1 ? '1px solid #e2e8f0' : 'none',
              }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: 'inline-block', background: '#e0f2fe', color: '#0369a1', fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 4, marginRight: 8 }}>
                    지문 {setIdx + 1}
                  </span>
                  <span style={{ fontSize: 13, color: '#64748b' }}>
                    {set.passage?.subCategory || ''}
                    {set.passage?.title ? ` — ${set.passage.title}` : ''}
                    {set.passage?.author ? ` (${set.passage.author})` : ''}
                  </span>
                </div>
                {set.passage?.content && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 12, marginBottom: 12, fontSize: 13, lineHeight: 1.7, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                    {set.passage.content.length > 500 ? set.passage.content.substring(0, 500) + '...' : set.passage.content}
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#475569' }}>관련 문제 ({set.questions.length}개)</div>
                {set.questions.map((q, qIdx) => (
                  <div key={qIdx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10, marginBottom: 8, fontSize: 13 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4, color: '#1e293b' }}>
                      {q.questionNumber}. {q.questionText}
                      {q.questionPattern && <span style={{ marginLeft: 8, fontSize: 11, background: '#f1f5f9', color: '#64748b', padding: '1px 6px', borderRadius: 3 }}>{q.questionPattern}</span>}
                    </div>
                    {q.choices.length > 0 && (
                      <div style={{ marginLeft: 8, color: '#475569', lineHeight: 1.6 }}>
                        {q.choices.map(c => <div key={c.choiceNumber}>{CIRCLED_NUMBERS[c.choiceNumber - 1] || c.choiceNumber} {c.choiceText}</div>)}
                      </div>
                    )}
                    {q.answer && <div style={{ marginTop: 4, color: '#0369a1', fontWeight: 500 }}>정답: {q.answer}</div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 에러 */}
      {error && <div className="alert alert-danger"><strong>오류:</strong> {error}</div>}

      {/* 생성 결과 */}
      <GenerationResultCard status={status} generatedText={generatedText} title={buildTitle()} template={template} />
    </>
  );
}
