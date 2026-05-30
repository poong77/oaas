/**
 * `business_hours_default` — 현재 운영시간 마스터 (단일 행).
 *
 * 호텔리어 컨택 패널의 `useBusinessStatus()` 훅이 이 테이블을 기준으로
 * 영업 중/외, 점심시간, 접수마감, 긴급전화 안내를 판정한다.
 *
 * 단일 행 보장: service layer (`lib/services/business-hours.ts`)에서
 * upsert 패턴으로 첫 행만 사용. is_active=true 행은 항상 1건만 존재해야 한다.
 *
 * 평일 단축영업·임시 휴무는 `business_hours_overrides`로 처리.
 * 공휴일은 `business_holidays` + `holidays_closed` 플래그로 자동 휴무.
 *
 * 변경 이력은 `activity_logs(action='business_hours.default.update')`.
 *
 * 시드(db/seed.ts):
 *   weekday_open=10:00, weekday_close=18:40,
 *   lunch_start=12:00, lunch_end=13:00,
 *   intake_deadline=18:00,
 *   saturday/sunday/holidays_closed=true,
 *   emergency_phone='070-8028-0919',
 *   emergency_note='영업시간 외 긴급전화 (단순 금액 정정 불가)'
 */

import { boolean, pgTable, text, time, uuid } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { users } from './users';

export const businessHoursDefault = pgTable('business_hours_default', {
  ...commonColumns(),
  /** 평일 영업 시작 (예: 10:00) */
  weekdayOpen: time('weekday_open').notNull(),
  /** 평일 영업 종료 (예: 18:40) */
  weekdayClose: time('weekday_close').notNull(),
  /** 점심 시작 (nullable — 점심시간 없는 경우) */
  lunchStart: time('lunch_start'),
  /** 점심 종료 */
  lunchEnd: time('lunch_end'),
  /** 접수 마감 — 영업 종료보다 빠를 수 있음 (예: 18:00) */
  intakeDeadline: time('intake_deadline'),
  /** 토요일 휴무 (true=휴무, false=영업) */
  saturdayClosed: boolean('saturday_closed').notNull().default(true),
  /** 일요일 휴무 */
  sundayClosed: boolean('sunday_closed').notNull().default(true),
  /** 공휴일 자동 휴무 (`business_holidays` 테이블 참조) */
  holidaysClosed: boolean('holidays_closed').notNull().default(true),
  /** 영업시간 외 긴급전화 (예: 070-8028-0919) */
  emergencyPhone: text('emergency_phone'),
  /** 긴급전화 안내문구 (예: "단순 금액 정정 불가") */
  emergencyNote: text('emergency_note'),
  /** IANA timezone — 기본 Asia/Seoul */
  timezone: text('timezone').notNull().default('Asia/Seoul'),
  /** 마지막 수정 어드민 */
  updatedBy: uuid('updated_by').references(() => users.id, {
    onDelete: 'set null',
  }),
});

export type BusinessHoursDefault = typeof businessHoursDefault.$inferSelect;
export type NewBusinessHoursDefault =
  typeof businessHoursDefault.$inferInsert;
