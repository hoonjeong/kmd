import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@edenschool/common/db';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT credits FROM kaca.user_credits WHERE user_id = ?',
    [session.user.id]
  );

  const credits = rows[0]?.credits ?? 0;
  return NextResponse.json({ credits });
}
