import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@kaca/common/db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

/** GET: 사용자 프로필 조회 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, name, email, phone, school_name FROM auth_user WHERE id = ?',
    [session.user.id]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ profile: rows[0] });
}

/** PUT: 사용자 프로필 수정 (이름, 학원명) */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { name?: string; schoolName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const updates: string[] = [];
  const values: (string | null)[] = [];

  if (body.name !== undefined) {
    updates.push('name = ?');
    values.push(body.name.trim() || null);
  }
  if (body.schoolName !== undefined) {
    updates.push('school_name = ?');
    values.push(body.schoolName.trim() || null);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 });
  }

  values.push(session.user.id);

  await pool.execute<ResultSetHeader>(
    `UPDATE auth_user SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  return NextResponse.json({ success: true });
}
