import * as fs from 'fs';
import * as path from 'path';
import mysql from 'mysql2/promise';
import type { ResultSetHeader } from 'mysql2';

const BASE_DIR = path.resolve(process.env.IMPORT_OTHER_TESTS_DIR || process.argv[2] || './data/타지역 시험지 한글파일');

const KNOWN_SECTIONS = [
  '국어', '국어1', '국어2', '문법', '문학', '독서',
  '화법과 작문', '독서와 문법', '화작', '언매', '고전',
  '언어와 매체', '독서와문법', '고전읽기',
];

interface ParsedInfo {
  filePath: string;
  fileName: string;
  schoolName: string;
  year: string;
  grade: string;
  term: string;
  testType: string;
  publisher: string;
  section: string;
  region: string;
  fileType: string;
}

// ── 파일 수집 (hwp/hwpx만) ──
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

// ── 파일명 파싱 ──
function parseFile(filePath: string): ParsedInfo {
  const fileName = path.basename(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const fileType = ext === '.pdf' ? 'PDF' : 'HWP';
  const baseName = fileName.replace(/\.\w+$/, '');

  let schoolName = '';
  let grade = '';
  let year = '';
  let term = '';
  let testType = '';
  let publisher = '';
  let section = '';

  // ── Pattern 0: [과목-출판사][YYYY] 학교 N학년 N학기 중간/기말 ──
  const p0 = baseName.match(
    /^\[([^\]]+)\]\[(\d{4})\]\s*([가-힣]+)\s+(\d)학년[-\s]*(\d)학기[-\s]*(중간|기말)/
  );
  if (p0) {
    const parts = p0[1].split(/[-–]/);
    if (parts.length >= 2) {
      section = parts[0].trim();
      publisher = parts[1].trim();
    } else {
      section = p0[1].trim();
    }
    year = p0[2];
    schoolName = p0[3];
    grade = p0[4];
    term = p0[5];
    testType = p0[6] === '중간' ? '1' : '2';
    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
  }

  // ── Pattern 1: [출판사 과목]학교YY년N학기중간/기말... ──
  const bracketMatch = baseName.match(/^\[([^\]]+)\](.*)/);
  if (bracketMatch) {
    const bracketContent = bracketMatch[1].trim();
    const afterBracket = bracketMatch[2].trim();

    const spaceIdx = bracketContent.indexOf(' ');
    if (spaceIdx > 0) {
      publisher = bracketContent.substring(0, spaceIdx);
      section = bracketContent.substring(spaceIdx + 1).trim();
    } else {
      // 출판사만 있거나, 과목만 있을 수 있음
      if (KNOWN_SECTIONS.some((s) => bracketContent.includes(s))) {
        section = bracketContent;
      } else {
        publisher = bracketContent;
      }
    }

    // Helper: 학교명에서 학년 분리
    const extractSchoolGrade = (s: string) => {
      const m = s.match(/^(.*[가-힣])(\d)$/);
      if (m) return { school: m[1].trim(), g: m[2] };
      return { school: s, g: '' };
    };

    // Sub-A: 표준 — 학교NN년N학기중간/기말
    const mA = afterBracket.match(/^(.+?)(\d{2,4})\s*년\s*(\d)\s*학기\s*(중간|기말)/);
    if (mA) {
      const { school, g } = extractSchoolGrade(mA[1].trim());
      if (school) schoolName = school;
      if (g && !grade) grade = g;
      let y = parseInt(mA[2]); if (y < 100) y += 2000;
      year = String(y); term = mA[3]; testType = mA[4] === '중간' ? '1' : '2';
      return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
    }

    // Sub-B: 학년/학년도 — 학교NN학년(도)N학기중간/기말
    const mB = afterBracket.match(/^(.+?)(\d{2,4})\s*학년도?\s*(\d)\s*학기\s*(중간|기말)/);
    if (mB) {
      const { school, g } = extractSchoolGrade(mB[1].trim());
      if (school) schoolName = school;
      if (g && !grade) grade = g;
      let y = parseInt(mB[2]); if (y < 100) y += 2000;
      year = String(y); term = mB[3]; testType = mB[4] === '중간' ? '1' : '2';
      return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
    }

    // Sub-C: 년도 — 학교NN년도N학기중간/기말
    const mC = afterBracket.match(/^(.+?)(\d{2,4})\s*년도\s*(\d)\s*학기\s*(중간|기말)/);
    if (mC) {
      const { school, g } = extractSchoolGrade(mC[1].trim());
      if (school) schoolName = school;
      if (g && !grade) grade = g;
      let y = parseInt(mC[2]); if (y < 100) y += 2000;
      year = String(y); term = mC[3]; testType = mC[4] === '중간' ? '1' : '2';
      return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
    }

    // Sub-D: N회고사 — 학교NN년(도)N학기N회고사 (1회=중간, 2회=기말)
    const mD = afterBracket.match(/^(.+?)(\d{2,4})\s*년도?\s*(\d)\s*학기\s*(\d)\s*회고사/);
    if (mD) {
      const { school, g } = extractSchoolGrade(mD[1].trim());
      if (school) schoolName = school;
      if (g && !grade) grade = g;
      let y = parseInt(mD[2]); if (y < 100) y += 2000;
      year = String(y); term = mD[3]; testType = mD[4] === '1' ? '1' : '2';
      return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
    }

    // Sub-E: 학기말 — 학교NN년N학기말 (학기말 = 기말)
    const mE = afterBracket.match(/^(.+?)(\d{2,4})\s*년\s*(\d)\s*학기말/);
    if (mE) {
      const { school, g } = extractSchoolGrade(mE[1].trim());
      if (school) schoolName = school;
      if (g && !grade) grade = g;
      let y = parseInt(mE[2]); if (y < 100) y += 2000;
      year = String(y); term = mE[3]; testType = '2';
      return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
    }

    // Sub-F: 년도 + N회고사 — 학교NN년도N학기N회고사
    // (already covered by Sub-D with 년도?)

    // Sub-G: 년 앞에 학교 — NN년학교N학기중간/기말
    const mG = afterBracket.match(/^(\d{2,4})\s*년\s*([가-힣]+?)(\d)\s*학기\s*(중간|기말)/);
    if (mG) {
      let y = parseInt(mG[1]); if (y < 100) y += 2000;
      year = String(y); schoolName = mG[2]; term = mG[3]; testType = mG[4] === '중간' ? '1' : '2';
      return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
    }

    // Sub-H: dash 형식 — 학교NN-N-중간/기말
    const mH = afterBracket.match(/^(.+?)(\d{2,4})-(\d)-(중간|기말)/);
    if (mH) {
      const { school, g } = extractSchoolGrade(mH[1].trim());
      if (school) schoolName = school;
      if (g && !grade) grade = g;
      let y = parseInt(mH[2]); if (y < 100) y += 2000;
      year = String(y); term = mH[3]; testType = mH[4] === '중간' ? '1' : '2';
      return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
    }

    // Sub-I: N학년N학기 (학년=grade, 년도 없음) — 학교N학년N학기중간/기말
    const mI = afterBracket.match(/^([가-힣]+?)(\d)\s*학년\s*(\d)\s*학기\s*(중간|기말)/);
    if (mI) {
      schoolName = mI[1]; grade = mI[2]; term = mI[3]; testType = mI[4] === '중간' ? '1' : '2';
      return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
    }

    // Sub-J1: 년도 없이 학기만 (학교+grade+term) — "부천북고1학기중간" -> school=부천북고 term=1
    const mJ1 = afterBracket.match(/^([가-힣]+?)(\d)\s*학기\s*(중간|기말)/);
    if (mJ1) {
      schoolName = mJ1[1]; term = mJ1[2]; testType = mJ1[3] === '중간' ? '1' : '2';
      return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
    }

    // Sub-J2: 학교 + 공백 + N학기 + 중간/기말 — " 광북고 1학기 기말"
    const mJ2 = afterBracket.match(/^\s*([가-힣]+?)\s+(\d)\s*학기\s+(중간|기말)/);
    if (mJ2) {
      schoolName = mJ2[1]; term = mJ2[2]; testType = mJ2[3] === '중간' ? '1' : '2';
      return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
    }

    // Sub-J3: NN + 학교 + N학기중간 — "25양지고1학기중간"
    const mJ3 = afterBracket.match(/^(\d{2,4})([가-힣]+?)(\d)\s*학기\s*(중간|기말)/);
    if (mJ3) {
      let y = parseInt(mJ3[1]); if (y < 100) y += 2000;
      year = String(y); schoolName = mJ3[2]; term = mJ3[3]; testType = mJ3[4] === '중간' ? '1' : '2';
      return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
    }

    // Sub-J4: 학교N + 공백 + NN년 + 공백 + N학기 + N차 지필 — "신한고3 25년 1학기 1차 지필"
    const mJ4 = afterBracket.match(/^\s*([가-힣]+)(\d)\s+(\d{2,4})\s*년\s+(\d)\s*학기\s+(\d)\s*차\s+지필/);
    if (mJ4) {
      schoolName = mJ4[1]; grade = mJ4[2];
      let y = parseInt(mJ4[3]); if (y < 100) y += 2000;
      year = String(y); term = mJ4[4]; testType = mJ4[5] === '1' ? '1' : '2';
      return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
    }

    // Sub-J5: 학교N + YYYY + N학기 + N차 지필 — "비전고3 2025 1학기 1차 지필"
    const mJ5 = afterBracket.match(/^\s*([가-힣]+)(\d)\s+(\d{4})\s+(\d)\s*학기\s+(\d)\s*차\s+지필/);
    if (mJ5) {
      schoolName = mJ5[1]; grade = mJ5[2];
      year = mJ5[3]; term = mJ5[4]; testType = mJ5[5] === '1' ? '1' : '2';
      return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
    }

    // Sub-J6: 학교 + N학기기말(no 년도) — "서정고2학기기말"
    const mJ6 = afterBracket.match(/^([가-힣]+?)(\d)\s*학기\s*(기말|중간)/);
    if (mJ6) {
      schoolName = mJ6[1]; term = mJ6[2]; testType = mJ6[3] === '중간' ? '1' : '2';
      return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
    }

    // Sub-K: 학교NN년N학년N학기말/기말 — "경기여고24년2학년2학기말"
    const mK = afterBracket.match(/^(.+?)(\d{2,4})\s*년\s*(\d)\s*학년\s*(\d)\s*학기(말|기말|중간)/);
    if (mK) {
      schoolName = mK[1].trim();
      let y = parseInt(mK[2]); if (y < 100) y += 2000;
      year = String(y); grade = mK[3]; term = mK[4];
      testType = mK[5] === '중간' ? '1' : '2';
      return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
    }

    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
  }

  // ── Pattern 2: 학교N YYYY학년도 N학기 N차 지필평가 (과목) ──
  const p2 = baseName.match(
    /^([가-힣]+)(\d)\s+(\d{4})학년도\s+(\d)학기\s+(\d)차\s+지필평가/
  );
  if (p2) {
    schoolName = p2[1];
    grade = p2[2];
    year = p2[3];
    term = p2[4];
    testType = p2[5] === '1' ? '1' : '2';
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
    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
  }

  // ── Pattern 3: 25년1학기기말상일고1학년 ──
  const p3 = baseName.match(
    /(\d{2,4})\s*년\s*(\d)\s*학기\s*(중간|기말)\s*([가-힣]+?)(\d)\s*학년/
  );
  if (p3) {
    let y = parseInt(p3[1]);
    if (y < 100) y += 2000;
    year = String(y);
    term = p3[2];
    testType = p3[3] === '중간' ? '1' : '2';
    schoolName = p3[4];
    grade = p3[5];
    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
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
    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
  }

  // ── Pattern 5: "학교N_YYYY N학기 기말고사(과목-출판사)" ──
  const p5 = baseName.match(
    /^([가-힣]+)(\d)[_\s]+(\d{4})\s+(\d)학기\s+(중간|기말)고사/
  );
  if (p5) {
    schoolName = p5[1];
    grade = p5[2];
    year = p5[3];
    term = p5[4];
    testType = p5[5] === '중간' ? '1' : '2';
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
    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
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
    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
  }

  // ── Pattern 6: "YYYY 소명여고 N-N 중간/기말" ──
  const p6 = baseName.match(
    /^(\d{4})\s+([가-힣]+)\s+(\d)-(\d)\s+(중간|기말)/
  );
  if (p6) {
    year = p6[1];
    schoolName = p6[2];
    grade = p6[3];
    term = p6[4];
    testType = p6[5] === '중간' ? '1' : '2';
    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
  }

  // ── Pattern 7: "학교N YYYY 학년도 N학기 N차 지필평가" ──
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
    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
  }

  // ── Pattern 8: "화법[수특]소명여고25년1학기기말" ──
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
    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
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
    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
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
    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
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
    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
  }

  // ── Pattern 13: "학교N(출판사) YYYY N학기 중간/기말고사" ──
  const p13 = baseName.match(
    /^([가-힣]+)(\d)\(([^)]+)\)\s+(\d{4})\s+(\d)학기\s+(중간|기말)고?사?/
  );
  if (p13) {
    schoolName = p13[1]; grade = p13[2]; publisher = p13[3];
    year = p13[4]; term = p13[5]; testType = p13[6] === '중간' ? '1' : '2';
    // 뒤에 괄호로 과목이 올 수 있음
    const rest = baseName.substring(baseName.indexOf(p13[6]) + p13[6].length);
    const parenMatch = rest.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const content = parenMatch[1].trim();
      if (KNOWN_SECTIONS.some((s) => content.includes(s))) section = content;
    }
    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
  }

  // ── Pattern 13b: "학교N(출판사) YYYY N학기 기말(과목)" — "기말" without 고사 ──
  const p13b = baseName.match(
    /^([가-힣]+)(\d)\(([^)]+)\)\s+(\d{4})\s+(\d)학기\s+(중간|기말)/
  );
  if (p13b) {
    schoolName = p13b[1]; grade = p13b[2]; publisher = p13b[3];
    year = p13b[4]; term = p13b[5]; testType = p13b[6] === '중간' ? '1' : '2';
    const rest = baseName.substring(baseName.indexOf(p13b[6]) + p13b[6].length);
    const parenMatch = rest.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const content = parenMatch[1].trim();
      if (KNOWN_SECTIONS.some((s) => content.includes(s))) section = content;
    }
    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
  }

  // ── Pattern 14: "학교N(출판사) YYYY학년도 N학기 N차 지필평가 (과목)" ──
  const p14 = baseName.match(
    /^([가-힣]+)(\d)\(([^)]+)\)\s+(\d{4})학년도\s+(\d)학기\s+(\d)차\s+지필평가/
  );
  if (p14) {
    schoolName = p14[1]; grade = p14[2]; publisher = p14[3];
    year = p14[4]; term = p14[5]; testType = p14[6] === '1' ? '1' : '2';
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
    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
  }

  // ── Pattern 15: "[출판사] 학교N NN년 N학기 N차 지필" ──
  const p15 = baseName.match(
    /^\[([^\]]+)\]\s*([가-힣]+)(\d)\s+(\d{2,4})\s*년\s+(\d)\s*학기\s+(\d)\s*차\s+지필/
  );
  if (p15) {
    const bracketContent = p15[1].trim();
    const spaceIdx = bracketContent.indexOf(' ');
    if (spaceIdx > 0) {
      publisher = bracketContent.substring(0, spaceIdx);
      section = bracketContent.substring(spaceIdx + 1).trim();
    } else {
      if (KNOWN_SECTIONS.some((s) => bracketContent.includes(s))) {
        section = bracketContent;
      } else {
        publisher = bracketContent;
      }
    }
    schoolName = p15[2]; grade = p15[3];
    let y = parseInt(p15[4]); if (y < 100) y += 2000;
    year = String(y); term = p15[5]; testType = p15[6] === '1' ? '1' : '2';
    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
  }

  // ── Pattern 16: "YYMMDD유고N_N학기중간_과목" (날짜 prefix) ──
  const p16 = baseName.match(
    /^(\d{2})(\d{2})\d{2}([가-힣]+)(\d)[_](\d)학기(중간|기말)[_]?([가-힣]*)/
  );
  if (p16) {
    let y = parseInt(p16[1]); if (y < 100) y += 2000;
    year = String(y);
    schoolName = p16[3]; grade = p16[4]; term = p16[5]; testType = p16[6] === '중간' ? '1' : '2';
    const sec = p16[7]?.trim();
    if (sec && KNOWN_SECTIONS.some((s) => sec.includes(s))) section = sec;
    return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
  }

  // ── Fallback ──
  return { filePath, fileName, schoolName, year, grade, term, testType, publisher, section, region: '타지역', fileType };
}

