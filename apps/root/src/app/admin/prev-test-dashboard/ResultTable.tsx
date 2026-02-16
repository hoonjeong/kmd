'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PrevTestRow {
  id: number;
  school_name: string;
  grade: number;
  year: number;
  term: number;
  test_type: number;
  section: string;
  publisher: string;
  file_type: string;
  file_name: string;
  file_id: number;
}

export default function ResultTable({ testList }: { testList: PrevTestRow[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const router = useRouter();

  const selectableItems = testList.filter((t) => t.file_id);
  const allSelected = selectableItems.length > 0 && selectableItems.every((t) => selectedIds.has(t.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableItems.map((t) => t.id)));
    }
  }

  function toggleOne(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleBulkDownload() {
    if (selectedIds.size === 0) return;
    setDownloading(true);
    try {
      const res = await fetch('/api/admin/prev-test/download-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        alert('다운로드에 실패했습니다.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '기출문제_일괄다운.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      {selectedIds.size > 0 && (
        <div className="mb-2">
          <button
            className="btn btn-success btn-sm"
            onClick={handleBulkDownload}
            disabled={downloading}
          >
            {downloading
              ? '다운로드 중...'
              : `선택한 ${selectedIds.size}개 파일 다운로드`}
          </button>
          <button
            className="btn btn-info btn-sm ml-2"
            onClick={() => {
              const idStr = Array.from(selectedIds).join(',');
              router.push(`/admin/variant-question?ids=${idStr}&source=prev-test`);
            }}
          >
            변형문제 생성
          </button>
        </div>
      )}

      <div className="table-responsive">
        <table className="table table-bordered table-hover table-sm">
          <thead className="thead-dark">
            <tr>
              <th style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={selectableItems.length === 0}
                />
              </th>
              <th>파일명</th>
              <th>학교</th>
              <th style={{ width: '60px' }}>학기</th>
              <th style={{ width: '100px' }}>시험유형</th>
              <th style={{ width: '80px' }}>과목</th>
              <th style={{ width: '100px' }}>출판사</th>
              <th style={{ width: '60px' }}>연도</th>
            </tr>
          </thead>
          <tbody>
            {testList.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-muted py-3">
                  기출문제가 없습니다.
                </td>
              </tr>
            ) : (
              testList.map((t, idx) => (
                <tr key={`${t.id}-${idx}`}>
                  <td>
                    {t.file_id ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(t.id)}
                        onChange={() => toggleOne(t.id)}
                      />
                    ) : null}
                  </td>
                  <td>
                    {t.file_id ? (
                      <a href={`/api/admin/prev-test/download?id=${t.id}`}>
                        {t.file_name}
                      </a>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>{t.school_name}</td>
                  <td>{t.term}학기</td>
                  <td>{t.test_type === 1 ? '중간고사' : '기말고사'}</td>
                  <td>{t.section || '-'}</td>
                  <td>{t.publisher || '-'}</td>
                  <td>{t.year}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-muted">총 {testList.length}건</p>
    </>
  );
}
