/**
 * Edge-safe NextAuth 설정.
 *
 * middleware.ts는 edge runtime에서 동작하므로, DB/bcrypt 등 node-only 모듈을
 * import하지 않는 가벼운 설정만 따로 분리한다.
 *
 * Provider 본체(Credentials authorize)는 `lib/auth.ts`에서 정의.
 */

import type { NextAuthConfig } from 'next-auth';
import type { UserRole } from '@/db/schema/_shared';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      hotelId: string | null;
      mustChangePassword: boolean;
    } & import('next-auth').DefaultSession['user'];
  }
}

export const authConfig = {
  // providers는 edge에서 호출되지 않으므로 빈 배열로 시작 (lib/auth.ts에서 본 설정)
  providers: [],
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 8,
  },
  secret:
    process.env.NEXTAUTH_SECRET || 'dev-secret-fallback-replace-in-prod',
  pages: {
    signIn: '/login',
    error: '/login',
  },
  trustHost: true,
  callbacks: {
    // edge에서 호출되는 콜백은 가볍게. DB 동기화는 본 설정(lib/auth.ts)에서.
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
