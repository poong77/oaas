/**
 * Client-safe constants for master data domain (Phase 9).
 *
 * Server-only DB logic은 `lib/services/master-*.ts` (각 도메인).
 * Client Component는 이 파일에서만 상수/타입을 import해야 한다.
 */

export const KNOWN_EVENT_KEYS = [
  'ticket.received',
  'ticket.in_progress',
  'ticket.completed',
  'account.invite',
  'account.password_reset',
] as const;
export type KnownEventKey = (typeof KNOWN_EVENT_KEYS)[number];

export const KNOWN_ROLE_KEYS = [
  'front',
  'sales',
  'housekeeping',
  'manager',
  'new_open',
] as const;
export type KnownRoleKey = (typeof KNOWN_ROLE_KEYS)[number];

export const KNOWN_SETTING_KEYS = [
  'max_upload_mb',
  'rate_limit_login_per_min',
  'slack_channels',
  'business_hours',
  'contact_phone',
] as const;
export type KnownSettingKey = (typeof KNOWN_SETTING_KEYS)[number];

// ─────────────────────────────────────────────────────────────────────
// 마스터 메뉴 접근 제어 레지스트리
//
// 마스터 하위 개별 메뉴의 단일 소스. `key`는 URL 마지막 세그먼트와 동일.
//   - hardAdminOnly: true  → 항상 어드민 전용. 토글 대상 아님(영구 잠금).
//                            "메뉴 접근 제어"(menu-access) 자신만 해당한다.
//   - hardAdminOnly: false → 기본은 매니저+어드민. 어드민이 메뉴 접근 제어에서
//                            매니저 접근을 ON/OFF로 전환 가능.
//
// 정책(2026-06): 메뉴 접근 제어를 제외한 마스터DB 전 메뉴는 접근 제어 토글 대상.
//   토글 ON 시 매니저는 해당 메뉴를 보기+편집 전체 사용(액션 가드도 manager+admin).
//   신규 메뉴 추가 시 반드시 이 레지스트리에 등록한다.
//
// 이 레지스트리는 "메뉴 접근 제어" 페이지(토글 UI)와 접근 가드가 공유한다.
// system_settings 키 `master_menu_manager_access`에 매니저 OFF 오버라이드만 저장.
// ─────────────────────────────────────────────────────────────────────

export const MASTER_MENU_ACCESS_SETTING_KEY = 'master_menu_manager_access';

export type MasterMenuMeta = {
  /** URL 마지막 세그먼트(= 접근 맵 키) */
  key: string;
  label: string;
  /** true면 어드민 전용 고정(토글 불가) */
  hardAdminOnly: boolean;
};

// 2026-06-09 재구성: 인덱스 5개 섹션 순서와 동기화.
//   삭제: quick-actions, form-fields (DROP TABLE)
//   통합: categories + ticket-channels → inquiry-classification
//         notification-templates + quick-replies → message-templates
//   라벨: 제품 분류→제품 카테고리, 메뉴 구조→아티클 메뉴 트리
export const MASTER_MENUS: readonly MasterMenuMeta[] = [
  // ① 분류·구조
  { key: 'product-categories', label: '제품 카테고리', hardAdminOnly: false },
  { key: 'menu-taxonomies', label: '아티클 메뉴 트리', hardAdminOnly: false },
  { key: 'inquiry-classification', label: '문의 분류', hardAdminOnly: false },
  // ② 접수·응대
  { key: 'hotelier-templates', label: '호텔리어 템플릿', hardAdminOnly: false },
  { key: 'solution-links', label: '솔루션 링크 프리셋', hardAdminOnly: false },
  { key: 'message-templates', label: '메시지 템플릿', hardAdminOnly: false },
  // ③ 랜딩페이지
  { key: 'service-status', label: '서비스 상태', hardAdminOnly: false },
  { key: 'role-starters', label: '역할별 시작', hardAdminOnly: false },
  { key: 'popular-keywords', label: '인기검색어', hardAdminOnly: false },
  // ④ 검색·AI
  { key: 'synonyms', label: '동의어 사전', hardAdminOnly: false },
  { key: 'search-quality', label: '검색 골든셋·품질', hardAdminOnly: false },
  { key: 'knowledge-export', label: '지식팩 내보내기', hardAdminOnly: false },
  { key: 'ai-models', label: 'AI 모델', hardAdminOnly: false },
  // ⑤ 시스템·운영
  { key: 'business-hours', label: '운영시간', hardAdminOnly: false },
  { key: 'system-settings', label: '시스템 설정', hardAdminOnly: false },
  // 영구 어드민 전용 (토글 불가) — 메뉴 접근 제어 자신만 해당
  { key: 'menu-access', label: '메뉴 접근 제어', hardAdminOnly: true },
] as const;

/** 매니저 접근을 토글할 수 있는 메뉴(고정 어드민 전용 제외) */
export const TOGGLEABLE_MASTER_MENUS: readonly MasterMenuMeta[] =
  MASTER_MENUS.filter((m) => !m.hardAdminOnly);

const MASTER_MENU_BY_KEY = new Map(MASTER_MENUS.map((m) => [m.key, m]));

export function getMasterMenuMeta(key: string): MasterMenuMeta | undefined {
  return MASTER_MENU_BY_KEY.get(key);
}

/**
 * 오버라이드 맵을 정규화해 "매니저 접근 가능" 최종 맵으로 변환.
 * 규칙: hardAdminOnly → 항상 false / 그 외 → 오버라이드가 명시적 false면 false, 기본 true.
 */
export function resolveManagerAccess(
  overrides: Record<string, unknown> | null | undefined,
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const menu of MASTER_MENUS) {
    if (menu.hardAdminOnly) {
      result[menu.key] = false;
      continue;
    }
    result[menu.key] = overrides?.[menu.key] === false ? false : true;
  }
  return result;
}
