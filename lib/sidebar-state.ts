/**
 * 사이드바 접기/펼치기 상태 (쿠키) 헬퍼.
 *
 * 저장 매체로 쿠키를 선택한 이유:
 *   - RSC에서 cookies()로 read → SSR 첫 렌더 깜빡임 0
 *   - localStorage는 SSR 불가 → expanded 기본값으로 첫 렌더 후 collapsed 적용 시
 *     깜빡임 발생 가능
 *   - role-mode-ui의 viewMode 쿠키 패턴과 일관
 *
 * 보안: UI 표시 전용. 위조해도 보안 영향 없음.
 *
 * @see docs/02-design/features/admin-sidebar-layout.design.md §4
 */

export const SIDEBAR_COLLAPSED_COOKIE = 'sidebarCollapsed';
export const SIDEBAR_COLLAPSED_MAX_AGE = 60 * 60 * 24 * 365; // 1년

/**
 * 쿠키 값 → boolean 변환 (strict).
 *
 * '1' → true (접힘)
 * 그 외 (undefined, '', '0', '2', 'true', 'yes', ...) → false (펼침, 기본)
 *
 * strict 비교로 위조·잘못된 값을 안전한 기본값(펼침)으로 폴백.
 */
export function resolveCollapsed(cookieValue: string | undefined): boolean {
  return cookieValue === '1';
}
