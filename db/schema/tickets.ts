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
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
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

/**
 * 채널은 `ticket_channels` 마스터의 code 문자열을 참조한다.
 * FK는 걸지 않음 — 마스터 비활성화돼도 과거 티켓 raw 값 보존.
 * 시드: 'web' | 'phone' | 'chatbot' | 'kakao' | 'email' | 'walk_in' (확장 가능).
 */
export type TicketStatus = (typeof ticketStatusEnum.enumValues)[number];
export type TicketChannel = string;

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
    /** ticket_channels.code 참조 (FK 미설정, 마이그레이션 0007에서 enum→text 변환) */
    channel: text('channel').notNull().default('web'),
    /** IC-03: ['sms','email'] 또는 ['sms'] 또는 ['email']. */
    contactMethods: jsonb('contact_methods')
      .notNull()
      .default([])
      .$type<TicketContactMethod[]>(),
    /**
     * DI-01: 유입 채널 복수. 같은 건이 이메일+AS 등 2개 이상으로 유입 가능.
     * `channel`(단일)은 primary로 유지. 비어있으면 [channel]로 간주.
     * 대시보드 채널 차트는 length>=2면 '여럿'으로 단일 집계(중복 합산 방지).
     */
    channels: jsonb('channels')
      .notNull()
      .default([])
      .$type<string[]>(),
    /**
     * DI-01: 원콜 해결 여부. 담당자가 완료 처리 시 "원콜 해결" 체크.
     * 유입 건을 1회 작업으로 해결했는지(원콜완료 지표 모수).
     */
    oneCallResolved: boolean('one_call_resolved').notNull().default(false),
    /** Slack #as-new 스레드 ts (양방향 동기화 시 사용 예정 — Phase 5는 발송만). */
    slackThreadTs: text('slack_thread_ts'),
    /** Slack #dev-escalation 스레드 ts. */
    slackDevThreadTs: text('slack_dev_thread_ts'),
    /**
     * ai-reply-assist — 시맨틱 추천/유사 티켓용 임베딩
     * (OpenAI text-embedding-3-small, 1536차원, articles/faqs와 동일 벡터공간).
     * title+content로 생성. null = 미생성(추천 생략, graceful degrade).
     * 생성/본문 수정 시 fire-and-forget 갱신, 누락분은 db:backfill-ticket-embeddings로 보정.
     */
    embedding: vector('embedding', { dimensions: 1536 }),
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
    // ai-reply-assist — 시맨틱 검색 HNSW 코사인 인덱스 (pgvector, articles 패턴 동일).
    index('tickets_embedding_hnsw').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  ],
);

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
