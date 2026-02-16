import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

// User public paths (no auth required)
const userPublicPaths = ['/login', '/signup', '/find-email', '/find-password', '/terms', '/privacy', '/service-policy'];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Pass pathname to server components via request header
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', path);

  // Allow static files
  if (path.startsWith('/_next') || path.startsWith('/assets')) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Allow NextAuth API routes
  if (path.startsWith('/api/auth')) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Allow user public paths (login, signup, etc.)
  if (userPublicPaths.some(p => path === p || path.startsWith(p + '/'))) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Admin API routes → allow through (auth handled by individual routes)
  if (path.startsWith('/api/admin')) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Admin pages → redirect to main (추후 개발 예정)
  if (path.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Protected routes - require NextAuth JWT
  if (path.startsWith('/dashboard') || path.startsWith('/my-info') || path.startsWith('/my-questions') || path.startsWith('/my-credits') || path.startsWith('/api/teacher')) {
    const token = await getToken({ req, secret });
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // 자동 로그인 미체크 사용자: 브라우저 종료 시 재로그인 강제
    if (token.rememberMe === false) {
      const sessionGuard = req.cookies.get('session_guard');
      if (!sessionGuard) {
        const response = NextResponse.redirect(new URL('/login', req.url));
        // NextAuth 세션 쿠키 제거
        response.cookies.set('authjs.session-token', '', { maxAge: 0, path: '/' });
        response.cookies.set('__Secure-authjs.session-token', '', { maxAge: 0, path: '/' });
        return response;
      }
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Root redirect: check NextAuth session
  if (path === '/') {
    const token = await getToken({ req, secret });
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets/).*)'],
};
