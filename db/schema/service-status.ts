/**
 * `service_status` — LP-03, NT-03.
 *
 * 운영 패턴:
 *   - 상태 변경 시 새 row INSERT.
 *   - 직전 active row는 `is_active=false` + `ended_at=now()`로 마감.
 *   - 공개 조회: `where is_active = true order by started_at desc limit 1`.
 *
 * 매니저+어드민이 `/admin/service-status`에서 편집.
 * 시드: `db/seed.ts`에서 기본 `normal` 1건 자동 삽입.
 */

import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { commonColumns, serviceStatusEnum } from './_shared';
import { users } from './users';

export const serviceStatus = pgTable('service_status', {
  ...commonColumns(),
  status: serviceStatusEnum('status').notNull().default('normal'),
  /** incident/degraded/maintenance에서 사용자에게 보여줄 메시지 */
  message: text('message'),
  /** 상태 시작 시각. 기본 now(). */
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** 다음 상태로 전환 시 채워짐 */
  endedAt: timestamp('ended_at', { withTimezone: true }),
  /** 변경한 매니저/어드민 */
  createdBy: uuid('created_by').references(() => users.id, {
    onDelete: 'set null',
  }),
});

export type ServiceStatus = typeof serviceStatus.$inferSelect;
export type NewServiceStatus = typeof serviceStatus.$inferInsert;
