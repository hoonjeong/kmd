/**
 * 배치 문제 유형 분류 스크립트
 *
 * grammar_file / literature_file 테이블에서 HWP 바이너리를 읽고,
 * 텍스트 추출 → 문제 파싱 → 유형 분류 → parsed_question 테이블에 INSERT
 *
 * 사용법:
 *   npx tsx scripts/batch-classify-questions.ts [options]
 *
 * 옵션:
 *   --dry-run         DB에 저장하지 않고 결과만 출력
 *   --type grammar    문법만 처리 (기본: 둘 다)
 *   --type literature  문학만 처리
 *   --limit 10        처리할 최대 메타 건수
 *   --meta-id 123     특정 메타 ID만 처리
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// .env 로드 (apps/root/.env)
dotenv.config({ path: path.resolve(__dirname, '../apps/root/.env') });

import mysql from 'mysql2/promise';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { extractTextFromHwp } from '../apps/root/src/lib/hwp-extractor';
import { parseHwpQuestions, type ParsedQuestion } from './parse-questions';

// ── CLI 인자 파싱 ──

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}
const DRY_RUN = args.includes('--dry-run');
const PROCESS_TYPE = getArg('type') as 'grammar' | 'literature' | undefined;
const LIMIT = getArg('limit') ? parseInt(getArg('limit')!, 10) : undefined;
const META_ID = getArg('meta-id') ? parseInt(getArg('meta-id')!, 10) : undefined;
const BATCH_SIZE = 500;

// ── DB 연결 ──

function createPool(): Pool {
  return mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'kaca',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 5,
  });
}

// ── 메인 ──

interface FileMeta {
  metaId: number;
  fileId: number;
  fileName: string;
  content: Buffer;
  category: string;      // grammar_meta.sub_category 또는 literature_meta.category
}

async function fetchGrammarFiles(pool: Pool): Promise<FileMeta[]> {
  let sql = `
    SELECT gm.id AS metaId, gf.id AS fileId, gf.file_name AS fileName,
           gf.content, gm.sub_category AS category
    FROM grammar_meta gm
    JOIN grammar_file gf ON gf.meta_id = gm.id
    WHERE gf.content IS NOT NULL
      AND gf.file_name LIKE '%.hwp'
  `;
  const params: unknown[] = [];

  if (META_ID) {
    sql += ` AND gm.id = ${Number(META_ID)}`;
  }

  // 이미 처리된 건 제외
  sql += ` AND NOT EXISTS (
    SELECT 1 FROM parsed_question pq
    WHERE pq.source_type = 'grammar' AND pq.source_meta_id = gm.id
  )`;

  sql += ' ORDER BY gm.id';
  if (LIMIT) {
    sql += ` LIMIT ${Number(LIMIT)}`;
  }

  // LONGBLOB + prepared statement LIMIT 버그 회피: query() 사용
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows.map(r => ({
    metaId: r.metaId,
    fileId: r.fileId,
    fileName: r.fileName,
    content: r.content as Buffer,
    category: r.category || '문법',
  }));
}

async function fetchLiteratureFiles(pool: Pool): Promise<FileMeta[]> {
  let sql = `
    SELECT lm.id AS metaId, lf.id AS fileId, lf.file_name AS fileName,
           lf.content, lm.category
    FROM literature_meta lm
    JOIN literature_file lf ON lf.meta_id = lm.id
    WHERE lf.content IS NOT NULL
      AND lf.file_name LIKE '%.hwp'
  `;

  if (META_ID) {
    sql += ` AND lm.id = ${Number(META_ID)}`;
  }

  sql += ` AND NOT EXISTS (
    SELECT 1 FROM parsed_question pq
    WHERE pq.source_type = 'literature' AND pq.source_meta_id = lm.id
  )`;

  sql += ' ORDER BY lm.id';
  if (LIMIT) {
    sql += ` LIMIT ${Number(LIMIT)}`;
  }

  const [rows] = await pool.query<RowDataPacket[]>(sql);
  return rows.map(r => ({
    metaId: r.metaId,
    fileId: r.fileId,
    fileName: r.fileName,
    content: r.content as Buffer,
    category: r.category || '문학',
  }));
}

async function insertBatch(
  pool: Pool,
  sourceType: 'grammar' | 'literature',
  metaId: number,
  questions: ParsedQuestion[]
): Promise<number> {
  if (questions.length === 0) return 0;

  const values = questions.map(q => [
    sourceType,
    metaId,
    q.questionNumber,
    q.questionText,
    JSON.stringify(q.choices),
    q.answer,
    q.questionType.code,
    q.questionType.confidence,
  ]);

  const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const flat = values.flat();

  const [result] = await pool.execute(
    `INSERT INTO parsed_question
      (source_type, source_meta_id, question_number, question_text, choices, answer, question_type, confidence)
     VALUES ${placeholders}`,
    flat
  );

  return (result as any).affectedRows || 0;
}

function mapCategoryForClassifier(sourceType: string, category: string): string | undefined {
  if (sourceType === 'grammar') return '문법';
  // literature_meta.category는 '문학'이 기본
  if (category === '문학' || category === '독서' || category === '화작') return category;
  return '문학';
}

async function processFiles(
  pool: Pool,
  files: FileMeta[],
  sourceType: 'grammar' | 'literature'
): Promise<{ total: number; parsed: number; failed: number }> {
  let totalQuestions = 0;
  let failedFiles = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress = `[${i + 1}/${files.length}]`;

    try {
      // HWP 텍스트 추출
      const text = extractTextFromHwp(file.content);
      if (!text || text.trim().length < 20) {
        console.log(`${progress} ⏭ meta=${file.metaId} (${file.fileName}) - 텍스트 없음`);
        continue;
      }

      // 문제 파싱
      const classifyCategory = mapCategoryForClassifier(sourceType, file.category);
      const questions = parseHwpQuestions(text, classifyCategory);

      if (questions.length === 0) {
        console.log(`${progress} ⏭ meta=${file.metaId} (${file.fileName}) - 문제 0건`);
        continue;
      }

      if (DRY_RUN) {
        console.log(`${progress} 📋 meta=${file.metaId} (${file.fileName}) - ${questions.length}건`);
        for (const q of questions) {
          const typeLabel = `${q.questionType.code} (${q.questionType.nameKo})`;
          const conf = (q.questionType.confidence * 100).toFixed(0);
          console.log(`  Q${q.questionNumber}: ${typeLabel} [${conf}%] ${q.questionText.substring(0, 60)}...`);
        }
      } else {
        // DB INSERT (BATCH_SIZE 단위)
        for (let j = 0; j < questions.length; j += BATCH_SIZE) {
          const batch = questions.slice(j, j + BATCH_SIZE);
          await insertBatch(pool, sourceType, file.metaId, batch);
        }
        console.log(`${progress} ✅ meta=${file.metaId} - ${questions.length}건 저장`);
      }

      totalQuestions += questions.length;
    } catch (err) {
      failedFiles++;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`${progress} ❌ meta=${file.metaId} (${file.fileName}) - ${errMsg}`);
    }
  }

  return { total: files.length, parsed: totalQuestions, failed: failedFiles };
}

async function main() {
  console.log('=== 문제 유형 배치 분류 ===');
  console.log(`모드: ${DRY_RUN ? 'DRY-RUN (저장하지 않음)' : 'LIVE'}`);
  if (PROCESS_TYPE) console.log(`유형: ${PROCESS_TYPE}`);
  if (LIMIT) console.log(`제한: ${LIMIT}건`);
  if (META_ID) console.log(`메타 ID: ${META_ID}`);
  console.log('');

  const pool = createPool();

  try {
    // grammar 처리
    if (!PROCESS_TYPE || PROCESS_TYPE === 'grammar') {
      console.log('--- 문법 파일 처리 ---');
      const grammarFiles = await fetchGrammarFiles(pool);
      console.log(`대상: ${grammarFiles.length}건\n`);

      if (grammarFiles.length > 0) {
        const result = await processFiles(pool, grammarFiles, 'grammar');
        console.log(`\n문법 완료: ${result.parsed}문제 파싱, ${result.failed}건 실패\n`);
      }
    }

    // literature 처리
    if (!PROCESS_TYPE || PROCESS_TYPE === 'literature') {
      console.log('--- 문학 파일 처리 ---');
      const litFiles = await fetchLiteratureFiles(pool);
      console.log(`대상: ${litFiles.length}건\n`);

      if (litFiles.length > 0) {
        const result = await processFiles(pool, litFiles, 'literature');
        console.log(`\n문학 완료: ${result.parsed}문제 파싱, ${result.failed}건 실패\n`);
      }
    }

    console.log('=== 완료 ===');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
