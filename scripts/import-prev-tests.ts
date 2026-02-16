import * as fs from 'fs';
import * as path from 'path';
import mysql from 'mysql2/promise';
import type { ResultSetHeader } from 'mysql2';

const BASE_DIR = path.resolve(process.env.IMPORT_PREV_TESTS_DIR || process.argv[2] || './data/이든 학교별 한글파일');

// Pattern 2에서 과목명 판별용 키워드
const KNOWN_SECTIONS = [
  '국어', '국어1', '국어2', '문법', '문학', '독서',
  '화법과 작문', '독서와 문법', '화작', '언매', '고전',
  '언어와 매체', '독서와문법',
];

interface ParsedInfo {
  filePath: string;
  fileName: string;
  schoolName: string;
  year: string;
  grade: string;
  term: string;
  testType: string; // '1'=중간, '2'=기말
  publisher: string;
  section: string;
  region: string;
  fileType: string; // 'HWP' | 'PDF'
}

// ── 파일 수집 ──
function collectFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.hwp', '.hwpx'].includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

// ── 폴더 경로에서 학교명/학년 추출 ──
function getFolderInfo(filePath: string): { folderSchool: string; folderGrade: string } {
  const relativePath = path.relative(BASE_DIR, filePath);
  const parts = relativePath.split(path.sep);

  let folderSchool = '';
  let folderGrade = '';

  if (parts.length >= 3) {
    folderSchool = parts[0];
    const gradeMatch = parts[1].match(/고(\d)/);
    if (gradeMatch) folderGrade = gradeMatch[1];
  } else if (parts.length === 2) {
    folderSchool = parts[0];
  }

  return { folderSchool, folderGrade };
}

