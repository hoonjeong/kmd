import pool from '../db';
import type { Passage, ExamQuestion, ExamQuestionChoice, PassageWithQuestions, ExamQuestionWithChoices } from '../types';
import type { RowDataPacket } from 'mysql2';
import { fetchQuestionsWithChoicesByPassageIds } from './question-helpers';

// 기출문제 테이블은 kaca DB에 존재
const PASSAGE = 'kaca.passage';
const EXAM_QUESTION = 'kaca.exam_question';
const EXAM_QUESTION_CHOICE = 'kaca.exam_question_choice';

// ── 지문 검색 (FULLTEXT) ──
export async function searchPassages(keyword: string, limit = 20, offset = 0): Promise<Passage[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, prev_test_meta_id as prevTestMetaId, prev_test_file_id as prevTestFileId,
            content, category, sub_category as subCategory, title, author, keywords,
            insert_time as insertTime
     FROM ${PASSAGE}
     WHERE MATCH(content) AGAINST(? IN BOOLEAN MODE)
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    [keyword, limit, offset]
  );
  return rows as Passage[];
}

// ── 지문 키워드 검색 ──
export async function searchPassagesByKeyword(keyword: string, limit = 20, offset = 0): Promise<Passage[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, prev_test_meta_id as prevTestMetaId, prev_test_file_id as prevTestFileId,
            content, category, sub_category as subCategory, title, author, keywords,
            insert_time as insertTime
     FROM ${PASSAGE}
     WHERE MATCH(keywords) AGAINST(? IN BOOLEAN MODE)
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    [keyword, limit, offset]
  );
  return rows as Passage[];
}

// ── 카테고리별 지문 목록 ──
export async function selectPassagesByCategory(category: string, subCategory?: string, limit = 20, offset = 0): Promise<Passage[]> {
  let sql = `SELECT id, prev_test_meta_id as prevTestMetaId, prev_test_file_id as prevTestFileId,
             content, category, sub_category as subCategory, title, author, keywords,
             insert_time as insertTime
             FROM ${PASSAGE} WHERE category = ?`;
  const params: (string | number)[] = [category];

  if (subCategory) {
    sql += ' AND sub_category = ?';
    params.push(subCategory);
  }

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows as Passage[];
}

// ── 작가/작품명으로 문학 지문 검색 ──
export async function searchLiteraryPassages(opts: { title?: string; author?: string }, limit = 20, offset = 0): Promise<Passage[]> {
  let sql = `SELECT id, prev_test_meta_id as prevTestMetaId, prev_test_file_id as prevTestFileId,
             content, category, sub_category as subCategory, title, author, keywords,
             insert_time as insertTime
             FROM ${PASSAGE} WHERE category = '문학'`;
  const params: (string | number)[] = [];

  if (opts.title) {
    sql += ' AND title LIKE ?';
    params.push('%' + opts.title + '%');
  }
  if (opts.author) {
    sql += ' AND author LIKE ?';
    params.push('%' + opts.author + '%');
  }

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows as Passage[];
}

// ── 지문 + 연관 문제 + 선지 조회 ──
export async function selectPassageWithQuestions(passageId: number): Promise<PassageWithQuestions | null> {
  // 지문 조회
  const [passageRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, prev_test_meta_id as prevTestMetaId, prev_test_file_id as prevTestFileId,
            content, category, sub_category as subCategory, title, author, keywords,
            insert_time as insertTime
     FROM ${PASSAGE} WHERE id = ?`,
    [passageId]
  );
  if (passageRows.length === 0) return null;
  const passage = passageRows[0] as Passage;

  // 배치로 문제+선지 조회
  const questionsMap = await fetchQuestionsWithChoicesByPassageIds([passageId]);
  const questionsWithChoices = questionsMap.get(passageId) || [];

  return { ...passage, questions: questionsWithChoices };
}

// ── 지문별 문제 목록 ──
export async function selectQuestionsByPassageId(passageId: number): Promise<ExamQuestion[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, passage_id as passageId, prev_test_meta_id as prevTestMetaId, prev_test_file_id as prevTestFileId,
            question_number as questionNumber, question_text as questionText, question_type as questionType,
            reference_text as referenceText, category, sub_category as subCategory, keywords,
            answer, explanation, question_pattern as questionPattern, insert_time as insertTime
     FROM ${EXAM_QUESTION} WHERE passage_id = ? ORDER BY question_number ASC`,
    [passageId]
  );
  return rows as ExamQuestion[];
}

