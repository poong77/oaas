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
