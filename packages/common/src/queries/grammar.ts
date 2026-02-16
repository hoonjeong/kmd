import pool from '../db';
import type { GrammarFileMeta, GrammarFileContent } from '../types';
import type { RowDataPacket } from 'mysql2';

const SPLIT_FILE_META = 'kaca.split_file_meta_info';
const SPLIT_FILE_CONTENT = 'kaca.split_file_content';

// ── 키워드 검색 ──
export async function searchGrammarFiles(keyword: string, limit = 20, offset = 0): Promise<GrammarFileMeta[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, grade, subject, publisher, search_keyword as searchKeyword,
            school_name as schoolName, year, term, test_type as testType,
            file_type as fileType, insert_time as insertTime
     FROM ${SPLIT_FILE_META}
     WHERE search_keyword LIKE ?
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    ['%' + keyword + '%', limit, offset]
  );
  return rows as GrammarFileMeta[];
}

// ── 검색 결과 카운트 ──
export async function countGrammarFiles(keyword?: string): Promise<number> {
  let sql = `SELECT COUNT(*) as total FROM ${SPLIT_FILE_META}`;
  const params: string[] = [];

  if (keyword) {
    sql += ' WHERE search_keyword LIKE ?';
    params.push('%' + keyword + '%');
  }

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return (rows[0] as { total: number }).total;
}

// ── 단일 파일 콘텐츠 조회 ──
export async function selectGrammarFileContent(metaId: number): Promise<GrammarFileContent | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, meta_id as metaId, file_name as fileName, content, insert_time as insertTime
     FROM ${SPLIT_FILE_CONTENT}
     WHERE meta_id = ? LIMIT 1`,
    [metaId]
  );
  if (rows.length === 0) return null;
  const row = rows[0] as GrammarFileContent;
  // content는 longblob이므로 Buffer → string 변환
  if (row.content && Buffer.isBuffer(row.content)) {
    row.content = row.content.toString('utf8');
  }
  return row;
}

// ── 여러 파일 메타 조회 ──
export async function selectGrammarFilesByIds(ids: number[]): Promise<GrammarFileMeta[]> {
  if (ids.length === 0) return [];
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, grade, subject, publisher, search_keyword as searchKeyword,
            school_name as schoolName, year, term, test_type as testType,
            file_type as fileType, insert_time as insertTime
     FROM ${SPLIT_FILE_META}
     WHERE id IN (${ids.map(() => '?').join(',')})
     ORDER BY id DESC`,
    ids
  );
  return rows as GrammarFileMeta[];
}
