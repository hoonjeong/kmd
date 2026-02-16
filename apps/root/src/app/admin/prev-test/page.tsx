import Link from 'next/link';
import { requireAdminSession } from '@/lib/admin-session';
import pool from '@edenschool/common/db';

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
}

export default async function PrevTestPage({
  searchParams,
}: {
  searchParams: Promise<{
    school?: string;
    grade?: string;
    year?: string;
    term?: string;
    test_type?: string;
    section?: string;
  }>;
}) {
  const session = await requireAdminSession();

  const params = await searchParams;
  const { school, grade, year, term, test_type, section } = params;

  let query = `
    SELECT ptm.*,
      (SELECT count(0) FROM prev_test_file_info ptfi WHERE ptfi.info_id=ptm.id) as fileCount
    FROM prev_test_meta_info ptm
    WHERE 1=1
  `;
  const queryParams: any[] = [];

  if (school) {
    query += ' AND ptm.school_name LIKE ?';
    queryParams.push(`%${school}%`);
  }
  if (grade) {
    query += ' AND ptm.grade=?';
    queryParams.push(grade);
  }
  if (year) {
    query += ' AND ptm.year=?';
    queryParams.push(Number(year));
  }
  if (term) {
    query += ' AND ptm.term=?';
    queryParams.push(term);
  }
  if (test_type) {
    query += ' AND ptm.test_type=?';
    queryParams.push(test_type);
  }
  if (section) {
    query += ' AND ptm.section=?';
    queryParams.push(section);
  }

  query += ' ORDER BY ptm.year DESC, ptm.school_name';

  const [rows] = await pool.query(query, queryParams);
  const testList = rows as PrevTestRow[];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2010 + 1 }, (_, i) => currentYear - i);

  function buildUrl(overrides: Record<string, string>) {
    const base: Record<string, string> = {
      school: school || '',
      grade: grade || '',
      year: year || '',
      term: term || '',
      test_type: test_type || '',
      section: section || '',
      ...overrides,
    };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(base)) {
      if (v) sp.set(k, v);
    }
    const qs = sp.toString();
    return qs ? `/admin/prev-test?${qs}` : '/admin/prev-test';
  }

  return (
    <div>
      <h4 className="mb-3">기출문제 검색</h4>

      {/* Search filters */}
      <div className="card mb-3">
        <div className="card-body">
          <form method="get" action="/admin/prev-test">
            <div className="row">
              <div className="col-md-3">
                <div className="form-group">
                  <label>학교명</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="school"
                    defaultValue={school || ''}
                    placeholder="학교명 검색"
                  />
                </div>
              </div>
              <div className="col-md-2">
                <div className="form-group">
                  <label>학년</label>
                  <select className="form-control form-control-sm" name="grade" defaultValue={grade || ''}>
                    <option value="">전체</option>
                    <option value="1">1학년</option>
                    <option value="2">2학년</option>
                    <option value="3">3학년</option>
                  </select>
                </div>
              </div>
              <div className="col-md-2">
                <div className="form-group">
                  <label>연도</label>
                  <select className="form-control form-control-sm" name="year" defaultValue={year || ''}>
                    <option value="">전체</option>
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="col-md-2">
                <div className="form-group">
                  <label>학기</label>
                  <select className="form-control form-control-sm" name="term" defaultValue={term || ''}>
                    <option value="">전체</option>
                    <option value="1">1학기</option>
                    <option value="2">2학기</option>
                  </select>
                </div>
              </div>
              <div className="col-md-2">
                <div className="form-group">
                  <label>시험유형</label>
                  <select className="form-control form-control-sm" name="test_type" defaultValue={test_type || ''}>
                    <option value="">전체</option>
                    <option value="1">중간고사</option>
                    <option value="2">기말고사</option>
                  </select>
                </div>
              </div>
              <div className="col-md-1 d-flex align-items-end">
                <div className="form-group">
                  <button type="submit" className="btn btn-primary btn-sm">검색</button>
                </div>
              </div>
            </div>
            {section && <input type="hidden" name="section" value={section} />}
          </form>

          {/* Section quick filter */}
          <div>
            <span className="mr-2 font-weight-bold">영역:</span>
            <Link
              href={buildUrl({ section: '' })}
              className={`btn btn-sm mr-1 ${!section ? 'btn-info' : 'btn-outline-info'}`}
            >
              전체
            </Link>
            {['국어1', '국어2', '문법', '문학', '언매', '고전', '기타'].map((s) => (
              <Link
                key={s}
                href={buildUrl({ section: s })}
                className={`btn btn-sm mr-1 ${section === s ? 'btn-info' : 'btn-outline-info'}`}
              >
                {s}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Results table */}
      <div className="table-responsive">
        <table className="table table-bordered table-hover table-sm">
          <thead className="text-center">
            <tr>
              <th>학교</th>
              <th>시험</th>
              <th>출판사</th>
              <th>과목</th>
              <th>파일</th>
              <th>다운로드</th>
            </tr>
          </thead>
          <tbody>
            {testList.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-muted py-3">
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              testList.map((t) => (
                <tr key={t.id} className="text-center">
                  <td>{t.school_name}{t.grade}</td>
                  <td>{t.year}년도 {t.term}학기 {t.test_type === 1 ? '중간' : '기말'}</td>
                  <td>{t.publisher || '-'}</td>
                  <td>{t.section || '-'}</td>
                  <td>{t.file_type || '-'}</td>
                  <td>
                    <a href={`/api/admin/prev-test/download?id=${t.id}`}>
                      다운로드
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-muted">총 {testList.length}건</p>
    </div>
  );
}
