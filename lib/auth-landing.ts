/**
 * 로그인 직후 기본 도착 경로 결정.
 *
 * - admin / manager → /admin/tickets (티켓 큐, 스태프 주 작업 화면)
 * - hotelier / 비로그인 fallback → / (홈)
 *
 * callbackUrl이 명시된 경우(보호 경로 자동 부착)는 호출 측에서 우선 적용.
 */

import type { UserRole } from '@/db/schema';

export function defaultLandingFor(
  role: UserRole | null | undefined,
): string {
  if (role === 'admin' || role === 'manager') return '/admin/tickets';
  return '/';
}
