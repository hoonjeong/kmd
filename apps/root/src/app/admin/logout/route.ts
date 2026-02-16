import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';

export async function GET() {
  const session = await getAdminSession();
  session.destroy();
  return NextResponse.redirect(new URL('/admin/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
}
