import pool from '../db';
import type { RowDataPacket } from 'mysql2';

export interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  pw: string;
  code: string;
  phone: string;
}

export async function selectAdminUserByEmail(email: string): Promise<AdminUserRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, email, pw, code, phone FROM admin_user_info WHERE email=?`,
    [email]
  );
  return (rows[0] as AdminUserRow) || null;
}
