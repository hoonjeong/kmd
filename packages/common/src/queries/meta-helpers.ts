import pool from '../db';
import type { RowDataPacket } from 'mysql2';

type MetaTable = 'grammar_meta' | 'literature_meta';
type FileTable = 'grammar_file' | 'literature_file';

/** 메타 테이블에서 DISTINCT 값 조회 */
export async function getDistinctValues(
  table: MetaTable,
  field: string,
  filters?: { grade?: string; publisher?: string }
): Promise<string[]> {
  let sql = `SELECT DISTINCT ${field} FROM ${table} WHERE ${field} IS NOT NULL AND ${field} != ''`;
  const params: string[] = [];

  if (filters?.grade) {
    sql += ' AND grade = ?';
    params.push(filters.grade);
  }
  if (filters?.publisher) {
    sql += ' AND publisher = ?';
    params.push(filters.publisher);
  }

  sql += ` ORDER BY ${field} ASC`;
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows.map(r => r[field] as string);
}

/** 파일 테이블에서 meta_id로 내용 조회 */
export async function selectFileContent<T>(
  table: FileTable,
  metaId: number
): Promise<T | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, meta_id as metaId, file_name as fileName, content, insert_time as insertTime
     FROM ${table} WHERE meta_id = ? LIMIT 1`,
    [metaId]
  );
  if (rows.length === 0) return null;
  const row = rows[0] as T & { content?: Buffer | string };
  if (row.content && Buffer.isBuffer(row.content)) {
    (row as any).content = (row.content as Buffer).toString('utf8');
  }
  return row;
}
