import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import pool from '@edenschool/common/db';
import { sendSMS } from '@edenschool/common/sms';
import { verifyMap, createPhoneToken, verifyPhoneToken } from '../phone-utils';
import type { RowDataPacket } from 'mysql2';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'send-code') {
      const { email, phone } = body;
      if (!email || !phone) {
        return NextResponse.json({ error: '이메일과 전화번호를 입력해주세요.' }, { status: 400 });
      }

      const normalized = phone.replace(/-/g, '');

      // Verify email + phone match
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM kaca.auth_user WHERE email = ? AND phone = ? LIMIT 1',
        [email, normalized]
      );

      if (rows.length === 0) {
        return NextResponse.json({ error: '이메일과 전화번호가 일치하는 계정이 없습니다.' }, { status: 404 });
      }

      // Rate limit
      const existing = verifyMap.get(normalized);
      if (existing && existing.expires - 4 * 60 * 1000 > Date.now()) {
        return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429 });
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));

      const result = await sendSMS(normalized, `[국문당] 비밀번호 재설정 인증번호: ${code}`);
      if (!result.success) {
        return NextResponse.json({ error: result.message || 'SMS 발송에 실패했습니다.' }, { status: 500 });
      }

      verifyMap.set(normalized, { code, expires: Date.now() + 5 * 60 * 1000 });

      return NextResponse.json({ success: true });
    }

    if (action === 'verify-code') {
      const { phone, code } = body;
      if (!phone || !code) {
        return NextResponse.json({ error: '전화번호와 인증번호를 입력해주세요.' }, { status: 400 });
      }

      const normalized = phone.replace(/-/g, '');
      const entry = verifyMap.get(normalized);

      if (!entry) {
        return NextResponse.json({ error: '인증번호를 먼저 발송해주세요.' }, { status: 400 });
      }
      if (entry.expires < Date.now()) {
        verifyMap.delete(normalized);
        return NextResponse.json({ error: '인증번호가 만료되었습니다.' }, { status: 400 });
      }
      if (entry.code !== code) {
        return NextResponse.json({ error: '인증번호가 일치하지 않습니다.' }, { status: 400 });
      }

      verifyMap.delete(normalized);
      const phoneToken = createPhoneToken(normalized);

      return NextResponse.json({ success: true, phoneToken });
    }

    if (action === 'reset') {
      const { email, phone, phoneToken, newPassword } = body;
      if (!email || !phone || !phoneToken || !newPassword) {
        return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
      }
      if (newPassword.length < 8) {
        return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
      }
      if (!verifyPhoneToken(phoneToken, phone)) {
        return NextResponse.json({ error: '인증이 만료되었습니다. 다시 시도해주세요.' }, { status: 400 });
      }

      const normalized = phone.replace(/-/g, '');
      const passwordHash = await hash(newPassword, 12);

      const [result] = await pool.execute(
        'UPDATE kaca.auth_user SET password_hash = ? WHERE email = ? AND phone = ?',
        [passwordHash, email, normalized]
      );

      const affected = (result as { affectedRows: number }).affectedRows;
      if (affected === 0) {
        return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  } catch (error) {
    console.error('Find password error:', error);
    return NextResponse.json({ error: '비밀번호 찾기 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
