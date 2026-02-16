'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface Props {
  years: number[];
  sections: string[];
  publishers: string[];
  schools: string[];
  region: string;
}

export default function DashboardFilters({
  years,
  sections,
  publishers,
  schools,
  region,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedYears = searchParams.get('year')?.split(',').filter(Boolean) || [];
  const selectedSections = searchParams.get('section')?.split(',').filter(Boolean) || [];
  const selectedPublishers = searchParams.get('publisher')?.split(',').filter(Boolean) || [];
  const selectedTerms = searchParams.get('term')?.split(',').filter(Boolean) || [];
  const selectedTestTypes = searchParams.get('test_type')?.split(',').filter(Boolean) || [];
  const selectedSchool = searchParams.get('school') || '';
  const search = searchParams.get('search') || '';

  const updateUrl = useCallback(
    (key: string, values: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('region', region);
      if (values.length > 0) {
        params.set(key, values.join(','));
      } else {
        params.delete(key);
      }
      const qs = params.toString();
      router.replace(`/admin/prev-test-dashboard?${qs}`);
    },
    [router, searchParams, region]
  );

  const toggleCheckbox = (key: string, value: string, current: string[]) => {
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateUrl(key, next);
  };

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('region', region);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const qs = params.toString();
    router.replace(`/admin/prev-test-dashboard?${qs}`);
  };

  return (
    <div>
      {/* 연도 체크박스 */}
      <div className="mb-2">
        <span className="mr-2 font-weight-bold">연도:</span>
        <label
          className="d-inline-flex align-items-center mr-3"
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <input
            type="checkbox"
            className="mr-1"
            checked={selectedYears.length === 0}
            onChange={() => updateUrl('year', [])}
          />
          전체
        </label>
        {years.map((y) => {
          const val = String(y);
          const checked = selectedYears.includes(val);
          return (
            <label
              key={y}
              className="d-inline-flex align-items-center mr-3"
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <input
                type="checkbox"
                className="mr-1"
                checked={checked}
                onChange={() => toggleCheckbox('year', val, selectedYears)}
              />
              {y}
            </label>
          );
        })}
      </div>

      {/* 과목 체크박스 */}
      <div className="mb-2">
        <span className="mr-2 font-weight-bold">과목:</span>
        <label
          className="d-inline-flex align-items-center mr-3"
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <input
            type="checkbox"
            className="mr-1"
            checked={selectedSections.length === 0}
            onChange={() => updateUrl('section', [])}
          />
          전체
        </label>
        {sections.map((s) => {
          const checked = selectedSections.includes(s);
          return (
            <label
              key={s}
              className="d-inline-flex align-items-center mr-3"
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <input
                type="checkbox"
                className="mr-1"
                checked={checked}
                onChange={() => toggleCheckbox('section', s, selectedSections)}
              />
              {s}
            </label>
          );
        })}
      </div>

      {/* 학기 체크박스 */}
      <div className="mb-2">
        <span className="mr-2 font-weight-bold">학기:</span>
        <label
          className="d-inline-flex align-items-center mr-3"
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <input
            type="checkbox"
            className="mr-1"
            checked={selectedTerms.length === 0}
            onChange={() => updateUrl('term', [])}
          />
          전체
        </label>
        {['1', '2'].map((t) => {
          const checked = selectedTerms.includes(t);
          return (
            <label
              key={t}
              className="d-inline-flex align-items-center mr-3"
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <input
                type="checkbox"
                className="mr-1"
                checked={checked}
                onChange={() => toggleCheckbox('term', t, selectedTerms)}
              />
              {t}학기
            </label>
          );
        })}
      </div>

      {/* 중간/기말 체크박스 */}
      <div className="mb-2">
        <span className="mr-2 font-weight-bold">중간/기말:</span>
        <label
          className="d-inline-flex align-items-center mr-3"
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <input
            type="checkbox"
            className="mr-1"
            checked={selectedTestTypes.length === 0}
            onChange={() => updateUrl('test_type', [])}
          />
          전체
        </label>
        {[{ val: '1', label: '중간' }, { val: '2', label: '기말' }].map((tt) => {
          const checked = selectedTestTypes.includes(tt.val);
          return (
            <label
              key={tt.val}
              className="d-inline-flex align-items-center mr-3"
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <input
                type="checkbox"
                className="mr-1"
                checked={checked}
                onChange={() => toggleCheckbox('test_type', tt.val, selectedTestTypes)}
              />
              {tt.label}
            </label>
          );
        })}
      </div>

      {/* 출판사 체크박스 */}
      <div className="mb-3">
        <span className="mr-2 font-weight-bold">출판사:</span>
        <label
          className="d-inline-flex align-items-center mr-3"
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <input
            type="checkbox"
            className="mr-1"
            checked={selectedPublishers.length === 0}
            onChange={() => updateUrl('publisher', [])}
          />
          전체
        </label>
        {publishers.map((p) => {
          const checked = selectedPublishers.includes(p);
          return (
            <label
              key={p}
              className="d-inline-flex align-items-center mr-3"
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <input
                type="checkbox"
                className="mr-1"
                checked={checked}
                onChange={() =>
                  toggleCheckbox('publisher', p, selectedPublishers)
                }
              />
              {p}
            </label>
          );
        })}
      </div>

      {/* 파일명 검색 + 학교 선택 */}
      <div className="row mb-3">
        <div className="col-md-4">
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder="파일명 검색"
              defaultValue={search}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setParam('search', (e.target as HTMLInputElement).value);
                }
              }}
            />
            <div className="input-group-append">
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={(e) => {
                  const input = (e.target as HTMLElement)
                    .closest('.input-group')
                    ?.querySelector('input') as HTMLInputElement;
                  setParam('search', input?.value || '');
                }}
              >
                검색
              </button>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <select
            className="form-control"
            value={selectedSchool}
            onChange={(e) => setParam('school', e.target.value)}
          >
            <option value="">학교 전체</option>
            {schools.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
