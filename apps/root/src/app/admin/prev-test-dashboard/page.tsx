import { Suspense } from 'react';
import Link from 'next/link';
import { requireAdminSession } from '@/lib/admin-session';
import pool from '@kaca/common/db';
import { selectPrevTestSchoolName } from '@kaca/common/queries/prev-test';
import type { RowDataPacket } from 'mysql2';
import DashboardFilters from './DashboardFilters';
import ResultTable from './ResultTable';

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

export default async function PrevTestDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    search?: string;
    school?: string;
    section?: string;
    publisher?: string;
    term?: string;
    test_type?: string;
    region?: string;
  }>;
}) {
  const session = await requireAdminSession();

  const params = await searchParams;
  const region = params.region || '부천';
  const selectedYears = params.year?.split(',').filter(Boolean) || [];
  const selectedSections = params.section?.split(',').filter(Boolean) || [];
  const selectedPublishers = params.publisher?.split(',').filter(Boolean) || [];
  const selectedTerms = params.term?.split(',').filter(Boolean) || [];
  const selectedTestTypes = params.test_type?.split(',').filter(Boolean) || [];
  const search = params.search || '';
  const schoolFilter = params.school || '';

  let query = `
    SELECT ptm.*, ptfi.file_name, ptfi.id as file_id
    FROM prev_test_meta_info ptm
    LEFT JOIN prev_test_file_info ptfi ON ptfi.info_id = ptm.id
    WHERE ptm.region=?
  `;
  const queryParams: any[] = [region];

  if (selectedYears.length > 0) {
    query += ` AND ptm.year IN (${selectedYears.map(() => '?').join(',')})`;
    queryParams.push(...selectedYears.map(Number));
  }
  if (selectedSections.length > 0) {
    query += ` AND ptm.section IN (${selectedSections.map(() => '?').join(',')})`;
    queryParams.push(...selectedSections);
  }
  if (selectedPublishers.length > 0) {
    query += ` AND ptm.publisher IN (${selectedPublishers.map(() => '?').join(',')})`;
    queryParams.push(...selectedPublishers);
  }
  if (selectedTerms.length > 0) {
    query += ` AND ptm.term IN (${selectedTerms.map(() => '?').join(',')})`;
    queryParams.push(...selectedTerms.map(Number));
  }
  if (selectedTestTypes.length > 0) {
    query += ` AND ptm.test_type IN (${selectedTestTypes.map(() => '?').join(',')})`;
    queryParams.push(...selectedTestTypes.map(Number));
  }
  if (search) {
    query += ' AND ptfi.file_name LIKE ?';
    queryParams.push(`%${search}%`);
  }
  if (schoolFilter) {
    query += ' AND ptm.school_name=?';
    queryParams.push(schoolFilter);
  }

  query += ' ORDER BY ptm.school_name ASC, ptm.year DESC, ptm.term ASC, ptm.test_type ASC';

  const [rows] = await pool.query<RowDataPacket[]>(query, queryParams);
  const testList = rows as PrevTestRow[];

  // 필터 옵션 조회 (해당 지역만)
  const [schoolRows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT school_name FROM prev_test_meta_info WHERE region=? AND school_name IS NOT NULL AND school_name != '' ORDER BY school_name ASC",
    [region]
  );
  const schools = schoolRows.map((r) => r.school_name as string);

  const [sectionRows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT section FROM prev_test_meta_info WHERE region=? AND section IS NOT NULL AND section != '' ORDER BY section ASC",
    [region]
  );
  const sections = sectionRows.map((r) => r.section as string);

  const [publisherRows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT publisher FROM prev_test_meta_info WHERE region=? AND publisher IS NOT NULL AND publisher != '' ORDER BY publisher ASC",
    [region]
  );
  const publishers = publisherRows.map((r) => r.publisher as string);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2018 + 1 }, (_, i) => currentYear - i);

  return (
    <div>
      <h4 className="mb-3">{region === '부천' ? '부천지역 기출' : '타학교 기출'}</h4>

      <div className="mb-3">
        <Link href={`/admin/prev-test-add?region=${region}`} className="btn btn-primary btn-sm mr-2">
          기출문제 추가
        </Link>
      </div>

      {/* 필터 (Client Component) */}
      <Suspense fallback={null}>
        <DashboardFilters
          years={years}
          sections={sections}
          publishers={publishers}
          schools={schools}
          region={region}
        />
      </Suspense>

      {/* 테이블 */}
      <ResultTable testList={testList} />
    </div>
  );
}
