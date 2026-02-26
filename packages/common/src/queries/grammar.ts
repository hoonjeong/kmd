import pool from '../db';
import type { GrammarMeta, GrammarFile } from '../types';
import type { RowDataPacket } from 'mysql2';
import { getDistinctValues, selectFileContent } from './meta-helpers';

// ── sub_category LIKE 검색 ──
export async function searchGrammarBySubCategory(
  subCategory: string,
  grade?: string,
  publisher?: string,
  limit = 20,
  offset = 0
): Promise<GrammarMeta[]> {
  let sql = `SELECT id, grade, publisher, category, sub_category as subCategory,
                    insert_time as insertTime
             FROM grammar_meta WHERE sub_category LIKE ?`;
  const params: (string | number)[] = ['%' + subCategory + '%'];

  if (grade) { sql += ' AND grade = ?'; params.push(grade); }
  if (publisher) { sql += ' AND publisher = ?'; params.push(publisher); }

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows as GrammarMeta[];
}

// ── 검색 결과 카운트 ──
export async function countGrammarBySubCategory(
  subCategory?: string,
  grade?: string,
  publisher?: string
): Promise<number> {
  let sql = 'SELECT COUNT(id) as total FROM grammar_meta';
  const params: string[] = [];
  const wheres: string[] = [];

  if (subCategory) { wheres.push('sub_category LIKE ?'); params.push('%' + subCategory + '%'); }
  if (grade) { wheres.push('grade = ?'); params.push(grade); }
  if (publisher) { wheres.push('publisher = ?'); params.push(publisher); }

  if (wheres.length > 0) sql += ' WHERE ' + wheres.join(' AND ');

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return (rows[0] as { total: number }).total;
}

// ── 파일 내용 조회 ──
export async function selectGrammarFileContent(metaId: number): Promise<GrammarFile | null> {
  return selectFileContent<GrammarFile>('grammar_file', metaId);
}

// ── 학년 목록 ──
export async function getDistinctGrammarGrades(): Promise<string[]> {
  return getDistinctValues('grammar_meta', 'grade');
}

// ── 출판사 목록 ──
export async function getDistinctGrammarPublishers(grade?: string): Promise<string[]> {
  return getDistinctValues('grammar_meta', 'publisher', { grade });
}
