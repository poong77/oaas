/**
 * 역할별 모드 (RoleMode) 정의 및 해석 함수.
 *
 * - `user.role`(admin/manager/hotelier)과 `viewMode` 쿠키를 결합하여
 *   실제 화면에 적용할 UI 모드(admin/manager/hotelier)를 결정한다.
 * - 비로그인 또는 호텔리어 본인은 항상 hotelier 모드.
 * - 매니저/어드민이 `viewMode=hotelier` 쿠키를 가지면 시점 보기 모드로 전환.
 *
 * ⚠️ 보안 원칙: 본 함수의 결과는 **UI 표시용**. 서버 권한 체크는 항상
 *    `user.role`을 기준으로 한다. viewMode 쿠키 위조는 시각만 바뀔 뿐
 *    /admin/users 등 어드민 전용 페이지는 여전히 차단된다.
 *
 * 관련 파일:
 *   - lib/view-mode.ts (쿠키 read/write)
 *   - lib/hooks/use-view-mode.ts (클라이언트 hook)
 *   - components/layout/role-scope.tsx (서버 컴포넌트, 본 함수 호출)
 */

import type { UserRole } from '@/db/schema';

export type RoleMode = 'admin' | 'manager' | 'hotelier';

/**
 * `user.role` + `viewMode` 쿠키 → 실제 UI 모드 결정.
 *
 * @param userRole 로그인 사용자의 역할 (비로그인 시 null)
 * @param viewModeCookie viewMode 쿠키 값 (없으면 undefined)
 * @returns 적용할 UI 모드
 */
export function resolveRoleMode(
  userRole: UserRole | null,
  viewModeCookie: string | undefined,
): RoleMode {
  if (!userRole) return 'hotelier';
  if (userRole === 'hotelier') return 'hotelier';
  if (viewModeCookie === 'hotelier') return 'hotelier';
  return userRole;
}

/**
 * 현재 시점 보기 모드 활성 여부.
 * 호텔리어 본인은 항상 false (자기 모드이므로 시점 보기 개념 없음).
 */
export function isInViewMode(
  userRole: UserRole | null,
  viewModeCookie: string | undefined,
): boolean {
  if (!userRole) return false;
  if (userRole === 'hotelier') return false;
  return viewModeCookie === 'hotelier';
}
