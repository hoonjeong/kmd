import pool from '../db';
import type { Reading, ExamQuestionWithChoices } from '../types';
import type { RowDataPacket } from 'mysql2';
import { fetchQuestionsWithChoicesByPassageIds } from './question-helpers';

const READING = 'kaca.reading';
const EXAM_QUESTION = 'kaca.exam_question';

// ── 지문+문제+선지 묶음 타입 ──
export interface ReadingPassageSet {
  passage: Reading;
  questions: ExamQuestionWithChoices[];
}

// ── 키워드 검색 ──
export async function searchReadingByKeyword(keyword: string, limit = 20, offset = 0): Promise<Reading[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, prev_test_meta_id as prevTestMetaId, prev_test_file_id as prevTestFileId,
            content, category, sub_category as subCategory, keywords,
            insert_time as insertTime
     FROM ${READING}
     WHERE keywords LIKE ?
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    ['%' + keyword + '%', limit, offset]
  );
  return rows as Reading[];
}

// ── 복합 필터 검색 ──
export async function searchReadingByFilters(opts: {
  keyword?: string;
  subCategories?: string[];
  questionPatterns?: string[];
  limit?: number;
  offset?: number;
}): Promise<Reading[]> {
  let sql = `SELECT id, prev_test_meta_id as prevTestMetaId, prev_test_file_id as prevTestFileId,
             content, category, sub_category as subCategory, keywords,
             insert_time as insertTime
             FROM ${READING}`;
  const params: (string | number)[] = [];
  const wheres: string[] = [];

  if (opts.questionPatterns && opts.questionPatterns.length > 0) {
    wheres.push(`id IN (SELECT DISTINCT passage_id FROM ${EXAM_QUESTION} WHERE passage_id IS NOT NULL AND question_pattern IN (${opts.questionPatterns.map(() => '?').join(',')}))`);
    params.push(...opts.questionPatterns);
  }

  if (opts.keyword) {
    wheres.push('keywords LIKE ?');
    params.push('%' + opts.keyword + '%');
  }
  if (opts.subCategories && opts.subCategories.length > 0) {
    wheres.push(`sub_category IN (${opts.subCategories.map(() => '?').join(',')})`);
    params.push(...opts.subCategories);
  }

  if (wheres.length > 0) {
    sql += ' WHERE ' + wheres.join(' AND ');
  }

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(opts.limit || 20, opts.offset || 0);

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows as Reading[];
}

// ── 복합 필터 카운트 ──
export async function countReadingByFilters(opts: {
  keyword?: string;
  subCategories?: string[];
  questionPatterns?: string[];
}): Promise<number> {
  let sql = `SELECT COUNT(*) as total FROM ${READING}`;
  const params: (string | number)[] = [];
  const wheres: string[] = [];

  if (opts.questionPatterns && opts.questionPatterns.length > 0) {
    wheres.push(`id IN (SELECT DISTINCT passage_id FROM ${EXAM_QUESTION} WHERE passage_id IS NOT NULL AND question_pattern IN (${opts.questionPatterns.map(() => '?').join(',')}))`);
    params.push(...opts.questionPatterns);
  }

  if (opts.keyword) {
    wheres.push('keywords LIKE ?');
    params.push('%' + opts.keyword + '%');
  }
  if (opts.subCategories && opts.subCategories.length > 0) {
    wheres.push(`sub_category IN (${opts.subCategories.map(() => '?').join(',')})`);
    params.push(...opts.subCategories);
  }

  if (wheres.length > 0) {
    sql += ' WHERE ' + wheres.join(' AND ');
  }

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return (rows[0] as { total: number }).total;
}

// ── 지문+문제+선지 묶음 조회 ──
export async function selectReadingPassageSets(opts: {
  keyword?: string;
  subCategories?: string[];
  questionPatterns?: string[];
  passageLimit?: number;
}): Promise<ReadingPassageSet[]> {
  const passages = await searchReadingByFilters({
    ...opts,
    limit: opts.passageLimit || 5,
    offset: 0,
  });

  if (passages.length === 0) return [];

  // 배치로 문제+선지 조회
  const passageIds = passages.map(p => p.id);
  const questionsMap = await fetchQuestionsWithChoicesByPassageIds(passageIds, opts.questionPatterns);

  return passages.map(p => ({
    passage: p,
    questions: questionsMap.get(p.id) || [],
  }));
}

// ── 독서 sub_category 목록 ──
export async function getDistinctReadingSubCategories(): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT sub_category FROM ${READING} WHERE sub_category IS NOT NULL AND sub_category != '' ORDER BY sub_category ASC`
  );
  return rows.map(r => r.sub_category as string);
}

// ── 독서 question_pattern 목록 ──
export async function getDistinctReadingQuestionPatterns(subCategories?: string[]): Promise<string[]> {
  let sql = `SELECT DISTINCT question_pattern
             FROM ${EXAM_QUESTION}
             WHERE category = '독서' AND question_pattern IS NOT NULL AND question_pattern != ''`;
  const params: string[] = [];

  if (subCategories && subCategories.length > 0) {
    sql += ` AND sub_category IN (${subCategories.map(() => '?').join(',')})`;
    params.push(...subCategories);
  }

  sql += ' ORDER BY question_pattern ASC';
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows.map(r => r.question_pattern as string);
}
