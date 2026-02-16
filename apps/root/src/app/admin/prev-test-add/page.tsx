'use client';

import { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface FileInfo {
  id: number;
  name: string;
  file_type: string;
}

// 과목명 판별용 키워드
const KNOWN_SECTIONS = [
  '국어', '국어1', '국어2', '문법', '문학', '독서',
  '화법과 작문', '독서와 문법', '화작', '언매', '고전',
  '언어와 매체', '독서와문법',
];

/**
 * 파일명 패턴 자동 파싱
 *
 * 지원 패턴:
 *  - [출판사 과목]학교YY년N학기중간/기말...
 *  - [과목-출판사][YYYY] 학교 N학년 N학기 중간/기말
 *  - 학교N YYYY학년도 N학기 N차 지필평가 (과목)
 *  - YYYY 학교N N학기 중간/기말고사 (과목)
 *  - 학교N_YYYY N학기 중간/기말고사(과목-출판사)
 *  - YYYY 학교 N-N 중간/기말
 *  - 과목[출판사]학교YY년N학기중간/기말
 *  - YYYY학년도 학교N N학기 N차 지필평가_과목
 *  - YYYY-N 학교 중간/기말고사(출판사)
 *  등 다양한 형식 지원
 */
function parseFileName(fileName: string) {
  const result: {
    publisher?: string;
    section?: string;
    schoolName?: string;
    year?: string;
    term?: string;
    testType?: string;
  } = {};

  const baseName = fileName.replace(/\.\w+$/, '');

  // ── Pattern 0: [과목-출판사][YYYY] 학교 N학년 N학기 중간/기말 (이중 대괄호) ──
  const p0 = baseName.match(
    /^\[([^\]]+)\]\[(\d{4})\]\s*([가-힣]+)\s+(\d)학년[-\s]*(\d)학기[-\s]*(중간|기말)/
  );
  if (p0) {
    const parts = p0[1].split(/[-–]/);
    if (parts.length >= 2) {
      result.section = parts[0].trim();
      result.publisher = parts[1].trim();
    } else {
      result.section = p0[1].trim();
    }
    result.year = p0[2];
    result.schoolName = p0[3];
    result.term = p0[5];
    result.testType = p0[6] === '중간' ? '1' : '2';
    return result;
  }

  // ── Pattern 1: [출판사 과목]학교YY년N학기중간/기말 ──
  const bracketMatch = baseName.match(/^\[([^\]]+)\](.*)/);
  if (bracketMatch) {
    const bracketContent = bracketMatch[1].trim();
    const afterBracket = bracketMatch[2].trim();

    const spaceIdx = bracketContent.indexOf(' ');
    if (spaceIdx > 0) {
      result.publisher = bracketContent.substring(0, spaceIdx);
      result.section = bracketContent.substring(spaceIdx + 1).trim();
    } else {
      result.publisher = bracketContent;
    }

    const mainMatch = afterBracket.match(
      /^(.+?)(\d{2,4})\s*년\s*(\d)\s*학기\s*(중간|기말)/
    );
    if (mainMatch) {
      let parsedSchool = mainMatch[1].trim();
      const gradeInName = parsedSchool.match(/^(.*[가-힣])(\d)$/);
      if (gradeInName) parsedSchool = gradeInName[1].trim();
      if (parsedSchool) result.schoolName = parsedSchool;

      let y = parseInt(mainMatch[2]);
      if (y < 100) y += 2000;
      result.year = String(y);
      result.term = mainMatch[3];
      result.testType = mainMatch[4] === '중간' ? '1' : '2';
    }
    return result;
  }

  // ── Pattern 2: 학교N YYYY학년도 N학기 N차 지필평가 (과목) ──
  const p2 = baseName.match(
    /^([가-힣]+)(\d)\s+(\d{4})학년도\s+(\d)학기\s+(\d)차\s+지필평가/
  );
  if (p2) {
    result.schoolName = p2[1];
    result.year = p2[3];
    result.term = p2[4];
    result.testType = p2[5] === '1' ? '1' : '2';
    const afterTest = baseName.substring(baseName.indexOf('지필평가') + 4);
    const parenMatches = afterTest.match(/\(([^)]+)\)/g);
    if (parenMatches) {
      for (const pm of parenMatches) {
        const content = pm.slice(1, -1).trim();
        if (KNOWN_SECTIONS.some((s) => content.includes(s))) {
          result.section = content;
          break;
        }
      }
    }
    return result;
  }

  // ── Pattern 3: 25년1학기기말상일고1학년 (년도가 앞에 오는 형식) ──
  const p3 = baseName.match(
    /(\d{2,4})\s*년\s*(\d)\s*학기\s*(중간|기말)\s*([가-힣]+?)(\d)\s*학년/
  );
  if (p3) {
    let y = parseInt(p3[1]);
    if (y < 100) y += 2000;
    result.year = String(y);
    result.term = p3[2];
    result.testType = p3[3] === '중간' ? '1' : '2';
    result.schoolName = p3[4];
    return result;
  }

  // ── Pattern 4: "2018 상동고1 2학기 중간고사 (문학)" ──
  const p4 = baseName.match(
    /^(\d{4})\s+([가-힣]+)(\d)\s+(\d)학기\s+(중간|기말)고사(?:\s*\(([^)]+)\))?/
  );
  if (p4) {
    result.year = p4[1];
    result.schoolName = p4[2];
    result.term = p4[4];
    result.testType = p4[5] === '중간' ? '1' : '2';
    const candidate = p4[6]?.trim();
    if (candidate && KNOWN_SECTIONS.some((s) => candidate.includes(s))) {
      result.section = candidate;
    }
    return result;
  }

  // ── Pattern 5: "학교N_YYYY N학기 기말고사(과목-출판사)" ──
  const p5 = baseName.match(
    /^([가-힣]+)(\d)[_\s]+(\d{4})\s+(\d)학기\s+(중간|기말)고사/
  );
  if (p5) {
    result.schoolName = p5[1];
    result.year = p5[3];
    result.term = p5[4];
    result.testType = p5[5] === '중간' ? '1' : '2';
    const extraMatch = baseName.match(/[(\[](.*?)[)\]]/g);
    if (extraMatch) {
      for (const em of extraMatch) {
        const inner = em.slice(1, -1).trim();
        const innerParts = inner.split(/[-–]/);
        for (const part of innerParts) {
          const p = part.trim();
          if (KNOWN_SECTIONS.some((s) => p.includes(s))) {
            result.section = p;
          } else if (p.length >= 2) {
            result.publisher = p;
          }
        }
      }
    }
    return result;
  }

  // ── Pattern 5b: "학교N_N학기_기말시험지" ──
  const p5b = baseName.match(
    /^([가-힣]+)(\d)[_](\d)학기[_](중간|기말)시험지/
  );
  if (p5b) {
    result.schoolName = p5b[1];
    result.term = p5b[3];
    result.testType = p5b[4] === '중간' ? '1' : '2';
    return result;
  }

  // ── Pattern 6: "YYYY 소명여고 N-N 중간/기말" ──
  const p6 = baseName.match(
    /^(\d{4})\s+([가-힣]+)\s+(\d)-(\d)\s+(중간|기말)/
  );
  if (p6) {
    result.year = p6[1];
    result.schoolName = p6[2];
    result.term = p6[4];
    result.testType = p6[5] === '중간' ? '1' : '2';
    return result;
  }

  // ── Pattern 7: "학교N YYYY 학년도 N학기 N차 지필평가" (년도 뒤 공백) ──
  const p7 = baseName.match(
    /^([가-힣]+)(\d)\s+(\d{4})\s+학년도\s+(\d)학기\s+(\d)차\s+지필평가/
  );
  if (p7) {
    result.schoolName = p7[1];
    result.year = p7[3];
    result.term = p7[4];
    result.testType = p7[5] === '1' ? '1' : '2';
    const afterTest = baseName.substring(baseName.indexOf('지필평가') + 4);
    const parenMatches = afterTest.match(/\(([^)]+)\)/g);
    if (parenMatches) {
      for (const pm of parenMatches) {
        const content = pm.slice(1, -1).trim();
        if (KNOWN_SECTIONS.some((s) => content.includes(s))) {
          result.section = content;
          break;
        }
      }
    }
    return result;
  }

  // ── Pattern 8: "화법[수특]소명여고25년1학기기말" (과목이 대괄호 앞) ──
  const p8 = baseName.match(
    /^([가-힣]+)\[([^\]]+)\]([가-힣]+?)(\d{2,4})\s*년\s*(\d)\s*학기\s*(중간|기말)/
  );
  if (p8) {
    result.section = p8[1];
    result.publisher = p8[2];
    result.schoolName = p8[3];
    let y = parseInt(p8[4]);
    if (y < 100) y += 2000;
    result.year = String(y);
    result.term = p8[5];
    result.testType = p8[6] === '중간' ? '1' : '2';
    return result;
  }

  // ── Pattern 9: "YYYY학년도 학교N N학기 N차 지필평가_과목" ──
  const p9 = baseName.match(
    /^(\d{4})학년도\s+([가-힣]+)(\d)\s+(\d)학기\s+(\d)차\s+지필평가[_]?(\S*)/
  );
  if (p9) {
    result.year = p9[1];
    result.schoolName = p9[2];
    result.term = p9[4];
    result.testType = p9[5] === '1' ? '1' : '2';
    const suffix = p9[6]?.trim();
    if (suffix && KNOWN_SECTIONS.some((s) => suffix.includes(s))) {
      result.section = suffix;
    }
    return result;
  }

  // ── Pattern 11: "2018-2 정명고 중간고사 기출문제(미래엔)" ──
  const p11 = baseName.match(
    /^(\d{4})-(\d)\s+([가-힣]+)\s+(중간|기말)고사/
  );
  if (p11) {
    result.year = p11[1];
    result.term = p11[2];
    result.schoolName = p11[3];
    result.testType = p11[4] === '중간' ? '1' : '2';
    const parenMatch = baseName.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const content = parenMatch[1].trim();
      if (KNOWN_SECTIONS.some((s) => content.includes(s))) {
        result.section = content;
      } else {
        result.publisher = content;
      }
    }
    return result;
  }

  // ── Pattern 12: "상일고2 1학기 중간 시험지 (좋은책신사고 문학)" ──
  const p12 = baseName.match(
    /^([가-힣]+)(\d)\s+(\d)학기\s+(중간|기말)\s*시험지/
  );
  if (p12) {
    result.schoolName = p12[1];
    result.term = p12[3];
    result.testType = p12[4] === '중간' ? '1' : '2';
    const parenMatch = baseName.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const inner = parenMatch[1].trim();
      const innerParts = inner.split(/\s+/);
      if (innerParts.length >= 2) {
        result.publisher = innerParts[0];
        result.section = innerParts.slice(1).join(' ');
      } else if (KNOWN_SECTIONS.some((s) => inner.includes(s))) {
        result.section = inner;
      } else {
        result.publisher = inner;
      }
    }
    return result;
  }

  return result;
}

function PrevTestAddContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const metaId = searchParams.get('metaId');
  const regionParam = searchParams.get('region') || '부천';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [existingFiles, setExistingFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const [form, setForm] = useState({
    schoolName: '',
    year: String(new Date().getFullYear()),
    term: '1',
    testType: '1',
    publisher: '',
    section: '',
  });

  // 수정 모드: 기존 데이터 불러오기
  useEffect(() => {
    if (!metaId) return;
    setFetching(true);
    fetch(`/api/admin/prev-test?metaId=${metaId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.meta) {
          setForm({
            schoolName: data.meta.school_name || '',
            year: String(data.meta.year || new Date().getFullYear()),
            term: String(data.meta.term || '1'),
            testType: String(data.meta.test_type || '1'),
            publisher: data.meta.publisher || '',
            section: data.meta.section || '',
          });
        }
        if (data.files) setExistingFiles(data.files);
      })
      .catch(() => alert('데이터 조회 중 오류가 발생했습니다.'))
      .finally(() => setFetching(false));
  }, [metaId]);

  // 파일 선택 시 파일명 자동 파싱
  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    const parsed = parseFileName(selectedFile.name);
    setForm((prev) => ({
      ...prev,
      ...(parsed.publisher !== undefined && { publisher: parsed.publisher }),
      ...(parsed.section !== undefined && { section: parsed.section }),
      ...(parsed.schoolName !== undefined && { schoolName: parsed.schoolName }),
      ...(parsed.year !== undefined && { year: parsed.year }),
      ...(parsed.term !== undefined && { term: parsed.term }),
      ...(parsed.testType !== undefined && { testType: parsed.testType }),
    }));
  }, []);

  const handleFileRemove = useCallback(() => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Drag & Drop 핸들러
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect]
  );

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 저장
  const handleSubmit = async () => {
    if (!file && !metaId) {
      alert('파일을 선택해주세요.');
      return;
    }
    if (!form.schoolName.trim()) {
      alert('학교명을 입력하세요.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      if (metaId) formData.append('metaId', metaId);
      formData.append('region', regionParam);
      formData.append('school_type', '');
      formData.append('school_name', form.schoolName);
      formData.append('year', form.year);
      formData.append('grade', '');
      formData.append('term', form.term);
      formData.append('test_type', form.testType);
      formData.append('section', form.section);
      formData.append('publisher', form.publisher);

      let fileType = 'HWP';
      if (file) {
        if (file.name.toLowerCase().endsWith('.pdf')) fileType = 'PDF';
        formData.append('formFile', file);
      }
      formData.append('fileType', fileType);

      const res = await fetch('/api/admin/prev-test', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        alert(`저장 실패: ${data.error}`);
      } else {
        alert('저장되었습니다.');
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (!metaId) {
          setForm({
            schoolName: '',
            year: String(new Date().getFullYear()),
            term: '1',
            testType: '1',
            publisher: '',
            section: '',
          });
        } else {
          router.refresh();
        }
      }
    } catch {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    if (!confirm('파일을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/admin/prev-test/file-delete?id=${fileId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.error) {
        alert(`삭제 실패: ${data.error}`);
      } else {
        setExistingFiles((prev) => prev.filter((f) => f.id !== fileId));
      }
    } catch {
      alert('파일 삭제 중 오류가 발생했습니다.');
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - 2010 + 1 },
    (_, i) => currentYear - i
  );

  if (fetching) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h4 className="mb-3">
        {metaId ? '기출문제 관리' : `${regionParam === '부천' ? '부천' : '타지역'} 기출문제 추가`}
      </h4>

      {/* ── 파일 첨부 (드래그 앤 드롭) ── */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? '#007bff' : '#ced4da'}`,
          borderRadius: '8px',
          padding: file ? '20px' : '40px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDragging ? '#e7f1ff' : file ? '#f8f9fa' : '#fff',
          transition: 'border-color 0.2s, background-color 0.2s',
          marginBottom: '20px',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          accept=".hwp,.hwpx,.pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelect(f);
          }}
        />

        {file ? (
          <div>
            <div className="font-weight-bold" style={{ fontSize: '16px' }}>
              {file.name}
            </div>
            <div className="text-muted small mb-2">
              {(file.size / 1024).toFixed(1)} KB
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={(e) => {
                e.stopPropagation();
                handleFileRemove();
              }}
            >
              파일 제거
            </button>
          </div>
        ) : (
          <div>
            <div
              style={{
                fontSize: '32px',
                color: isDragging ? '#007bff' : '#adb5bd',
                marginBottom: '8px',
                lineHeight: 1,
              }}
            >
              +
            </div>
            <div className="text-muted">
              파일을 드래그하여 놓거나 클릭하여 선택하세요
            </div>
            <div className="text-muted small mt-1">HWP, PDF 파일 지원</div>
          </div>
        )}
      </div>

      {/* ── 기출문제 정보 입력 ── */}
      <div className="card mb-3">
        <div className="card-body">
          {/* 학교명 / 년도 */}
          <div className="row">
            <div className="col-md-6 form-group">
              <label className="font-weight-bold">학교명</label>
              <input
                type="text"
                className="form-control"
                name="schoolName"
                value={form.schoolName}
                onChange={handleInputChange}
                placeholder="학교명"
              />
            </div>
            <div className="col-md-6 form-group">
              <label className="font-weight-bold">년도</label>
              <select
                className="form-control"
                name="year"
                value={form.year}
                onChange={handleInputChange}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 학기 / 중간·기말 */}
          <div className="row">
            <div className="col-md-6 form-group">
              <label className="font-weight-bold">학기</label>
              <div>
                <div className="btn-group" role="group">
                  <button
                    type="button"
                    className={`btn ${form.term === '1' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() =>
                      setForm((prev) => ({ ...prev, term: '1' }))
                    }
                  >
                    1학기
                  </button>
                  <button
                    type="button"
                    className={`btn ${form.term === '2' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() =>
                      setForm((prev) => ({ ...prev, term: '2' }))
                    }
                  >
                    2학기
                  </button>
                </div>
              </div>
            </div>
            <div className="col-md-6 form-group">
              <label className="font-weight-bold">시험유형</label>
              <div>
                <div className="btn-group" role="group">
                  <button
                    type="button"
                    className={`btn ${form.testType === '1' ? 'btn-success' : 'btn-outline-success'}`}
                    onClick={() =>
                      setForm((prev) => ({ ...prev, testType: '1' }))
                    }
                  >
                    중간고사
                  </button>
                  <button
                    type="button"
                    className={`btn ${form.testType === '2' ? 'btn-success' : 'btn-outline-success'}`}
                    onClick={() =>
                      setForm((prev) => ({ ...prev, testType: '2' }))
                    }
                  >
                    기말고사
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 출판사 / 과목명 */}
          <div className="row">
            <div className="col-md-6 form-group">
              <label className="font-weight-bold">출판사</label>
              <input
                type="text"
                className="form-control"
                name="publisher"
                value={form.publisher}
                onChange={handleInputChange}
                placeholder="출판사"
                list="publisher-list"
              />
              <datalist id="publisher-list">
                <option value="미래엔" />
                <option value="미래엔(신)" />
                <option value="비상(박)" />
                <option value="비상(박안)" />
                <option value="천재(박)" />
                <option value="창비" />
                <option value="동아" />
                <option value="지학사" />
                <option value="신사고" />
                <option value="신사고(민)" />
              </datalist>
            </div>
            <div className="col-md-6 form-group">
              <label className="font-weight-bold">과목명</label>
              <input
                type="text"
                className="form-control"
                name="section"
                value={form.section}
                onChange={handleInputChange}
                placeholder="과목명"
                list="section-list"
              />
              <datalist id="section-list">
                <option value="국어" />
                <option value="국어1" />
                <option value="국어2" />
                <option value="문법" />
                <option value="문학" />
                <option value="언매" />
                <option value="고전" />
              </datalist>
            </div>
          </div>

        </div>
      </div>

      {/* ── 기존 등록 파일 (수정 모드) ── */}
      {existingFiles.length > 0 && (
        <div className="card mb-3">
          <div className="card-header py-2">
            <strong>등록된 파일 ({existingFiles.length}개)</strong>
          </div>
          <div className="card-body p-0">
            <table className="table table-sm mb-0">
              <tbody>
                {existingFiles.map((f) => (
                  <tr key={f.id}>
                    <td className="align-middle">{f.name}</td>
                    <td style={{ width: '150px' }} className="text-right">
                      <a
                        href={`/api/admin/prev-test/download?id=${f.id}`}
                        className="btn btn-sm btn-outline-info mr-1"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        다운로드
                      </a>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDeleteFile(f.id)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 버튼 ── */}
      <div className="mt-3">
        <button
          type="button"
          className="btn btn-primary btn-lg mr-2"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '저장 중...' : metaId ? '수정 및 파일추가' : '추가'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-lg"
          onClick={() => router.push(`/admin/prev-test-dashboard?region=${regionParam}`)}
        >
          목록으로
        </button>
      </div>
    </div>
  );
}

export default function PrevTestAddPage() {
  return (
    <Suspense fallback={<div>로딩중...</div>}>
      <PrevTestAddContent />
    </Suspense>
  );
}
