/**
 * 권한 헬퍼 (Server 전용).
 *
 * 사용 예:
 *   const user = await requireAuth();                      // 비로그인 → /login 리다이렉트
 *   await requireRole(['admin']);                          // 어드민 외 → /403 (notFound)
 *   const action = withAuthorizedAction(['admin'], async (ctx, input) => {...});
 *
 * 클라이언트용은 `useCurrentUser()` (lib/hooks/use-current-user.ts).
 */

import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import type { UserRole } from '@/db/schema';

export type AuthorizedUser = {
  id: string;
  email: string | null | undefined;
  name: string | null | undefined;
  role: UserRole;
  hotelId: string | null;
  mustChangePassword: boolean;
};

export async function getCurrentUser(): Promise<AuthorizedUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    role: session.user.role,
    hotelId: session.user.hotelId,
    mustChangePassword: session.user.mustChangePassword,
  };
}

/** 비로그인 시 /login 리다이렉트 (callbackUrl 포함) */
export async function requireAuth(callbackUrl?: string): Promise<AuthorizedUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = callbackUrl
      ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : '/login';
    redirect(target);
  }
  return user;
}

/** 권한 미충족 시 notFound (라우트 그룹 외부 노출 차단) */
export async function requireRole(
  allowed: UserRole[],
  callbackUrl?: string,
): Promise<AuthorizedUser> {
  const user = await requireAuth(callbackUrl);
  if (!allowed.includes(user.role)) {
    notFound();
  }
  return user;
}

/**
 * Server Action 권한 래퍼.
 *
 * 사용 예:
 *   export const updateRole = withAuthorizedAction(
 *     ['admin'],
 *     async (ctx, input: { userId: string; role: UserRole }) => { ... }
 *   );
 */
export function withAuthorizedAction<TInput, TResult>(
  allowed: UserRole[],
  handler: (ctx: { user: AuthorizedUser }, input: TInput) => Promise<TResult>,
) {
  return async function authorizedAction(input: TInput): Promise<TResult> {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('UNAUTHORIZED');
    }
    if (!allowed.includes(user.role)) {
      throw new Error('FORBIDDEN');
    }
    return handler({ user }, input);
  };
}

export function isManagerOrAdmin(role: UserRole): boolean {
  return role === 'manager' || role === 'admin';
}