// ── 문제별 선지 목록 ──
export async function selectChoicesByQuestionId(questionId: number): Promise<ExamQuestionChoice[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, question_id as questionId, choice_number as choiceNumber,
            choice_text as choiceText, is_answer as isAnswer
     FROM ${EXAM_QUESTION_CHOICE} WHERE question_id = ? ORDER BY choice_number ASC`,
    [questionId]
  );
  return rows.map(r => ({ ...r, isAnswer: !!r.isAnswer })) as ExamQuestionChoice[];
}

// ── 문제 FULLTEXT 검색 ──
export async function searchQuestions(keyword: string, limit = 20, offset = 0): Promise<ExamQuestion[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, passage_id as passageId, prev_test_meta_id as prevTestMetaId, prev_test_file_id as prevTestFileId,
            question_number as questionNumber, question_text as questionText, question_type as questionType,
            reference_text as referenceText, category, sub_category as subCategory, keywords,
            answer, explanation, question_pattern as questionPattern, insert_time as insertTime
     FROM ${EXAM_QUESTION}
     WHERE MATCH(question_text) AGAINST(? IN BOOLEAN MODE)
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    [keyword, limit, offset]
  );
  return rows as ExamQuestion[];
}

// ── 카테고리 + 서브카테고리 + 패턴 필터 문제 검색 ──
export async function selectQuestionsByFilter(opts: {
  category?: string;
  subCategory?: string;
  questionPattern?: string;
  limit?: number;
  offset?: number;
}): Promise<ExamQuestion[]> {
  let sql = `SELECT id, passage_id as passageId, prev_test_meta_id as prevTestMetaId, prev_test_file_id as prevTestFileId,
             question_number as questionNumber, question_text as questionText, question_type as questionType,
             reference_text as referenceText, category, sub_category as subCategory, keywords,
             answer, explanation, question_pattern as questionPattern, insert_time as insertTime
             FROM ${EXAM_QUESTION} WHERE 1=1`;
  const params: (string | number)[] = [];

  if (opts.category) {
    sql += ' AND category = ?';
    params.push(opts.category);
  }
  if (opts.subCategory) {
    sql += ' AND sub_category = ?';
    params.push(opts.subCategory);
  }
  if (opts.questionPattern) {
    sql += ' AND question_pattern = ?';
    params.push(opts.questionPattern);
  }

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(opts.limit || 20, opts.offset || 0);

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows as ExamQuestion[];
}

// ── 문제 ID로 단일 조회 (선지 포함) ──
export async function selectQuestionWithChoices(questionId: number): Promise<ExamQuestionWithChoices | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, passage_id as passageId, prev_test_meta_id as prevTestMetaId, prev_test_file_id as prevTestFileId,
            question_number as questionNumber, question_text as questionText, question_type as questionType,
            reference_text as referenceText, category, sub_category as subCategory, keywords,
            answer, explanation, question_pattern as questionPattern, insert_time as insertTime
     FROM ${EXAM_QUESTION} WHERE id = ?`,
    [questionId]
  );
  if (rows.length === 0) return null;
  const question = rows[0] as ExamQuestion;
  const choices = await selectChoicesByQuestionId(questionId);
  return { ...question, choices };
}

