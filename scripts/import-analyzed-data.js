/**
 * import-analyzed-data.js (최적화 v2)
 * 분석된 JSON 파일들을 DB에 임포트
 * 배치 10개 파일씩 하나의 트랜잭션으로 처리
 *
 * 실행: node scripts/import-analyzed-data.js [--dry-run]
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const ANALYZED_DIR = path.resolve(__dirname, '../data/analyzed');
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 10; // 파일 배치 크기

// ── 환경변수 로드 ──
const envPath = path.resolve(__dirname, '../apps/root/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const key = line.substring(0, idx).trim();
    const val = line.substring(idx + 1).trim();
    if (key) env[key] = val;
  }
});

function trunc(str, maxLen) {
  if (!str) return null;
  return str.length > maxLen ? str.substring(0, maxLen) : str;
}

async function main() {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: Number(env.DB_PORT) || 3306,
    database: env.DB_NAME || 'edenschool',
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    charset: 'utf8mb4',
    connectionLimit: 5,
  });

  if (DRY_RUN) console.log('=== DRY RUN MODE ===');

  const files = fs.readdirSync(ANALYZED_DIR)
    .filter(f => f.endsWith('.json') && f.startsWith('meta_'))
    .sort();

  console.log('Total files:', files.length);

  // 이미 임포트된 파일 체크
  const [ep] = await pool.query('SELECT DISTINCT CONCAT(prev_test_meta_id,"_",prev_test_file_id) as k FROM passage');
  const [eq] = await pool.query('SELECT DISTINCT CONCAT(prev_test_meta_id,"_",prev_test_file_id) as k FROM exam_question');
  const importedSet = new Set();
  ep.forEach(r => importedSet.add(r.k));
  eq.forEach(r => importedSet.add(r.k));
  console.log('Already imported:', importedSet.size);

  // 임포트 필요한 파일만 필터
  const toImport = [];
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(ANALYZED_DIR, f), 'utf8'));
    if (!importedSet.has(data.metaId + '_' + data.fileId)) {
      toImport.push({ file: f, data });
    }
  }
  console.log('Files to import:', toImport.length);

  let totalP = 0, totalQ = 0, totalC = 0, errorCount = 0;
  const startTime = Date.now();

  // 배치 처리
  for (let bi = 0; bi < toImport.length; bi += BATCH_SIZE) {
    const batch = toImport.slice(bi, bi + BATCH_SIZE);

    if (DRY_RUN) {
      for (const item of batch) {
        const { passages, standaloneQuestions } = item.data;
        totalP += passages.length;
        totalQ += passages.reduce((s, p) => s + p.questions.length, 0) + standaloneQuestions.length;
      }
      continue;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const item of batch) {
        const { metaId, fileId, passages, standaloneQuestions } = item.data;

        for (const passage of passages) {
          const [pRes] = await conn.query(
            'INSERT INTO passage (prev_test_meta_id,prev_test_file_id,content,category,sub_category,title,author,keywords,insert_time) VALUES (?,?,?,?,?,?,?,?,NOW())',
            [metaId, fileId, passage.content || '', trunc(passage.category, 20) || '기타',
             trunc(passage.subCategory, 50), trunc(passage.title, 200), trunc(passage.author, 100),
             trunc(passage.keywords, 500)]
          );
          const passageId = pRes.insertId;
          totalP++;

          if (passage.questions && passage.questions.length > 0) {
            // 배치 question INSERT
            const qValues = passage.questions.map(q => [
              passageId, metaId, fileId, q.questionNumber, q.questionText || '',
              trunc(q.questionType, 20) || '객관식', q.referenceText || null,
              trunc(q.category, 20), trunc(q.subCategory, 50), trunc(q.keywords, 500),
              trunc(q.answer, 100), q.explanation || null, trunc(q.questionPattern, 100)
            ]);
            const [qRes] = await conn.query(
              'INSERT INTO exam_question (passage_id,prev_test_meta_id,prev_test_file_id,question_number,question_text,question_type,reference_text,category,sub_category,keywords,answer,explanation,question_pattern) VALUES ?',
              [qValues]
            );
            const firstQId = qRes.insertId;
            totalQ += passage.questions.length;

            // 선지 배치 INSERT
            const allChoices = [];
            for (let qi = 0; qi < passage.questions.length; qi++) {
              const questionId = firstQId + qi;
              const q = passage.questions[qi];
              if (q.choices && q.choices.length > 0) {
                for (const c of q.choices) {
                  allChoices.push([questionId, c.choiceNumber, c.choiceText || '', c.isAnswer ? 1 : 0]);
                }
              }
            }
            if (allChoices.length > 0) {
              await conn.query(
                'INSERT INTO exam_question_choice (question_id,choice_number,choice_text,is_answer) VALUES ?',
                [allChoices]
              );
              totalC += allChoices.length;
            }
          }
        }

        // 독립 문제
        if (standaloneQuestions && standaloneQuestions.length > 0) {
          const sqValues = standaloneQuestions.map(q => [
            null, metaId, fileId, q.questionNumber, q.questionText || '',
            trunc(q.questionType, 20) || '객관식', q.referenceText || null,
            trunc(q.category, 20), trunc(q.subCategory, 50), trunc(q.keywords, 500),
            trunc(q.answer, 100), q.explanation || null, trunc(q.questionPattern, 100)
          ]);
          const [sqRes] = await conn.query(
            'INSERT INTO exam_question (passage_id,prev_test_meta_id,prev_test_file_id,question_number,question_text,question_type,reference_text,category,sub_category,keywords,answer,explanation,question_pattern) VALUES ?',
            [sqValues]
          );
          const firstSQId = sqRes.insertId;
          totalQ += standaloneQuestions.length;

          const allChoices = [];
          for (let qi = 0; qi < standaloneQuestions.length; qi++) {
            const questionId = firstSQId + qi;
            const q = standaloneQuestions[qi];
            if (q.choices && q.choices.length > 0) {
              for (const c of q.choices) {
                allChoices.push([questionId, c.choiceNumber, c.choiceText || '', c.isAnswer ? 1 : 0]);
              }
            }
          }
          if (allChoices.length > 0) {
            await conn.query(
              'INSERT INTO exam_question_choice (question_id,choice_number,choice_text,is_answer) VALUES ?',
              [allChoices]
            );
            totalC += allChoices.length;
          }
        }
      }

      await conn.commit();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const progress = Math.min(bi + BATCH_SIZE, toImport.length);
      if (progress % 50 === 0 || bi === 0 || progress >= toImport.length) {
        console.log('[' + progress + '/' + toImport.length + '] ' + elapsed + 's (P:' + totalP + ' Q:' + totalQ + ' C:' + totalC + ')');
      }
    } catch (err) {
      await conn.rollback();
      errorCount++;
      console.error('BATCH ERROR at ' + bi + ': ' + err.message);
    } finally {
      conn.release();
    }
  }

  console.log('\n=== Import Summary ===');
  console.log('Mode:', DRY_RUN ? 'DRY RUN' : 'LIVE');
  console.log('Errors:', errorCount);
  console.log('Passages:', totalP);
  console.log('Questions:', totalQ);
  console.log('Choices:', totalC);
  console.log('Duration:', ((Date.now() - startTime) / 1000).toFixed(0) + 's');

  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
