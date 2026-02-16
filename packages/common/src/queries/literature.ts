import pool from '../db';
import type { Literature, ExamQuestionWithChoices } from '../types';
import type { RowDataPacket } from 'mysql2';
import { fetchQuestionsWithChoicesByPassageIds } from './question-helpers';

const LITERATURE = 'kaca.literature';
const EXAM_QUESTION = 'kaca.exam_question';

// ── 지문+문제+선지 묶음 타입 ──
export interface LiteraturePassageSet {
  passage: Literature;
  questions: ExamQuestionWithChoices[];
}

// ── 작품명 검색 ──
export async function searchLiteratureByTitle(title: string, limit = 20, offset = 0): Promise<Literature[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, prev_test_meta_id as prevTestMetaId, prev_test_file_id as prevTestFileId,
            content, category, sub_category as subCategory, title, author,
            insert_time as insertTime
     FROM ${LITERATURE}
     WHERE title LIKE ?
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    ['%' + title + '%', limit, offset]
  );
  return rows as Literature[];
}

// ── 작가명 검색 ──
export async function searchLiteratureByAuthor(author: string, limit = 20, offset = 0): Promise<Literature[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, prev_test_meta_id as prevTestMetaId, prev_test_file_id as prevTestFileId,
            content, category, sub_category as subCategory, title, author,
            insert_time as insertTime
     FROM ${LITERATURE}
     WHERE author LIKE ?
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    ['%' + author + '%', limit, offset]
  );
  return rows as Literature[];
}

// ── 복합 필터 검색 ──
export async function searchLiteratureByFilters(opts: {
  title?: string;
  author?: string;
  subCategories?: string[];
  questionPatterns?: string[];
  limit?: number;
  offset?: number;
}): Promise<Literature[]> {
  let sql = `SELECT id, prev_test_meta_id as prevTestMetaId, prev_test_file_id as prevTestFileId,
             content, category, sub_category as subCategory, title, author,
             insert_time as insertTime
             FROM ${LITERATURE}`;
  const params: (string | number)[] = [];
  const wheres: string[] = [];

  if (opts.questionPatterns && opts.questionPatterns.length > 0) {
    wheres.push(`id IN (SELECT DISTINCT passage_id FROM ${EXAM_QUESTION} WHERE passage_id IS NOT NULL AND question_pattern IN (${opts.questionPatterns.map(() => '?').join(',')}))`);
    params.push(...opts.questionPatterns);
  }

  if (opts.title) {
    wheres.push('title LIKE ?');
    params.push('%' + opts.title + '%');
  }
  if (opts.author) {
    wheres.push('author LIKE ?');
    params.push('%' + opts.author + '%');
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
  return rows as Literature[];
}

// ── 복합 필터 카운트 ──
export async function countLiteratureByFilters(opts: {
  title?: string;
  author?: string;
  subCategories?: string[];
  questionPatterns?: string[];
}): Promise<number> {
  let sql = `SELECT COUNT(*) as total FROM ${LITERATURE}`;
  const params: (string | number)[] = [];
  const wheres: string[] = [];

  if (opts.questionPatterns && opts.questionPatterns.length > 0) {
    wheres.push(`id IN (SELECT DISTINCT passage_id FROM ${EXAM_QUESTION} WHERE passage_id IS NOT NULL AND question_pattern IN (${opts.questionPatterns.map(() => '?').join(',')}))`);
    params.push(...opts.questionPatterns);
  }

  if (opts.title) {
    wheres.push('title LIKE ?');
    params.push('%' + opts.title + '%');
  }
  if (opts.author) {
    wheres.push('author LIKE ?');
    params.push('%' + opts.author + '%');
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
export async function selectLiteraturePassageSets(opts: {
  title?: string;
  author?: string;
  subCategories?: string[];
  questionPatterns?: string[];
  passageLimit?: number;
}): Promise<LiteraturePassageSet[]> {
  // 1) 조건에 맞는 지문 ID 조회
  const passages = await searchLiteratureByFilters({
    ...opts,
    limit: opts.passageLimit || 5,
    offset: 0,
  });

  if (passages.length === 0) return [];

  // 2) 배치로 문제+선지 조회
  const passageIds = passages.map(p => p.id);
  const questionsMap = await fetchQuestionsWithChoicesByPassageIds(passageIds, opts.questionPatterns);

  return passages.map(p => ({
    passage: p,
    questions: questionsMap.get(p.id) || [],
  }));
}

// ── 문학 sub_category 목록 ──
export async function getDistinctLiteratureSubCategories(): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT sub_category FROM ${LITERATURE} WHERE sub_category IS NOT NULL AND sub_category != '' ORDER BY sub_category ASC`
  );
  return rows.map(r => r.sub_category as string);
}

// ── 문학 question_pattern 목록 ──
export async function getDistinctLiteratureQuestionPatterns(subCategories?: string[]): Promise<string[]> {
  let sql = `SELECT DISTINCT question_pattern
             FROM ${EXAM_QUESTION}
             WHERE category = '문학' AND question_pattern IS NOT NULL AND question_pattern != ''`;
  const params: string[] = [];

  if (subCategories && subCategories.length > 0) {
    sql += ` AND sub_category IN (${subCategories.map(() => '?').join(',')})`;
    params.push(...subCategories);
  }

  sql += ' ORDER BY question_pattern ASC';
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows.map(r => r.question_pattern as string);
}
