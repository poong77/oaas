/**
 * 역할별 모드 (RoleMode) 정의.
 *
 * - `user.role`(admin/manager/hotelier)을 그대로 UI 모드로 사용.
 * - 비로그인은 hotelier 모드 (호텔리어용 헤더 노출).
 *
 * ⚠️ 보안 원칙: 본 함수의 결과는 **UI 표시용**. 서버 권한 체크는 항상
 *    `user.role`을 기준으로 한다.
 *
 * 관련 파일:
 *   - components/layout/role-scope.tsx (서버 컴포넌트, 본 함수 호출)
 */

import type { UserRole } from '@/db/schema';

export type RoleMode = 'admin' | 'manager' | 'hotelier';

/**
 * `user.role` → UI 모드 매핑.
 *
 * @param userRole 로그인 사용자의 역할 (비로그인 시 null)
 * @returns 적용할 UI 모드
 */
export function resolveRoleMode(userRole: UserRole | null): RoleMode {
  if (!userRole) return 'hotelier';
  return userRole;
}
