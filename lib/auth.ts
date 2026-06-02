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
import { eq, or } from 'drizzle-orm';
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
  // 이메일 또는 아이디(username) — 둘 다 허용하므로 email() 검증을 걸지 않는다.
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

function buildProviders() {
  const providers: NextAuthConfig['providers'] = [];

  // 비밀번호 로그인(credentials)은 운영 기본 로그인 수단.
  // AS 이관 사용자(아이디/이메일 + 비밀번호)가 로그인하려면 항상 활성화한다.
  // (AUTH_DEV_STUB 은 로그인 화면의 '시드 계정 안내' 표시 여부에만 사용)
  {
    providers.push(
      Credentials({
        id: 'credentials',
        name: '아이디/이메일 로그인',
        credentials: {
          identifier: { label: '이메일 또는 아이디', type: 'text' },
          password: { label: '비밀번호', type: 'password' },
        },
        async authorize(rawCredentials) {
          const parsed = CredentialsSchema.safeParse(rawCredentials);
          if (!parsed.success) return null;
          const { identifier, password } = parsed.data;

          if (!db) {
            console.warn('[auth] DB 미연결 상태에서 로그인 시도.');
            return null;
          }

          try {
            // 이메일 또는 아이디(username)로 식별. 이메일은 소문자 정규화하여 매칭.
            const lowered = identifier.toLowerCase();
            const rows = await db
              .select()
              .from(users)
              .where(
                or(
                  eq(users.email, lowered),
                  eq(users.email, identifier),
                  eq(users.username, identifier),
                ),
              )
              .limit(2);
            // 이메일 정확 매칭 우선, 없으면 아이디 매칭.
            const user =
              rows.find(
                (r) =>
                  r.email === lowered || r.email === identifier,
              ) ??
              rows.find((r) => r.username === identifier) ??
              rows[0];
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
