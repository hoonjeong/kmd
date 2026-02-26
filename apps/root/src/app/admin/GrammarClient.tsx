'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSSEGeneration } from '@/hooks/useSSEGeneration';
import GenerationResultCard from '@/components/GenerationResultCard';
import { FilterCheckbox, GenerationOptions, UserNotesField, GenerateButtons } from '@/components/GenerationForm';

import type { GenerationCompleteData } from './LiteratureClient';

interface Props {
  userName: string;
  initialTotalCount: number;
  isAdmin?: boolean;
  onGenerated?: () => void;
  onGenerationComplete?: (data: GenerationCompleteData) => void;
}

export default function GrammarClient({ userName, initialTotalCount, isAdmin, onGenerated, onGenerationComplete }: Props) {
  const [keyword, setKeyword] = useState('');
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

  const { status, generatedText, error, generate, reset: resetGeneration } = useSSEGeneration();
  const fetchSeqRef = useRef(0);

  useEffect(() => { loadGradePublisher(); }, []);

  async function loadGradePublisher(grade?: string) {
    try {
      const sp = grade ? `?grade=${encodeURIComponent(grade)}` : '';
      const res = await fetch(`/api/admin/grammar/filters${sp}`);
      if (!res.ok) return;
      const data = await res.json();
      setGrades(data.grades || []);
      setPublishers(data.publishers || []);
    } catch { /* ignore */ }
  }

  const fetchCount = useCallback(async (kw: string, grade?: string, publisher?: string) => {
    const seq = ++fetchSeqRef.current;
    setCountLoading(true);
    try {
      const res = await fetch('/api/admin/grammar/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: kw || undefined, grade: grade || undefined, publisher: publisher || undefined }),
      });
      if (seq !== fetchSeqRef.current) return;
      if (!res.ok) return;
      const data = await res.json();
      setTotalCount(data.totalCount ?? 0);
    } catch { /* ignore */ } finally {
      if (seq === fetchSeqRef.current) setCountLoading(false);
    }
  }, []);

  const keywordRef = useRef(keyword);
  keywordRef.current = keyword;
  const selectedGradeRef = useRef(selectedGrade);
  selectedGradeRef.current = selectedGrade;
  const selectedPublisherRef = useRef(selectedPublisher);
  selectedPublisherRef.current = selectedPublisher;

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (keyword.trim() || selectedGradeRef.current || selectedPublisherRef.current) {
        setFiltersActivated(true);
        fetchCount(keyword.trim(), selectedGradeRef.current, selectedPublisherRef.current);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [keyword]);

  function handleGradeChange(grade: string) {
    const val = selectedGrade === grade ? '' : grade;
    setSelectedGrade(val);
    setSelectedPublisher('');
    selectedGradeRef.current = val;
    selectedPublisherRef.current = '';
    setFiltersActivated(true);
    fetchCount(keywordRef.current.trim(), val, '');
    loadGradePublisher(val || undefined);
  }

  function handlePublisherChange(pub: string) {
    const val = selectedPublisher === pub ? '' : pub;
    setSelectedPublisher(val);
    selectedPublisherRef.current = val;
    setFiltersActivated(true);
    fetchCount(keywordRef.current.trim(), selectedGradeRef.current, val);
  }

  function handleReset() {
    setKeyword(''); setSelectedGrade(''); setSelectedPublisher('');
    setCount(3); setDifficulty('중'); setUserNotes('');
    setFiltersActivated(false);
    resetGeneration();
    loadGradePublisher();
  }

  function handleGenerate() {
    if (!keyword.trim()) return;
    generate('/api/admin/grammar/generate', {
      keyword: keyword.trim(),
      grade: selectedGrade || undefined,
      publisher: selectedPublisher || undefined,
      difficulty, count,
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
          category: '문법', title: downloadTitle, generatedText,
          requestParams: { keyword: keyword.trim() || undefined, grade: selectedGrade || undefined, publisher: selectedPublisher || undefined },
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
            <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>세부영역 검색</label>
            <input type="text" className="form-control" value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="음운변동, 품사, 문장성분 등" disabled={isGenerating} />
          </div>

          <FilterCheckbox label="학년" items={grades} selected={selectedGrade} onChange={handleGradeChange} disabled={isGenerating} />
          <FilterCheckbox label="출판사" items={publishers} selected={selectedPublisher} onChange={handlePublisherChange} disabled={isGenerating} />
          <GenerationOptions count={count} setCount={setCount} difficulty={difficulty} setDifficulty={setDifficulty}
            template={template} setTemplate={setTemplate} radioName="gram-difficulty" disabled={isGenerating} />
          <UserNotesField value={userNotes} onChange={setUserNotes} disabled={isGenerating} />
          <GenerateButtons onGenerate={handleGenerate} onReset={handleReset} isGenerating={isGenerating}
            canGenerate={!!keyword.trim()} filtersActivated={filtersActivated} totalCount={totalCount} countLoading={countLoading} />
        </div>
      </div>

      {error && <div className="alert alert-danger"><strong>오류:</strong> {error}</div>}
      <GenerationResultCard status={status} generatedText={generatedText} title={downloadTitle} template={template} />
    </>
  );
}