// ── 키워드 순차 검색 조건 (문학: title= → author= → keywords LIKE / 기타: keywords LIKE) ──
function getKeywordSteps(keyword: string, categories?: string[]): { sql: string; params: string[] }[] {
  const kw = keyword.replace(/\s+/g, '').trim();
  const hasLiterature = !categories || categories.length === 0 || categories.includes('문학');

  if (hasLiterature) {
    return [
      { sql: ' AND REPLACE(p.title, \' \', \'\') = ?', params: [kw] },
      { sql: ' AND REPLACE(p.author, \' \', \'\') = ?', params: [kw] },
      { sql: ' AND p.keywords LIKE ?', params: ['%' + kw + '%'] },
    ];
  }
  return [
    { sql: ' AND p.keywords LIKE ?', params: ['%' + kw + '%'] },
  ];
}

// ── 조건별 문항 수 COUNT ──
export async function countQuestionsByFilter(opts: {
  categories?: string[];
  subCategories?: string[];
  questionPatterns?: string[];
  keyword?: string;
}): Promise<number> {
  // 기본 필터 조건 (keyword 제외)
  let baseWhere = '';
  const baseParams: (string | number)[] = [];

  if (opts.categories && opts.categories.length > 0) {
    baseWhere += ` AND eq.category IN (${opts.categories.map(() => '?').join(',')})`;
    baseParams.push(...opts.categories);
  }
  if (opts.subCategories && opts.subCategories.length > 0) {
    baseWhere += ` AND eq.sub_category IN (${opts.subCategories.map(() => '?').join(',')})`;
    baseParams.push(...opts.subCategories);
  }
  if (opts.questionPatterns && opts.questionPatterns.length > 0) {
    baseWhere += ` AND eq.question_pattern IN (${opts.questionPatterns.map(() => '?').join(',')})`;
    baseParams.push(...opts.questionPatterns);
  }

  // keyword 없으면 JOIN 없이 빠르게
  if (!opts.keyword) {
    const sql = `SELECT COUNT(*) as total FROM ${EXAM_QUESTION} eq WHERE 1=1` + baseWhere;
    const [rows] = await pool.query<RowDataPacket[]>(sql, baseParams);
    return (rows[0] as { total: number }).total;
  }

  // keyword 있으면 = 검색만 시도 (title, author). LIKE는 느려서 카운트에서 제외
  const steps = getKeywordSteps(opts.keyword, opts.categories);
  const eqSteps = steps.filter(s => !s.sql.includes('LIKE'));
  const baseSql = `SELECT COUNT(*) as total FROM ${EXAM_QUESTION} eq LEFT JOIN ${PASSAGE} p ON eq.passage_id = p.id WHERE 1=1` + baseWhere;

  for (const step of eqSteps) {
    const sql = baseSql + step.sql;
    const params = [...baseParams, ...step.params];
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    const total = (rows[0] as { total: number }).total;
    if (total > 0) return total;
  }

  // = 검색에 매칭 없으면 키워드 무시하고 기본 필터만으로 카운트
  const sql = `SELECT COUNT(*) as total FROM ${EXAM_QUESTION} eq WHERE 1=1` + baseWhere;
  const [rows] = await pool.query<RowDataPacket[]>(sql, baseParams);
  return (rows[0] as { total: number }).total;
}

// ── 지문 단위로 묶어 조회 (지문 N세트) ──
export interface PassageSet {
  passage: Passage | null;
  questions: ExamQuestionWithChoices[];
}

