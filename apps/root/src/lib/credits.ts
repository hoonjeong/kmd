import pool from '@kaca/common/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

/**
 * Deduct credits and log the deduction. Returns error message string if failed, or null on success.
 */
export async function deductCredits(
  userId: string,
  _role: string | undefined,
  count: number,
  description?: string
): Promise<string | null> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute<ResultSetHeader>(
      'UPDATE user_credits SET credits = credits - ? WHERE user_id = ? AND credits >= ?',
      [count, userId, count]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return '크레딧이 부족합니다.';
    }

    // 차감 후 잔액 조회
    const [rows] = await conn.execute<RowDataPacket[]>(
      'SELECT credits FROM user_credits WHERE user_id = ?',
      [userId]
    );
    const balanceAfter = rows[0]?.credits ?? 0;

    // credit_log에 기록
    await conn.execute(
      'INSERT INTO credit_log (user_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?)',
      [userId, 'deduct', count, balanceAfter, description || null]
    );

    await conn.commit();
    return null;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
