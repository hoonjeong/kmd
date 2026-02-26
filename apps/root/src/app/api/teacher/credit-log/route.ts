import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@kaca/common/db';
import type { RowDataPacket } from 'mysql2';

/** GET: 크레딧 사용/충전 내역 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 현재 잔액
  const [creditRows] = await pool.execute<RowDataPacket[]>(
    'SELECT credits FROM user_credits WHERE user_id = ?',
    [session.user.id]
  );
  const credits = creditRows[0]?.credits ?? 0;

  // 이력
  const [logs] = await pool.execute<RowDataPacket[]>(
    `SELECT id, type, amount, balance_after, description, created_at
     FROM credit_log
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 100`,
    [session.user.id]
  );

  return NextResponse.json({ credits, logs });
}
