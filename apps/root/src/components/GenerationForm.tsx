'use client';

import { DIFFICULTY_OPTIONS, COUNT_OPTIONS } from '@/lib/constants';

interface FilterCheckboxProps {
  label: string;
  items: string[];
  selected: string;
  onChange: (item: string) => void;
  disabled?: boolean;
}

export function FilterCheckbox({ label, items, selected, onChange, disabled }: FilterCheckboxProps) {
  if (items.length === 0) return null;
  return (
    <div className="form-group" style={{ marginBottom: 22 }}>
      <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>{label}</label>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {items.map(item => (
          <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={selected === item}
              onChange={() => onChange(item)} disabled={disabled} />{item}
          </label>
        ))}
      </div>
    </div>
  );
}

interface GenerationOptionsProps {
  count: number;
  setCount: (n: number) => void;
  difficulty: string;
  setDifficulty: (d: string) => void;
  template: 'SAMPLE' | 'SAMPLE2';
  setTemplate: (t: 'SAMPLE' | 'SAMPLE2') => void;
  radioName: string;
  disabled?: boolean;
}

export function GenerationOptions({
  count, setCount, difficulty, setDifficulty,
  template, setTemplate, radioName, disabled,
}: GenerationOptionsProps) {
  return (
    <div style={{ display: 'flex', gap: 32, marginBottom: 22, flexWrap: 'wrap' }}>
      <div className="form-group" style={{ margin: 0 }}>
        <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>문항 수</label>
        <select className="form-control form-control-sm" value={count}
          onChange={e => setCount(Number(e.target.value))} disabled={disabled} style={{ width: 80 }}>
          {COUNT_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>난이도</label>
        <div style={{ display: 'flex', gap: 16, paddingTop: 4 }}>
          {DIFFICULTY_OPTIONS.map(opt => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 14 }}>
              <input type="radio" name={radioName} value={opt.value}
                checked={difficulty === opt.value} onChange={() => setDifficulty(opt.value)} disabled={disabled} />{opt.label}
            </label>
          ))}
        </div>
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>시험지 양식</label>
        <select className="form-control form-control-sm" value={template}
          onChange={e => setTemplate(e.target.value as 'SAMPLE' | 'SAMPLE2')} disabled={disabled} style={{ width: 220 }}>
          <option value="SAMPLE2">양식 1 (회색 테두리)</option>
          <option value="SAMPLE">양식 2 (청록 테두리)</option>
        </select>
      </div>
    </div>
  );
}

interface UserNotesFieldProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function UserNotesField({ value, onChange, disabled }: UserNotesFieldProps) {
  return (
    <div className="form-group" style={{ marginBottom: 22 }}>
      <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>문제제작 요청사항</label>
      <textarea className="form-control" value={value} onChange={e => onChange(e.target.value)}
        rows={2} placeholder="문제제작에 참고해야할 지침을 넣어주세요." disabled={disabled} />
    </div>
  );
}

interface GenerateButtonsProps {
  onGenerate: () => void;
  onReset: () => void;
  isGenerating: boolean;
  canGenerate: boolean;
  filtersActivated: boolean;
  totalCount: number;
  countLoading: boolean;
}

export function GenerateButtons({
  onGenerate, onReset, isGenerating, canGenerate,
  filtersActivated, totalCount, countLoading,
}: GenerateButtonsProps) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button className="btn btn-primary" onClick={onGenerate}
        disabled={isGenerating || !canGenerate} style={{ fontWeight: 600 }}>
        {isGenerating ? <><span className="spinner-border spinner-border-sm mr-2" role="status" />생성 중...</> : '문제 생성'}
      </button>
      <button className="btn btn-outline-secondary" onClick={onReset} disabled={isGenerating}>초기화</button>
      {filtersActivated && (
        <span style={{ marginLeft: 12, fontSize: 13, color: '#64748b' }}>
          참고 자료 <strong style={{ color: totalCount > 0 ? '#3b82f6' : '#ef4444', fontSize: 14 }}>{totalCount.toLocaleString()}</strong>건
          {countLoading && <span className="spinner-border spinner-border-sm" role="status" style={{ marginLeft: 6, width: 12, height: 12, borderWidth: 2 }} />}
          {totalCount === 0 && !countLoading && (
            <span style={{ marginLeft: 8, color: '#ef4444', fontSize: 12 }}>참고 데이터가 너무 부족합니다. 조건을 다르게 설정해보세요.</span>
          )}
        </span>
      )}
    </div>
  );
}
