/**
 * `business_holidays` — 공휴일 마스터.
 *
 * `business_hours_default.holidays_closed=true`이면 이 날짜는 자동 휴무 처리.
 * 양력 공휴일(신정·삼일절·어린이날 등)은 `is_recurring=true`로 표시 — 매년 1월 어드민이
 * "내년 자동 복제" 액션 한 번으로 다음 해 행을 일괄 생성한다 (P2).
 * 음력 공휴일(설·추석·부처님오신날)은 `is_recurring=false`로 매년 수동 등록.
 *
 * 변경 이력은 `activity_logs(action='business_hours.holiday.create' | 'holiday.delete')`.
 *
 * 시드(db/seed.ts): 2026년 공휴일 19종 (양력 8 + 음력 7 + 대체 4).
 *   - 양력(recurring): 1/1 신정, 3/1 삼일절, 5/5 어린이날, 6/6 현충일,
 *                       8/15 광복절, 10/3 개천절, 10/9 한글날, 12/25 성탄절
 *   - 음력(2026 한정): 2/16~18 설날 연휴, 5/24 부처님오신날, 9/24~26 추석 연휴
 *   - 대체공휴일(2026): 3/2, 5/25, 8/17, 10/5
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { users } from './users';

export const businessHolidays = pgTable(
  'business_holidays',
  {
    ...commonColumns(),
    /** 공휴일 날짜 (YYYY-MM-DD) */
    date: date('date').notNull(),
    /** 공휴일 이름 ("신정", "설날 연휴", "어린이날" 등) */
    name: text('name').notNull(),
    /** 매년 반복 여부 — true면 양력 공휴일 (UI에서 "내년 복제" 대상 표시) */
    isRecurring: boolean('is_recurring').notNull().default(false),
    /** 등록한 어드민 */
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    // 활성 상태인 같은 날짜 공휴일 중복 금지 (비활성 행은 허용 — 삭제 이력 보존)
    uniqueIndex('business_holidays_date_uniq')
      .on(table.date)
      .where(sql`is_active = true`),
  ],
);

export type BusinessHoliday = typeof businessHolidays.$inferSelect;
export type NewBusinessHoliday = typeof businessHolidays.$inferInsert;