export async function selectPassageSetsByFilter(opts: {
  categories?: string[];
  subCategories?: string[];
  questionPatterns?: string[];
  keyword?: string;
  passageLimit?: number;
}): Promise<PassageSet[]> {
  // 기본 필터 조건
  let baseWhere = '';
  const baseParams: (string | number)[] = [];

  if (opts.categories && opts.categories.length > 0) {
    baseWhere += ` AND eq.category IN (${opts.categories.map(() => '?').join(',')})`;
    baseParams.push(...opts.categories);
  }
  if (opts.subCategories && opts.subCategories.length > 0) {
    baseWhere += ` AND eq.sub_category IN (${opts.subCategories.map(() => '?').join(',')})`;
    baseParams.push(...opts.subCategories);
  }
  if (opts.questionPatterns && opts.questionPatterns.length > 0) {
    baseWhere += ` AND eq.question_pattern IN (${opts.questionPatterns.map(() => '?').join(',')})`;
    baseParams.push(...opts.questionPatterns);
  }

  const limit = opts.passageLimit || 2;
  let passageIds: number[] = [];

  if (opts.keyword) {
    // 순차 검색 (title= → author= → keywords LIKE)
    const steps = getKeywordSteps(opts.keyword, opts.categories);
    const baseSql = `SELECT DISTINCT eq.passage_id as passageId
                     FROM ${EXAM_QUESTION} eq
                     LEFT JOIN ${PASSAGE} p ON eq.passage_id = p.id
                     WHERE eq.passage_id IS NOT NULL` + baseWhere;

    for (const step of steps) {
      const sql = baseSql + step.sql + ` ORDER BY eq.passage_id DESC LIMIT ?`;
      const params = [...baseParams, ...step.params, limit];
      const [idRows] = await pool.query<RowDataPacket[]>(sql, params);
      passageIds = idRows.map(r => r.passageId as number);
      if (passageIds.length > 0) break;
    }
  } else {
    const sql = `SELECT DISTINCT eq.passage_id as passageId
                 FROM ${EXAM_QUESTION} eq
                 WHERE eq.passage_id IS NOT NULL` + baseWhere +
                 ` ORDER BY eq.passage_id DESC LIMIT ?`;
    const params = [...baseParams, limit];
    const [idRows] = await pool.query<RowDataPacket[]>(sql, params);
    passageIds = idRows.map(r => r.passageId as number);
  }

  if (passageIds.length === 0) return [];

  // 지문 일괄 조회
  const [passageRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, prev_test_meta_id as prevTestMetaId, prev_test_file_id as prevTestFileId,
            content, category, sub_category as subCategory, title, author, keywords,
            insert_time as insertTime
     FROM ${PASSAGE} WHERE id IN (${passageIds.map(() => '?').join(',')})`,
    passageIds
  );
  const passages = passageRows as Passage[];

  // 문제+선지 배치 조회
  const questionsMap = await fetchQuestionsWithChoicesByPassageIds(passageIds);

  return passages.map(p => ({
    passage: p,
    questions: questionsMap.get(p.id) || [],
  }));
}

// ── DB에서 distinct 목록 조회 ──
export async function getDistinctCategories(): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT category FROM ${EXAM_QUESTION} WHERE category IS NOT NULL AND category != '' ORDER BY category ASC`
  );
  return rows.map(r => r.category as string);
}

export async function getDistinctSubCategories(categories?: string[]): Promise<string[]> {
  let sql = `SELECT DISTINCT sub_category FROM ${EXAM_QUESTION} WHERE sub_category IS NOT NULL AND sub_category != ''`;
  const params: string[] = [];
  if (categories && categories.length > 0) {
    sql += ` AND category IN (${categories.map(() => '?').join(',')})`;
    params.push(...categories);
  }
  sql += ' ORDER BY sub_category ASC';
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows.map(r => r.sub_category as string);
}

export async function getDistinctQuestionPatterns(categories?: string[]): Promise<string[]> {
  let sql = `SELECT DISTINCT question_pattern FROM ${EXAM_QUESTION} WHERE question_pattern IS NOT NULL AND question_pattern != ''`;
  const params: string[] = [];
  if (categories && categories.length > 0) {
    sql += ` AND category IN (${categories.map(() => '?').join(',')})`;
    params.push(...categories);
  }
  sql += ' ORDER BY question_pattern ASC';
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows.map(r => r.question_pattern as string);
}

// ── 지문 제목/작가 업데이트 ──
export async function updatePassageTitleAuthor(passageId: number, title: string, author: string): Promise<void> {
  await pool.query(
    `UPDATE ${PASSAGE} SET title = ?, author = ? WHERE id = ?`,
    [title || null, author || null, passageId]
  );
}
