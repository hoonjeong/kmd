import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { SessionOptions } from 'iron-session';
import { ApiUnauthorizedError } from './session';

export interface AdminSessionData {
  user?: {
    id: number | string;
    name: string;
    email: string;
    phone: string;
    code: string;
    role?: string;
  };
  phoneVerification?: {
    code: string;
    phone: string;
    expiresAt: number;
  };
}

export const adminSessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: process.env.ADMIN_SESSION_COOKIE_NAME || 'munjejip-admin-session',
  ttl: Number(process.env.ADMIN_SESSION_TTL) || 60 * 60 * 3,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
  },
};

export async function getAdminSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<AdminSessionData>(cookieStore, adminSessionOptions);
  return session;
}

export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session.user) redirect('/admin/login');
  return session as typeof session & { user: NonNullable<AdminSessionData['user']> };
}

export async function requireAdminApiSession() {
  const session = await getAdminSession();
  if (session.user) {
    return session as typeof session & { user: NonNullable<AdminSessionData['user']> };
  }

  // Fallback: NextAuth session (teacher access to shared APIs)
  try {
    const { auth } = await import('@/auth');
    const nextAuthSession = await auth();
    if (nextAuthSession?.user) {
      return {
        user: {
          id: nextAuthSession.user.id || '0',
          name: nextAuthSession.user.name || '',
          email: nextAuthSession.user.email || '',
          phone: '',
          code: '',
          role: nextAuthSession.user.role || 'user',
        },
      } as typeof session & { user: NonNullable<AdminSessionData['user']> };
    }
  } catch {
    // NextAuth check failed, fall through
  }

  throw new ApiUnauthorizedError();
}
