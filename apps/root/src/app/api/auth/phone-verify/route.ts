import { NextResponse } from 'next/server';
import { sendSMS } from '@kaca/common/sms';
import { verifyMap } from '../phone-utils';

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: '전화번호를 입력해주세요.' }, { status: 400 });
    }

    const normalized = phone.replace(/-/g, '');
    if (!/^01[016789]\d{7,8}$/.test(normalized)) {
      return NextResponse.json({ error: '올바른 전화번호 형식이 아닙니다.' }, { status: 400 });
    }

    // Rate limit: 1 request per phone per 60 seconds
    const existing = verifyMap.get(normalized);
    if (existing && existing.expires - 4 * 60 * 1000 > Date.now()) {
      return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429 });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));

    const result = await sendSMS(normalized, `[국문당] 인증번호: ${code}`);
    if (!result.success) {
      return NextResponse.json({ error: result.message || 'SMS 발송에 실패했습니다.' }, { status: 500 });
    }

    verifyMap.set(normalized, {
      code,
      expires: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    return NextResponse.json({ success: true, message: '인증번호가 발송되었습니다.' });
  } catch (error) {
    console.error('Phone verify error:', error);
    return NextResponse.json({ error: '인증번호 발송 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
