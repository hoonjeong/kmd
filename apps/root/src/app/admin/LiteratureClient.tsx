'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSSEGeneration } from '@/hooks/useSSEGeneration';
import GenerationResultCard from '@/components/GenerationResultCard';
import { FilterCheckbox, GenerationOptions, UserNotesField, GenerateButtons } from '@/components/GenerationForm';

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
  initialTotalCount: number;
  isAdmin?: boolean;
  onGenerated?: () => void;
  onGenerationComplete?: (data: GenerationCompleteData) => void;
}

export default function LiteratureClient({
  userName, initialTotalCount, isAdmin, onGenerated, onGenerationComplete,
}: Props) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [count, setCount] = useState(3);
  const [difficulty, setDifficulty] = useState('중');
  const [userNotes, setUserNotes] = useState('');
  const [template, setTemplate] = useState<'SAMPLE' | 'SAMPLE2'>('SAMPLE2');

  const [grades, setGrades] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('');
  const [publishers, setPublishers] = useState<string[]>([]);
  const [selectedPublisher, setSelectedPublisher] = useState('');

  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [countLoading, setCountLoading] = useState(false);
  const [filtersActivated, setFiltersActivated] = useState(false);

  const [authorWorks, setAuthorWorks] = useState<{ title: string; category: string; fileCount: number }[] | null>(null);
  const [authorWorksLoading, setAuthorWorksLoading] = useState(false);

  const { status, generatedText, error, generate, reset: resetGeneration } = useSSEGeneration();
  const fetchSeqRef = useRef(0);

  useEffect(() => { fetchFilters({}); }, []);

  const fetchFilters = useCallback(async (opts: {
    gradeVal?: string; publisherVal?: string; titleVal?: string; authorVal?: string;
  }) => {
    const seq = ++fetchSeqRef.current;
    setCountLoading(true);
    const sp = new URLSearchParams();
    if (opts.gradeVal) sp.set('grade', opts.gradeVal);
    if (opts.publisherVal) sp.set('publisher', opts.publisherVal);
    if (opts.titleVal) sp.set('title', opts.titleVal);
    if (opts.authorVal) sp.set('author', opts.authorVal);
    const qs = sp.toString();

    try {
      const res = await fetch(`/api/admin/literature/filters${qs ? '?' + qs : ''}`);
      if (seq !== fetchSeqRef.current) return;
      if (!res.ok) return;
      const data = await res.json();
      setGrades(data.grades || []);
      setPublishers(data.publishers || []);
      setTotalCount(data.totalCount ?? 0);
    } catch { /* ignore */ } finally {
      if (seq === fetchSeqRef.current) setCountLoading(false);
    }
  }, []);

  const titleRef = useRef(title); titleRef.current = title;
  const authorRef = useRef(author); authorRef.current = author;
  const selectedGradeRef = useRef(selectedGrade); selectedGradeRef.current = selectedGrade;
  const selectedPublisherRef = useRef(selectedPublisher); selectedPublisherRef.current = selectedPublisher;

  function refreshCount() {
    setFiltersActivated(true);
    fetchFilters({
      gradeVal: selectedGradeRef.current || undefined,
      publisherVal: selectedPublisherRef.current || undefined,
      titleVal: titleRef.current.trim() || undefined,
      authorVal: authorRef.current.trim() || undefined,
    });
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (title.trim() || author.trim() || selectedGradeRef.current || selectedPublisherRef.current) {
        refreshCount();
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [title, author]);

  function handleGradeChange(grade: string) {
    const val = selectedGrade === grade ? '' : grade;
    setSelectedGrade(val); setSelectedPublisher('');
    selectedGradeRef.current = val; selectedPublisherRef.current = '';
    refreshCount();
  }

  function handlePublisherChange(pub: string) {
    const val = selectedPublisher === pub ? '' : pub;
    setSelectedPublisher(val); selectedPublisherRef.current = val;
    refreshCount();
  }

  // 작가명만 입력 시 참고 작품 자동 검색
  const authorDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const authorWorksSeqRef = useRef(0);
  useEffect(() => {
    if (authorDebounceRef.current) clearTimeout(authorDebounceRef.current);
    const authorVal = author.trim();
    const titleVal = title.trim();
    if (!authorVal || titleVal) { setAuthorWorks(null); return; }
    authorDebounceRef.current = setTimeout(async () => {
      const seq = ++authorWorksSeqRef.current;
      setAuthorWorksLoading(true);
      try {
        const res = await fetch(`/api/admin/literature/author-works?author=${encodeURIComponent(authorVal)}`);
        if (seq !== authorWorksSeqRef.current) return;
        if (!res.ok) { setAuthorWorks(null); return; }
        const data = await res.json();
        setAuthorWorks(data.works || []);
      } catch {
        if (seq === authorWorksSeqRef.current) setAuthorWorks(null);
      } finally {
        if (seq === authorWorksSeqRef.current) setAuthorWorksLoading(false);
      }
    }, 600);
    return () => { if (authorDebounceRef.current) clearTimeout(authorDebounceRef.current); };
  }, [author, title]);

  function handleReset() {
    setTitle(''); setAuthor(''); setSelectedGrade(''); setSelectedPublisher('');
    setCount(3); setDifficulty('중'); setUserNotes('');
    setAuthorWorks(null); setFiltersActivated(false);
    resetGeneration();
    fetchFilters({});
  }

  function handleGenerate() {
    generate('/api/admin/literature/generate', {
      title: title.trim() || undefined, author: author.trim() || undefined,
      grade: selectedGrade || undefined, publisher: selectedPublisher || undefined,
      difficulty, count, userNotes: userNotes.trim() || undefined,
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
          category: '문학', title: buildTitle(), generatedText,
          requestParams: { title: title.trim() || undefined, author: author.trim() || undefined, grade: selectedGrade || undefined, publisher: selectedPublisher || undefined },
          difficulty, questionCount: count, template,
        });
      }
    }
  }, [status]);

  return (
    <>
      <div className="card mb-3">
        <div className="card-body">
          <div className="form-group" style={{ marginBottom: 22 }}>
            <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>작품명</label>
            <input type="text" className="form-control" value={title}
              onChange={e => setTitle(e.target.value)} placeholder="사미인곡, 봄봄, 홍길동전 등" disabled={isGenerating} />
          </div>

          <div className="form-group" style={{ marginBottom: 22 }}>
            <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>작가명</label>
            <input type="text" className="form-control" value={author}
              onChange={e => setAuthor(e.target.value)} placeholder="정철, 김소월, 윤동주 등" disabled={isGenerating} />
          </div>

          {/* 작가명만 입력 시 참고 작품 목록 */}
          {!title.trim() && author.trim() && (authorWorksLoading || authorWorks !== null) && (
            <div style={{ marginBottom: 22, padding: 12, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0369a1', marginBottom: 8 }}>
                {authorWorksLoading ? (
                  <><span className="spinner-border spinner-border-sm" role="status" style={{ width: 12, height: 12, borderWidth: 2, marginRight: 6 }} />참고 작품 검색 중...</>
                ) : <>참고 작품 ({authorWorks?.length || 0}건)</>}
              </div>
              {!authorWorksLoading && authorWorks && authorWorks.length === 0 && (
                <div style={{ fontSize: 13, color: '#64748b' }}>해당 작가의 참고 작품이 없습니다.</div>
              )}
              {!authorWorksLoading && authorWorks && authorWorks.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {authorWorks.map((w, idx) => (
                    <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 8px', fontSize: 13 }}>
                      <span style={{ color: '#0369a1', fontSize: 11, fontWeight: 600 }}>{w.category || '문학'}</span>
                      <span style={{ fontWeight: 500, color: '#1e293b' }}>{w.title}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>({w.fileCount})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <FilterCheckbox label="학년" items={grades} selected={selectedGrade} onChange={handleGradeChange} disabled={isGenerating} />
          <FilterCheckbox label="출판사" items={publishers} selected={selectedPublisher} onChange={handlePublisherChange} disabled={isGenerating} />
          <GenerationOptions count={count} setCount={setCount} difficulty={difficulty} setDifficulty={setDifficulty}
            template={template} setTemplate={setTemplate} radioName="lit-difficulty" disabled={isGenerating} />
          <UserNotesField value={userNotes} onChange={setUserNotes} disabled={isGenerating} />
          <GenerateButtons onGenerate={handleGenerate} onReset={handleReset} isGenerating={isGenerating}
            canGenerate={true} filtersActivated={filtersActivated} totalCount={totalCount} countLoading={countLoading} />
        </div>
      </div>

      {error && <div className="alert alert-danger"><strong>오류:</strong> {error}</div>}
      <GenerationResultCard status={status} generatedText={generatedText} title={buildTitle()} template={template} />
    </>
  );
}
