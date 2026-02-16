import pool from '../db';
import type { PrevTestMetaInfo, PrevTestFileInfo } from '../types';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function insertPrevTestMetaInfo(info: Omit<PrevTestMetaInfo, 'id' | 'insertTime'>): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO prev_test_meta_info (region, school_type, school_name, year, grade, term, test_type, section, publisher, file_type, insert_time) VALUES (?,?,?,?,?,?,?,?,?,?,now())`,
    [info.region, info.schoolType, info.schoolName, info.year, info.grade, info.term, info.testType, info.section, info.publisher, info.fileType]
  );
  return result.insertId;
}

export async function insertPrevTestFileInfo(infoId: number, content: Buffer, fileName: string): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO prev_test_file_info (info_id, content, file_name, insert_time) VALUES (?,?,?,now())`,
    [infoId, content, fileName]
  );
  return result.insertId;
}

export async function selectPrevTestMetaInfoAll(): Promise<PrevTestMetaInfo[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, region, school_type as schoolType, school_name as schoolName, year, grade, term, test_type as testType, section, publisher, file_type as fileType, insert_time as insertTime FROM prev_test_meta_info ORDER BY id DESC`
  );
  return rows as PrevTestMetaInfo[];
}

export async function selectPrevTestMetaInfoById(id: number): Promise<PrevTestMetaInfo | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, region, school_type as schoolType, school_name as schoolName, year, grade, term, test_type as testType, section, publisher, file_type as fileType FROM prev_test_meta_info WHERE id=?`,
    [id]
  );
  return (rows[0] as PrevTestMetaInfo) || null;
}

export async function selectPrevTestFileInfoByInfoId(infoId: number): Promise<PrevTestFileInfo | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, info_id as infoId, file_name as fileName, content FROM prev_test_file_info WHERE info_id=?`,
    [infoId]
  );
  return (rows[0] as PrevTestFileInfo) || null;
}

export async function deletePrevTestMetaInfoById(id: number): Promise<void> {
  await pool.query(`DELETE FROM prev_test_meta_info WHERE id=?`, [id]);
}

export async function deletePrevTestFileInfoByInfoId(infoId: number): Promise<void> {
  await pool.query(`DELETE FROM prev_test_file_info WHERE info_id=?`, [infoId]);
}

export async function selectPrevTestByYear(year: string): Promise<PrevTestMetaInfo[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, region, school_type as schoolType, school_name as schoolName, year, grade, term, test_type as testType, section, publisher, file_type as fileType FROM prev_test_meta_info WHERE year=? ORDER BY school_name ASC, grade ASC, term ASC, test_type ASC`,
    [year]
  );
  return rows as PrevTestMetaInfo[];
}

export async function selectPrevTestFileInfoByInfoIds(infoIds: number[]): Promise<PrevTestFileInfo[]> {
  if (infoIds.length === 0) return [];
  const placeholders = infoIds.map(() => '?').join(',');
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, info_id as infoId, file_name as fileName, content FROM prev_test_file_info WHERE info_id IN (${placeholders})`,
    infoIds
  );
  return rows as PrevTestFileInfo[];
}

export async function selectPrevTestSchoolName(): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT(school_name) as schoolName FROM prev_test_meta_info ORDER BY school_name ASC`
  );
  return rows.map((r) => r.schoolName);
}
