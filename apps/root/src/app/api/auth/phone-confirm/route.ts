import { NextResponse } from 'next/server';
import { verifyMap, createPhoneToken } from '../phone-utils';

export async function POST(req: Request) {
  try {
    const { phone, code } = await req.json();

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
      return NextResponse.json({ error: '인증번호가 만료되었습니다. 다시 발송해주세요.' }, { status: 400 });
    }

    if (entry.code !== code) {
      return NextResponse.json({ error: '인증번호가 일치하지 않습니다.' }, { status: 400 });
    }

    // Verified - remove from map and generate token
    verifyMap.delete(normalized);
    const phoneToken = createPhoneToken(normalized);

    return NextResponse.json({ success: true, phoneToken });
  } catch (error) {
    console.error('Phone confirm error:', error);
    return NextResponse.json({ error: '인증 확인 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
