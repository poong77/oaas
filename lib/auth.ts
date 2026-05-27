/**
 * NextAuth v5 (Auth.js) — 본 설정 (node runtime).
 *
 * Providers:
 *   - Credentials (dev-stub): AUTH_DEV_STUB=true일 때만 활성화.
 *     시드 사용자(admin@oa.local 등)로 로그인.
 *   - OA SSO (OIDC): OA_SSO_ISSUER가 비어있지 않을 때만 활성화.
 *     // TODO(phase-1-temp): SSO 클레임 명세 확정 후 hotel 매핑 로직 교체.
 *
 * Edge-safe config은 `lib/auth.config.ts`에 분리. middleware는 그쪽만 import.
 */

import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db';
import { users, type UserRole } from '@/db/schema';
import { authConfig as edgeConfig } from '@/lib/auth.config';

declare module '@auth/core/jwt' {
  interface JWT {
    sub?: string;
    role?: UserRole;
    hotelId?: string | null;
    mustChangePassword?: boolean;
  }
}

declare module 'next-auth' {
  interface User {
    id?: string;
    role?: UserRole;
    hotelId?: string | null;
    mustChangePassword?: boolean;
  }
}

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function buildProviders() {
  const providers: NextAuthConfig['providers'] = [];

  if ((process.env.AUTH_DEV_STUB ?? '').toLowerCase() === 'true') {
    providers.push(
      Credentials({
        id: 'credentials',
        name: '내부 로그인 (dev stub)',
        credentials: {
          email: { label: '이메일', type: 'email' },
          password: { label: '비밀번호', type: 'password' },
        },
        async authorize(rawCredentials) {
          const parsed = CredentialsSchema.safeParse(rawCredentials);
          if (!parsed.success) return null;
          const { email, password } = parsed.data;

          if (!db) {
            console.warn('[auth] DB 미연결 상태에서 로그인 시도.');
            return null;
          }

          try {
            const rows = await db
              .select()
              .from(users)
              .where(eq(users.email, email))
              .limit(1);
            const user = rows[0];
            if (!user || !user.isActive) return null;
            if (!user.passwordHash) return null;

            const ok = await bcrypt.compare(password, user.passwordHash);
            if (!ok) return null;

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              hotelId: user.hotelId,
              mustChangePassword: user.mustChangePassword,
            };
          } catch (err) {
            console.error('[auth] credentials authorize 실패:', err);
            return null;
          }
        },
      }),
    );
  }

  // TODO(phase-1-temp): OA_SSO_ISSUER 확정 후 OIDC Provider 추가.
  // if (process.env.OA_SSO_ISSUER) {
  //   providers.push({ id: 'oa-sso', name: 'OA PMS', type: 'oidc', issuer: ..., ... });
  // }

  return providers;
}

export const authConfig = {
  ...edgeConfig,
  providers: buildProviders(),
  callbacks: {
    ...edgeConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user) {
        token.sub = user.id ?? token.sub;
        token.role = user.role ?? 'hotelier';
        token.hotelId = user.hotelId ?? null;
        token.mustChangePassword = user.mustChangePassword ?? false;
      }

      if (trigger === 'update' && token.sub && db) {
        try {
          const rows = await db
            .select({
              role: users.role,
              hotelId: users.hotelId,
              mustChangePassword: users.mustChangePassword,
              isActive: users.isActive,
            })
            .from(users)
            .where(eq(users.id, token.sub))
            .limit(1);
          const fresh = rows[0];
          if (fresh) {
            if (!fresh.isActive) {
              return { ...token, role: undefined, hotelId: undefined };
            }
            token.role = fresh.role;
            token.hotelId = fresh.hotelId;
            token.mustChangePassword = fresh.mustChangePassword;
          }
        } catch (err) {
          console.error('[auth] jwt update 동기화 실패:', err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.role = (token.role ?? 'hotelier') as UserRole;
      session.user.hotelId = token.hotelId ?? null;
      session.user.mustChangePassword = token.mustChangePassword ?? false;
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