// ── 파일명 파싱 ──
function parseFile(filePath: string): ParsedInfo {
  const fileName = path.basename(filePath);
  const { folderSchool, folderGrade } = getFolderInfo(filePath);

  const ext = path.extname(fileName).toLowerCase();
  const fileType = ext === '.pdf' ? 'PDF' : 'HWP';
  const baseName = fileName.replace(/\.\w+$/, '');

  let schoolName = folderSchool;
  let grade = folderGrade;
  let year = '';
  let term = '';
  let testType = '';
  let publisher = '';
  let section = '';

  // ── Pattern 0: [과목-출판사][YYYY] 학교 N학년 N학기 중간/기말 (이중 대괄호) ──
  const p0 = baseName.match(
    /^\[([^\]]+)\]\[(\d{4})\]\s*([가-힣]+)\s+(\d)학년[-\s]*(\d)학기[-\s]*(중간|기말)/
  );
  if (p0) {
    const bracketParts = p0[1].split(/[-–]/);
    if (bracketParts.length >= 2) {
      section = bracketParts[0].trim();
      publisher = bracketParts[1].trim();
    } else {
      section = p0[1].trim();
    }
    year = p0[2];
    schoolName = p0[3];
    grade = p0[4];
    term = p0[5];
    testType = p0[6] === '중간' ? '1' : '2';
    return {
      filePath, fileName, schoolName, year, grade, term,
      testType, publisher, section, region: '부천', fileType,
    };
  }

  // ── Pattern 1: [출판사 과목]학교YY년N학기중간/기말... ──
  const bracketMatch = baseName.match(/^\[([^\]]+)\](.*)/);
  if (bracketMatch) {
    const bracketContent = bracketMatch[1].trim();
    const afterBracket = bracketMatch[2].trim();

    // 대괄호 안: 첫 번째 공백 기준으로 출판사 / 과목 분리
    const spaceIdx = bracketContent.indexOf(' ');
    if (spaceIdx > 0) {
      publisher = bracketContent.substring(0, spaceIdx);
      section = bracketContent.substring(spaceIdx + 1).trim();
    } else {
      publisher = bracketContent;
    }

    // 대괄호 뒤: 학교명 + 년도 + 학기 + 중간/기말
    const mainMatch = afterBracket.match(
      /^(.+?)(\d{2,4})\s*년\s*(\d)\s*학기\s*(중간|기말)/
    );
    if (mainMatch) {
      let parsedSchool = mainMatch[1].trim();
      // 학교명 끝에 붙은 학년 숫자 분리 (예: 계남고2 → 계남고 + 2)
      const gradeInName = parsedSchool.match(/^(.*[가-힣])(\d)$/);
      if (gradeInName) {
        parsedSchool = gradeInName[1].trim();
        if (!grade) grade = gradeInName[2];
      }
      if (parsedSchool) schoolName = parsedSchool;

      let y = parseInt(mainMatch[2]);
      if (y < 100) y += 2000;
      year = String(y);
      term = mainMatch[3];
      testType = mainMatch[4] === '중간' ? '1' : '2';
    }

    return {
      filePath, fileName, schoolName, year, grade, term,
      testType, publisher, section, region: '부천', fileType,
    };
  }

  // ── Pattern 2: 학교N YYYY학년도 N학기 N차 지필평가 (과목) ──
  const legacyMatch = baseName.match(
    /^([가-힣]+)(\d)\s+(\d{4})학년도\s+(\d)학기\s+(\d)차\s+지필평가/
  );
  if (legacyMatch) {
    schoolName = legacyMatch[1];
    grade = legacyMatch[2];
    year = legacyMatch[3];
    term = legacyMatch[4];
    testType = legacyMatch[5] === '1' ? '1' : '2'; // 1차=중간, 2차=기말

    // 지필평가 뒤 괄호에서 과목명 추출
    const afterTest = baseName.substring(baseName.indexOf('지필평가') + 4);
    const parenMatches = afterTest.match(/\(([^)]+)\)/g);
    if (parenMatches) {
      for (const pm of parenMatches) {
        const content = pm.slice(1, -1).trim();
        if (KNOWN_SECTIONS.some((s) => content.includes(s))) {
          section = content;
          break;
        }
      }
    }

    return {
      filePath, fileName, schoolName, year, grade, term,
      testType, publisher, section, region: '부천', fileType,
    };
  }

  // ── Pattern 3: 25년1학기기말상일고1학년... (년도가 앞에 오는 케이스) ──
  const edgeMatch = baseName.match(
    /(\d{2,4})\s*년\s*(\d)\s*학기\s*(중간|기말)\s*([가-힣]+?)(\d)\s*학년/
  );
  if (edgeMatch) {
    let y = parseInt(edgeMatch[1]);
    if (y < 100) y += 2000;
    year = String(y);
    term = edgeMatch[2];
    testType = edgeMatch[3] === '중간' ? '1' : '2';
    schoolName = edgeMatch[4];
    grade = edgeMatch[5];

    return {
      filePath, fileName, schoolName, year, grade, term,
      testType, publisher, section, region: '부천', fileType,
    };
  }

  // ── Pattern 4: "2018 상동고1 2학기 중간고사 (문학)" ──
  const p4 = baseName.match(
    /^(\d{4})\s+([가-힣]+)(\d)\s+(\d)학기\s+(중간|기말)고사(?:\s*\(([^)]+)\))?/
  );
  if (p4) {
    year = p4[1];
    schoolName = p4[2];
    grade = p4[3];
    term = p4[4];
    testType = p4[5] === '중간' ? '1' : '2';
    const candidate = p4[6]?.trim();
    if (candidate && KNOWN_SECTIONS.some((s) => candidate.includes(s))) {
      section = candidate;
    }
    return {
      filePath, fileName, schoolName, year, grade, term,
      testType, publisher, section, region: '부천', fileType,
    };
  }

  // ── Pattern 5: "학교N_YYYY N학기 기말고사(과목-출판사)" / "학교N_N학기_기말시험지" ──
  const p5 = baseName.match(
    /^([가-힣]+)(\d)[_\s]+(\d{4})\s+(\d)학기\s+(중간|기말)고사/
  );
  if (p5) {
    schoolName = p5[1];
    grade = p5[2];
    year = p5[3];
    term = p5[4];
    testType = p5[5] === '중간' ? '1' : '2';
    // 괄호/대괄호에서 과목-출판사 추출
    const extraMatch = baseName.match(/[(\[](.*?)[)\]]/g);
    if (extraMatch) {
      for (const em of extraMatch) {
        const inner = em.slice(1, -1).trim();
        const parts = inner.split(/[-–]/);
        for (const part of parts) {
          const p = part.trim();
          if (KNOWN_SECTIONS.some((s) => p.includes(s))) {
            section = p;
          } else if (p.length >= 2) {
            publisher = p;
          }
        }
      }
    }
    return {
      filePath, fileName, schoolName, year, grade, term,
      testType, publisher, section, region: '부천', fileType,
    };
  }

  // ── Pattern 5b: "학교N_N학기_기말시험지" ──
  const p5b = baseName.match(
    /^([가-힣]+)(\d)[_](\d)학기[_](중간|기말)시험지/
  );
  if (p5b) {
    schoolName = p5b[1];
    grade = p5b[2];
    term = p5b[3];
    testType = p5b[4] === '중간' ? '1' : '2';
    return {
      filePath, fileName, schoolName, year, grade, term,
      testType, publisher, section, region: '부천', fileType,
    };
  }

  // ── Pattern 6: "YYYY 소명여고 N-N 중간/기말" (grade-term) ──
  const p6 = baseName.match(
    /^(\d{4})\s+([가-힣]+)\s+(\d)-(\d)\s+(중간|기말)/
  );
  if (p6) {
    year = p6[1];
    schoolName = p6[2];
    grade = p6[3];
    term = p6[4];
    testType = p6[5] === '중간' ? '1' : '2';
    return {
      filePath, fileName, schoolName, year, grade, term,
      testType, publisher, section, region: '부천', fileType,
    };
  }

  // ── Pattern 7: "학교N YYYY 학년도 N학기 N차 지필평가" (년도와 학년도 사이 공백) ──
  const p7 = baseName.match(
    /^([가-힣]+)(\d)\s+(\d{4})\s+학년도\s+(\d)학기\s+(\d)차\s+지필평가/
  );
  if (p7) {
    schoolName = p7[1];
    grade = p7[2];
    year = p7[3];
    term = p7[4];
    testType = p7[5] === '1' ? '1' : '2';
    const afterTest = baseName.substring(baseName.indexOf('지필평가') + 4);
    const parenMatches = afterTest.match(/\(([^)]+)\)/g);
    if (parenMatches) {
      for (const pm of parenMatches) {
        const content = pm.slice(1, -1).trim();
        if (KNOWN_SECTIONS.some((s) => content.includes(s))) {
          section = content;
          break;
        }
      }
    }
    return {
      filePath, fileName, schoolName, year, grade, term,
      testType, publisher, section, region: '부천', fileType,
    };
  }

  // ── Pattern 8: "화법[수특]소명여고25년1학기기말..." (과목이 대괄호 앞에) ──
  const p8 = baseName.match(
    /^([가-힣]+)\[([^\]]+)\]([가-힣]+?)(\d{2,4})\s*년\s*(\d)\s*학기\s*(중간|기말)/
  );
  if (p8) {
    section = p8[1];
    publisher = p8[2];
    schoolName = p8[3];
    let y = parseInt(p8[4]);
    if (y < 100) y += 2000;
    year = String(y);
    term = p8[5];
    testType = p8[6] === '중간' ? '1' : '2';
    return {
      filePath, fileName, schoolName, year, grade, term,
      testType, publisher, section, region: '부천', fileType,
    };
  }

  // ── Pattern 9: "YYYY학년도 학교N N학기 N차 지필평가_과목" ──
  const p9 = baseName.match(
    /^(\d{4})학년도\s+([가-힣]+)(\d)\s+(\d)학기\s+(\d)차\s+지필평가[_]?(\S*)/
  );
  if (p9) {
    year = p9[1];
    schoolName = p9[2];
    grade = p9[3];
    term = p9[4];
    testType = p9[5] === '1' ? '1' : '2';
    const suffix = p9[6]?.trim();
    if (suffix && KNOWN_SECTIONS.some((s) => suffix.includes(s))) {
      section = suffix;
    }
    return {
      filePath, fileName, schoolName, year, grade, term,
      testType, publisher, section, region: '부천', fileType,
    };
  }

  // ── Pattern 10: "[과목-출판사][YYYY] 학교 N학년 N학기 중간/기말" (이중 대괄호) ──
  const p10 = baseName.match(
    /^\[([^\]]+)\]\[(\d{4})\]\s*([가-힣]+)\s+(\d)학년[-\s]*(\d)학기[-\s]*(중간|기말)/
  );
  if (p10) {
    const bracketParts = p10[1].split(/[-–]/);
    if (bracketParts.length >= 2) {
      section = bracketParts[0].trim();
      publisher = bracketParts[1].trim();
    } else {
      section = p10[1].trim();
    }
    year = p10[2];
    schoolName = p10[3];
    grade = p10[4];
    term = p10[5];
    testType = p10[6] === '중간' ? '1' : '2';
    return {
      filePath, fileName, schoolName, year, grade, term,
      testType, publisher, section, region: '부천', fileType,
    };
  }

  // ── Pattern 11: "2018-2 정명고 중간고사 기출문제(미래엔)" ──
  const p11 = baseName.match(
    /^(\d{4})-(\d)\s+([가-힣]+)\s+(중간|기말)고사/
  );
  if (p11) {
    year = p11[1];
    term = p11[2];
    schoolName = p11[3];
    testType = p11[4] === '중간' ? '1' : '2';
    const parenMatch = baseName.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const content = parenMatch[1].trim();
      if (KNOWN_SECTIONS.some((s) => content.includes(s))) {
        section = content;
      } else {
        publisher = content;
      }
    }
    return {
      filePath, fileName, schoolName, year, grade, term,
      testType, publisher, section, region: '부천', fileType,
    };
  }

  // ── Pattern 12: "상일고2 1학기 중간 시험지 (좋은책신사고 문학)" ──
  const p12 = baseName.match(
    /^([가-힣]+)(\d)\s+(\d)학기\s+(중간|기말)\s*시험지/
  );
  if (p12) {
    schoolName = p12[1];
    grade = p12[2];
    term = p12[3];
    testType = p12[4] === '중간' ? '1' : '2';
    const parenMatch = baseName.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const inner = parenMatch[1].trim();
      const parts = inner.split(/\s+/);
      if (parts.length >= 2) {
        publisher = parts[0];
        section = parts.slice(1).join(' ');
      } else if (KNOWN_SECTIONS.some((s) => inner.includes(s))) {
        section = inner;
      } else {
        publisher = inner;
      }
    }
    return {
      filePath, fileName, schoolName, year, grade, term,
      testType, publisher, section, region: '부천', fileType,
    };
  }

  // ── Fallback: 폴더 정보만 사용 ──
  return {
    filePath, fileName, schoolName, year, grade, term,
    testType, publisher, section, region: '부천', fileType,
  };
}

