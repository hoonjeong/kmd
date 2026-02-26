import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Kakao from 'next-auth/providers/kakao';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import pool from '@kaca/common/db';
import { MySQLAdapter } from '@/lib/auth-adapter';
import type { RowDataPacket } from 'mysql2';

interface AuthUserRow extends RowDataPacket {
  id: string;
  name: string | null;
  email: string;
  password_hash: string | null;
  role: string;
  image: string | null;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: MySQLAdapter(),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Google,
    Kakao,
    Credentials({
      credentials: {
        email: { label: '이메일', type: 'email' },
        password: { label: '비밀번호', type: 'password' },
        rememberMe: { type: 'text' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const [rows] = await pool.execute<AuthUserRow[]>(
          'SELECT * FROM auth_user WHERE email = ?',
          [email]
        );
        const user = rows[0];
        if (!user || !user.password_hash) return null;

        const valid = await compare(password, user.password_hash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          rememberMe: credentials?.rememberMe === 'true',
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.rememberMe = user.rememberMe ?? true;
      } else if (token.id) {
        // 매 요청마다 DB에서 최신 role을 반영 (DB 실패 시 기존 role 유지)
        try {
          const [rows] = await pool.execute<AuthUserRow[]>(
            'SELECT role FROM auth_user WHERE id = ?',
            [token.id]
          );
          if (rows[0]) token.role = rows[0].role;
        } catch {
          // DB 연결 실패 시 기존 token.role 유지
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.role) session.user.role = token.role as string;
      return session;
    },
  },
});