// ── 메인 ──
async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log(`\n=== 타지역 기출문제 일괄 등록 스크립트 ===`);
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

  // ── 샘플 출력 (처음 20개) ──
  console.log(`[파싱 결과 샘플 (처음 20개)]`);
  console.log(
    '학교명'.padEnd(12) + ' | ' +
    '년도'.padEnd(6) + ' | ' +
    '학기' + ' | ' +
    '시험'.padEnd(4) + ' | ' +
    '출판사'.padEnd(12) + ' | ' +
    '과목'.padEnd(10) + ' | ' +
    '파일명'
  );
  console.log('-'.repeat(130));

  for (const p of parsed.slice(0, 20)) {
    const testLabel = p.testType === '1' ? '중간' : p.testType === '2' ? '기말' : '??';
    console.log(
      (p.schoolName || '??').padEnd(12) + ' | ' +
      (p.year || '????').padEnd(6) + ' | ' +
      (p.term ? `${p.term}학기` : '??  ').padEnd(4) + ' | ' +
      testLabel.padEnd(4) + ' | ' +
      (p.publisher || '-').padEnd(12) + ' | ' +
      (p.section || '-').padEnd(10) + ' | ' +
      p.fileName
    );
  }

  if (isDryRun) {
    console.log(`\n[DRY RUN 완료] 실제 등록: npx tsx --env-file=apps/root/.env scripts/import-prev-tests-other.ts`);
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
      const [metaResult] = await pool.query<ResultSetHeader>(
        `INSERT INTO prev_test_meta_info
          (region, school_type, school_name, year, grade, term, test_type, section, publisher, file_type, insert_time)
         VALUES (?,?,?,?,?,?,?,?,?,?,now())`,
        [p.region, '', p.schoolName, p.year || 0, p.grade || 0, p.term || 0, p.testType || 0, p.section, p.publisher, p.fileType]
      );
      const metaId = metaResult.insertId;

      const content = fs.readFileSync(p.filePath);
      await pool.query<ResultSetHeader>(
        `INSERT INTO prev_test_file_info (info_id, content, file_name, insert_time) VALUES (?,?,?,now())`,
        [metaId, content, p.fileName]
      );

      success++;
      if ((i + 1) % 100 === 0 || i === parsed.length - 1) {
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
