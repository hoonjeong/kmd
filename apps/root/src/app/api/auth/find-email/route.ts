import { NextResponse } from 'next/server';
import pool from '@edenschool/common/db';
import type { RowDataPacket } from 'mysql2';

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: '전화번호를 입력해주세요.' }, { status: 400 });
    }

    const normalized = phone.replace(/-/g, '');

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT email FROM kaca.auth_user WHERE phone = ? LIMIT 1',
      [normalized]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: '해당 전화번호로 등록된 계정이 없습니다.' }, { status: 404 });
    }

    const email = rows[0].email as string;
    // Mask email: show first 3 chars and domain
    const [local, domain] = email.split('@');
    const masked = local.slice(0, 3) + '***@' + domain;

    return NextResponse.json({ email: masked });
  } catch (error) {
    console.error('Find email error:', error);
    return NextResponse.json({ error: '이메일 찾기 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