// ── 메인 ──
async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log(`\n=== 기출문제 일괄 등록 스크립트 ===`);
  console.log(`대상 폴더: ${BASE_DIR}`);
  console.log(`모드: ${isDryRun ? 'DRY RUN (미리보기)' : '실제 DB 등록'}\n`);

  const files = collectFiles(BASE_DIR);
  console.log(`총 파일 수: ${files.length}개\n`);

  const parsed = files.map(parseFile);

  // ── 통계 ──
  const withYear = parsed.filter((p) => p.year);
  const withPublisher = parsed.filter((p) => p.publisher);
  const noYear = parsed.filter((p) => !p.year);

  console.log(`[파싱 통계]`);
  console.log(`  년도 파싱 성공: ${withYear.length}개`);
  console.log(`  출판사 파싱 성공: ${withPublisher.length}개`);
  console.log(`  년도 파싱 실패: ${noYear.length}개\n`);

  if (noYear.length > 0) {
    console.log(`[파싱 실패 파일]`);
    noYear.forEach((p) =>
      console.log(`  - ${p.fileName} (학교: ${p.schoolName || '?'})`)
    );
    console.log('');
  }

  // ── 전체 파싱 결과 출력 ──
  console.log(`[파싱 결과 전체 목록]`);
  console.log(
    '학교명'.padEnd(8) + ' | ' +
    '학년' + ' | ' +
    '년도'.padEnd(6) + ' | ' +
    '학기' + ' | ' +
    '시험'.padEnd(4) + ' | ' +
    '출판사'.padEnd(10) + ' | ' +
    '과목'.padEnd(10) + ' | ' +
    '파일명'
  );
  console.log('-'.repeat(120));

  for (const p of parsed) {
    const testLabel = p.testType === '1' ? '중간' : p.testType === '2' ? '기말' : '??';
    console.log(
      (p.schoolName || '??').padEnd(8) + ' | ' +
      (p.grade ? `고${p.grade}` : '??').padEnd(4) + ' | ' +
      (p.year || '????').padEnd(6) + ' | ' +
      (p.term ? `${p.term}학기` : '??  ').padEnd(4) + ' | ' +
      testLabel.padEnd(4) + ' | ' +
      (p.publisher || '-').padEnd(10) + ' | ' +
      (p.section || '-').padEnd(10) + ' | ' +
      p.fileName
    );
  }

  if (isDryRun) {
    console.log(`\n[DRY RUN 완료] 실제 등록: npx tsx --env-file=apps/root/.env scripts/import-prev-tests.ts`);
    process.exit(0);
  }

  // ── 실제 DB 등록 ──
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'edenschool',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    charset: 'utf8',
    waitForConnections: true,
    connectionLimit: 5,
  });

  // 기존 데이터 수 확인
  const [countRows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT COUNT(*) as cnt FROM prev_test_meta_info'
  );
  console.log(`\n기존 DB 레코드: ${countRows[0].cnt}개`);
  console.log(`등록 시작...\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    try {
      // meta 정보 INSERT
      const [metaResult] = await pool.query<ResultSetHeader>(
        `INSERT INTO prev_test_meta_info
          (region, school_type, school_name, year, grade, term, test_type, section, publisher, file_type, insert_time)
         VALUES (?,?,?,?,?,?,?,?,?,?,now())`,
        [p.region, '', p.schoolName, p.year, p.grade, p.term, p.testType, p.section, p.publisher, p.fileType]
      );
      const metaId = metaResult.insertId;

      // 파일 바이너리 INSERT
      const content = fs.readFileSync(p.filePath);
      await pool.query<ResultSetHeader>(
        `INSERT INTO prev_test_file_info (info_id, content, file_name, insert_time) VALUES (?,?,?,now())`,
        [metaId, content, p.fileName]
      );

      success++;
      if ((i + 1) % 50 === 0 || i === parsed.length - 1) {
        console.log(`진행: ${i + 1}/${parsed.length} (성공: ${success}, 실패: ${failed})`);
      }
    } catch (err: any) {
      failed++;
      console.error(`[실패] ${p.fileName}: ${err.message}`);
    }
  }

  console.log(`\n=== 완료 ===`);
  console.log(`성공: ${success}개, 실패: ${failed}개`);

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('스크립트 오류:', err);
  process.exit(1);
});
