import pool from '../db';
import type { RowDataPacket } from 'mysql2';

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  role: string;
  phone: string | null;
  schoolName: string | null;
}

export async function selectAdminUserByEmail(email: string): Promise<AdminUserRow | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, email, password_hash as passwordHash, role, phone, school_name as schoolName
     FROM auth_user WHERE email=?`,
    [email]
  );
  return (rows[0] as AdminUserRow) || null;
}
