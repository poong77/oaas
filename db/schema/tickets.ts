/**
 * `tickets` — Phase 5 이슈 클레임 핵심 테이블.
 *
 * 운영 패턴:
 *   - 티켓번호는 `AS-YYYY-NNNNNN` 형식. `lib/services/tickets.ts`의 generateTicketNo()에서 발급.
 *   - 상태 전환은 `ticket_messages`에 kind='status_change' 메시지로 항상 기록.
 *   - 비활성(is_active=false)은 사실상 사용하지 않음 (이력 보존). 어드민이 명시적으로 닫을 때만.
 *
 * 인덱스 전략:
 *   - 큐 정렬: status + created_at desc
 *   - 내 문의: reporter_id + created_at desc
 *   - 호텔 단위 조회: hotel_id + created_at desc
 *   - P1 긴급 필터: urgency + status
 */

import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { hotels } from './hotels';
import { users } from './users';

export const ticketStatusEnum = pgEnum('ticket_status_kind', [
  'received',
  'in_progress',
  'on_hold',
  'completed',
]);

export const ticketChannelEnum = pgEnum('ticket_channel_kind', [
  'web',
  'phone',
  'chatbot',
]);

export type TicketStatus = (typeof ticketStatusEnum.enumValues)[number];
export type TicketChannel = (typeof ticketChannelEnum.enumValues)[number];

/** IC-03: 호텔리어 선호 연락 수단 (복수 선택 가능). */
export type TicketContactMethod = 'sms' | 'email';

export const tickets = pgTable(
  'tickets',
  {
    ...commonColumns(),
    /** 'AS-2026-000001' 형식. lib/services/tickets.ts.generateTicketNo() 참고. */
    ticketNo: text('ticket_no').notNull(),
    hotelId: uuid('hotel_id').references(() => hotels.id, {
      onDelete: 'set null',
    }),
    reporterId: uuid('reporter_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    productCode: text('product_code').notNull(),
    issueType: text('issue_type').notNull(),
    urgency: text('urgency').notNull(),
    impactScope: text('impact_scope'),
    title: text('title').notNull(),
    /** markdown */
    content: text('content').notNull(),
    /** ticket_form_fields 응답 (Phase 9에서 동적 폼 본격화). */
    customFields: jsonb('custom_fields')
      .notNull()
      .default({})
      .$type<Record<string, unknown>>(),
    status: ticketStatusEnum('status').notNull().default('received'),
    assigneeId: uuid('assignee_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    dueDate: timestamp('due_date', { withTimezone: true }),
    channel: ticketChannelEnum('channel').notNull().default('web'),
    /** IC-03: ['sms','email'] 또는 ['sms'] 또는 ['email']. */
    contactMethods: jsonb('contact_methods')
      .notNull()
      .default([])
      .$type<TicketContactMethod[]>(),
    /** Slack #as-new 스레드 ts (양방향 동기화 시 사용 예정 — Phase 5는 발송만). */
    slackThreadTs: text('slack_thread_ts'),
    /** Slack #dev-escalation 스레드 ts. */
    slackDevThreadTs: text('slack_dev_thread_ts'),
  },
  (table) => [
    uniqueIndex('tickets_ticket_no_uq').on(table.ticketNo),
    index('tickets_status_created_idx').on(table.status, table.createdAt),
    index('tickets_reporter_created_idx').on(
      table.reporterId,
      table.createdAt,
    ),
    index('tickets_hotel_created_idx').on(table.hotelId, table.createdAt),
    index('tickets_assignee_status_idx').on(table.assigneeId, table.status),
    index('tickets_urgency_status_idx').on(table.urgency, table.status),
  ],
);

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
