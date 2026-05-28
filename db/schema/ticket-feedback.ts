/**
 * `ticket_feedback` — Phase 6 ⑦ 호텔리어 피드백.
 *
 * 운영 규칙:
 *   - 1 ticket → 보통 1 active feedback 이지만 변경 가능하게 1:N 허용.
 *   - 최신만 활성(`is_active=true`). 호텔리어가 평가를 변경하면 기존 active row를
 *     `is_active=false` 처리 후 새 row insert (트랜잭션).
 *   - 본인(reporter) 티켓에만 제출 가능 — 권한 검증은 service/action 레이어.
 *
 * pgEnum 이름: `ticket_feedback_rating_kind` (테이블 이름과 동명 회피).
 *
 * 통계:
 *   - 만족도 비율 = COUNT(rating='resolved' AND is_active=true) / 전체 활성 피드백 수
 *   - 호텔별 / 담당자별 집계는 Phase 9 어드민 마스터에서 본격화 예정
 */

import {
  index,
  pgEnum,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { tickets } from './tickets';
import { users } from './users';

export const ticketFeedbackRatingEnum = pgEnum(
  'ticket_feedback_rating_kind',
  ['resolved', 'partial', 'unresolved'],
);

export type TicketFeedbackRating =
  (typeof ticketFeedbackRatingEnum.enumValues)[number];

export const ticketFeedback = pgTable(
  'ticket_feedback',
  {
    ...commonColumns(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    rating: ticketFeedbackRatingEnum('rating').notNull(),
    comment: text('comment'),
    submittedBy: uuid('submitted_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('ticket_feedback_ticket_idx').on(table.ticketId, table.isActive),
  ],
);

export type TicketFeedback = typeof ticketFeedback.$inferSelect;
export type NewTicketFeedback = typeof ticketFeedback.$inferInsert;
