/**
 * `business_hours_overrides` — 예약 변경 (일시적 오버라이드, P2).
 *
 * `business_hours_default`를 특정 기간만 다른 운영시간 또는 휴무로 덮어쓴다.
 * cron이 매일 00:01에 status 전환:
 *   - scheduled → active (effective_from <= today)
 *   - active    → expired (effective_until < today)
 *
 * `useBusinessStatus()` 훅은 status='active' override가 있으면 default보다 우선 적용.
 *
 * 충돌 방지: 같은 날짜에 활성 override 2건 금지. P2 단순 구현은 service layer에서 사전 검증
 * (단일 어드민 가정). DB EXCLUDE 제약은 P3 보강.
 *
 * 변경 이력은 `activity_logs(action='business_hours.override.{create|cancel|applied|expired}')`.
 *
 * kind:
 *   - short_hours: 단축운영 (weekday_close 등 일부 시각만 변경)
 *   - closed:      임시휴무 (시간 필드 무시)
 *   - custom:      자유 설정 (모든 시각 재정의)
 */

import {
  date,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { users } from './users';

export const businessHoursOverrideKindEnum = pgEnum(
  'business_hours_override_kind',
  ['short_hours', 'closed', 'custom'],
);

export const businessHoursOverrideStatusEnum = pgEnum(
  'business_hours_override_status',
  ['scheduled', 'active', 'expired', 'canceled'],
);

export const businessHoursOverrides = pgTable('business_hours_overrides', {
  ...commonColumns(),
  kind: businessHoursOverrideKindEnum('kind').notNull(),
  /** 적용 시작일 (포함) */
  effectiveFrom: date('effective_from').notNull(),
  /** 적용 종료일 (포함) */
  effectiveUntil: date('effective_until').notNull(),
  /** kind='closed'면 무시. NULL이면 default 사용 */
  weekdayOpen: time('weekday_open'),
  weekdayClose: time('weekday_close'),
  lunchStart: time('lunch_start'),
  lunchEnd: time('lunch_end'),
  intakeDeadline: time('intake_deadline'),
  /** 변경 사유 — 필수 (이력 추적용) */
  reason: text('reason').notNull(),
  status: businessHoursOverrideStatusEnum('status')
    .notNull()
    .default('scheduled'),
  /** cron이 status='active'로 전환한 시각 */
  appliedAt: timestamp('applied_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, {
    onDelete: 'set null',
  }),
});

export type BusinessHoursOverride =
  typeof businessHoursOverrides.$inferSelect;
export type NewBusinessHoursOverride =
  typeof businessHoursOverrides.$inferInsert;
export type BusinessHoursOverrideKind =
  (typeof businessHoursOverrideKindEnum.enumValues)[number];
export type BusinessHoursOverrideStatus =
  (typeof businessHoursOverrideStatusEnum.enumValues)[number];
