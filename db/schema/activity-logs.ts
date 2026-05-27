/**
 * `activity_logs` — 감사 로그 (append-only).
 *
 * dev-rules.md §5: 어드민 액션, 권한 변경, 티켓 상태 변경, 비번 초기화 등 기록.
 * is_active 없음 (append-only).
 * fire-and-forget으로 호출 (`lib/audit.ts`).
 */

import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /** e.g. 'user.login', 'user.create', 'user.role_change' */
    action: text('action').notNull(),
    /** e.g. 'user', 'hotel', 'ticket' */
    targetType: text('target_type'),
    targetId: uuid('target_id'),
    payload: jsonb('payload')
      .notNull()
      .default({})
      .$type<Record<string, unknown>>(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('activity_logs_user_created_idx').on(
      table.userId,
      table.createdAt,
    ),
    index('activity_logs_action_idx').on(table.action),
  ],
);

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
