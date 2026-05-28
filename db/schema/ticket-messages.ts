/**
 * `ticket_messages` — 티켓 스레드 (공개 답변 + 내부 메모 + 시스템 이벤트).
 *
 * `kind` 값:
 *   - 'public'         — 호텔리어/매니저 양측 공개 답변
 *   - 'internal_memo'  — 매니저+어드민 전용 (호텔리어에게 노출 금지: 서버 단 필터)
 *   - 'status_change'  — 시스템 자동 ('received' → 'in_progress' 등)
 *   - 'system'         — Slack 발송 결과 등 audit 성
 *
 * 호텔리어 조회 시 반드시 `kind in ('public','status_change')` 필터를 적용한다.
 */

import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { tickets } from './tickets';
import { users } from './users';

export const ticketMessageKindEnum = pgEnum('ticket_message_kind', [
  'public',
  'internal_memo',
  'status_change',
  'system',
]);

export type TicketMessageKind =
  (typeof ticketMessageKindEnum.enumValues)[number];

export const ticketMessages = pgTable(
  'ticket_messages',
  {
    ...commonColumns(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    kind: ticketMessageKindEnum('kind').notNull().default('public'),
    content: text('content').notNull(),
    /** status_change: { from, to }, system: { event_key, ... } */
    metadata: jsonb('metadata')
      .notNull()
      .default({})
      .$type<Record<string, unknown>>(),
  },
  (table) => [
    index('ticket_messages_ticket_created_idx').on(
      table.ticketId,
      table.createdAt,
    ),
    index('ticket_messages_kind_idx').on(table.ticketId, table.kind),
  ],
);

export type TicketMessage = typeof ticketMessages.$inferSelect;
export type NewTicketMessage = typeof ticketMessages.$inferInsert;
