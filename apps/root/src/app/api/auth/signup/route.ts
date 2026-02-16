import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { hash } from 'bcryptjs';
import pool from '@edenschool/common/db';
import { verifyPhoneToken } from '../phone-utils';
import type { RowDataPacket } from 'mysql2';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, phone, phoneToken, schoolName } = body;

    // 필수값 검증
    if (!name || !email || !password || !phone) {
      return NextResponse.json(
        { error: '이름, 이메일, 비밀번호, 전화번호는 필수입니다.' },
        { status: 400 }
      );
    }

    // 전화번호 인증 토큰 검증
    if (!phoneToken || !verifyPhoneToken(phoneToken, phone)) {
      return NextResponse.json(
        { error: '전화번호 인증이 필요합니다.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: '비밀번호는 8자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 이메일 중복 체크
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM kaca.auth_user WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: '이미 등록된 이메일입니다.' },
        { status: 409 }
      );
    }

    // 비밀번호 해싱 + 사용자 생성
    const id = randomUUID();
    const passwordHash = await hash(password, 12);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        `INSERT INTO kaca.auth_user (id, name, email, password_hash, phone, school_name, role)
         VALUES (?, ?, ?, ?, ?, ?, 'user')`,
        [id, name, email, passwordHash, phone.replace(/-/g, ''), schoolName || null]
      );
      const initialCredits = 100;
      await conn.execute(
        `INSERT INTO kaca.user_credits (user_id, credits) VALUES (?, ?)`,
        [id, initialCredits]
      );
      await conn.execute(
        `INSERT INTO kaca.credit_log (user_id, type, amount, balance_after, description) VALUES (?, 'charge', ?, ?, ?)`,
        [id, initialCredits, initialCredits, '회원가입 감사 이벤트']
      );
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
