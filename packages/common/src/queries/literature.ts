import pool from '../db';
import type { LiteratureMeta, LiteratureFile } from '../types';
import type { RowDataPacket } from 'mysql2';
import { getDistinctValues, selectFileContent } from './meta-helpers';

// ── 제목/작가 LIKE 검색 ──
export async function searchLiterature(opts: {
  title?: string;
  author?: string;
  grade?: string;
  publisher?: string;
  limit?: number;
  offset?: number;
}): Promise<LiteratureMeta[]> {
  let sql = `SELECT id, grade, publisher, category, title, author,
                    insert_time as insertTime
             FROM literature_meta`;
  const params: (string | number)[] = [];
  const wheres: string[] = [];

  if (opts.title) { wheres.push('title LIKE ?'); params.push('%' + opts.title + '%'); }
  if (opts.author) { wheres.push('author LIKE ?'); params.push('%' + opts.author + '%'); }
  if (opts.grade) { wheres.push('grade = ?'); params.push(opts.grade); }
  if (opts.publisher) { wheres.push('publisher = ?'); params.push(opts.publisher); }

  if (wheres.length > 0) sql += ' WHERE ' + wheres.join(' AND ');

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(opts.limit || 20, opts.offset || 0);

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows as LiteratureMeta[];
}

// ── 건수 ──
export async function countLiterature(opts: {
  title?: string;
  author?: string;
  grade?: string;
  publisher?: string;
}): Promise<number> {
  let sql = 'SELECT COUNT(id) as total FROM literature_meta';
  const params: string[] = [];
  const wheres: string[] = [];

  if (opts.title) { wheres.push('title LIKE ?'); params.push('%' + opts.title + '%'); }
  if (opts.author) { wheres.push('author LIKE ?'); params.push('%' + opts.author + '%'); }
  if (opts.grade) { wheres.push('grade = ?'); params.push(opts.grade); }
  if (opts.publisher) { wheres.push('publisher = ?'); params.push(opts.publisher); }

  if (wheres.length > 0) sql += ' WHERE ' + wheres.join(' AND ');

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return (rows[0] as { total: number }).total;
}

// ── 파일 내용 조회 ──
export async function selectLiteratureFileContent(metaId: number): Promise<LiteratureFile | null> {
  return selectFileContent<LiteratureFile>('literature_file', metaId);
}

// ── 학년 목록 ──
export async function getDistinctLiteratureGrades(): Promise<string[]> {
  return getDistinctValues('literature_meta', 'grade');
}

// ── 출판사 목록 ──
export async function getDistinctLiteraturePublishers(grade?: string): Promise<string[]> {
  return getDistinctValues('literature_meta', 'publisher', { grade });
}

// ── 작가 목록 ──
export async function getDistinctLiteratureAuthors(opts?: {
  title?: string;
  grade?: string;
  publisher?: string;
}): Promise<string[]> {
  let sql = `SELECT DISTINCT author FROM literature_meta
             WHERE author IS NOT NULL AND author != ''`;
  const params: string[] = [];

  if (opts?.title) { sql += ' AND title LIKE ?'; params.push('%' + opts.title + '%'); }
  if (opts?.grade) { sql += ' AND grade = ?'; params.push(opts.grade); }
  if (opts?.publisher) { sql += ' AND publisher = ?'; params.push(opts.publisher); }

  sql += ' ORDER BY author ASC';
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows.map(r => r.author as string);
}

// ── 작가별 작품 목록 ──
export interface AuthorWork {
  title: string;
  category: string;
  fileCount: number;
}

export async function getLiteratureWorksByAuthor(author: string): Promise<AuthorWork[]> {
  const sql = `SELECT IFNULL(title, '') as title,
                      IFNULL(category, '') as category,
                      COUNT(lf.id) as fileCount
               FROM literature_meta lm
               LEFT JOIN literature_file lf ON lf.meta_id = lm.id
               WHERE lm.author LIKE ?
               GROUP BY lm.title, lm.category
               ORDER BY lm.category ASC, lm.title ASC`;
  const [rows] = await pool.query<RowDataPacket[]>(sql, ['%' + author + '%']);
  return rows as AuthorWork[];
}
