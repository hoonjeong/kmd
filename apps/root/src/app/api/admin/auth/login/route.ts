import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminSession } from '@/lib/admin-session';
import { selectAdminUserByEmail } from '@edenschool/common/queries/admin-user';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const email = formData.get('email') as string;
  const pw = formData.get('pw') as string;
  const rawReferer = (formData.get('referer') as string) || '/admin';
  // open redirect 방지: 내부 경로만 허용
  const referer = rawReferer.startsWith('/') && !rawReferer.startsWith('//') ? rawReferer : '/admin';

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  if (!email || !pw) {
    return NextResponse.redirect(new URL('/admin/login?error=1', baseUrl));
  }

  const user = await selectAdminUserByEmail(email);
  if (!user) {
    return NextResponse.redirect(new URL('/admin/login?error=1', baseUrl));
  }

  const match = await bcrypt.compare(pw, user.pw);
  if (!match) {
    return NextResponse.redirect(new URL('/admin/login?error=1', baseUrl));
  }

  const session = await getAdminSession();
  session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    code: user.code,
  };
  await session.save();

  return NextResponse.redirect(new URL(referer, baseUrl));
}
