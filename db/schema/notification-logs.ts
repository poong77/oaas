/**
 * `notification_logs` — SMS / 이메일 / Slack 발송 이력 (append-only).
 *
 * - 호출은 fire-and-forget (`lib/notifications/*` 내부에서 자동 기록).
 * - 발송 실패가 메인 로직 중단을 일으키면 안 된다.
 * - is_active 없음 (append-only).
 *
 * 인덱스:
 *   - (related_ticket_id, created_at desc) — 티켓별 발송 이력
 *   - (status) — 실패 모니터링
 */

import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { tickets } from './tickets';

export const notificationChannelEnum = pgEnum('notification_channel', [
  'sms',
  'email',
  'slack',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'sent',
  'failed',
  'retry',
]);

export type NotificationChannel =
  (typeof notificationChannelEnum.enumValues)[number];
export type NotificationStatus =
  (typeof notificationStatusEnum.enumValues)[number];

export const notificationLogs = pgTable(
  'notification_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** 'ticket.received', 'ticket.escalated_dev' 등. lib/notifications/templates.ts 참고. */
    templateEventKey: text('template_event_key').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    /** 전화번호 / 이메일 주소 / Slack 채널명. */
    toAddress: text('to_address'),
    payload: jsonb('payload')
      .notNull()
      .default({})
      .$type<Record<string, unknown>>(),
    status: notificationStatusEnum('status').notNull(),
    attempts: integer('attempts').notNull().default(1),
    errorMessage: text('error_message'),
    relatedTicketId: uuid('related_ticket_id').references(() => tickets.id, {
      onDelete: 'set null',
    }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('notification_logs_ticket_created_idx').on(
      table.relatedTicketId,
      table.createdAt,
    ),
    index('notification_logs_status_idx').on(table.status),
  ],
);

export type NotificationLog = typeof notificationLogs.$inferSelect;
export type NewNotificationLog = typeof notificationLogs.$inferInsert;
