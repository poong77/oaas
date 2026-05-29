/**
 * `ticket_no_counter` — 연도별 티켓 채번 카운터.
 *
 * 운영 패턴:
 *   - 신규 티켓 생성 시 atomic UPSERT (INSERT ... ON CONFLICT DO UPDATE RETURNING).
 *   - 기존 `tickets.ticket_no` MAX 기반 채번을 대체 — Neon replica lag race 제거.
 *   - 연도 키. 새해(1월 1일) 자동으로 새 row 생성 + last_no=1부터 시작.
 *
 * 시드(900001+) 영역은 카운터에 포함하지 않음. 운영 번호만 추적.
 *
 * Phase 9 후속 — ticket_no 충돌 fix (5cec26c bump×10 retry=10 추가 강화).
 */

import { integer, pgTable } from 'drizzle-orm/pg-core';

export const ticketNoCounter = pgTable('ticket_no_counter', {
  /** 연도 (예: 2026). 연도별 독립 시퀀스. */
  year: integer('year').primaryKey(),
  /** 해당 연도의 마지막 발급 번호. nextval := last_no + 1. */
  lastNo: integer('last_no').notNull().default(0),
});

export type TicketNoCounter = typeof ticketNoCounter.$inferSelect;
export type NewTicketNoCounter = typeof ticketNoCounter.$inferInsert;
