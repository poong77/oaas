/**
 * `faqs` — SF-01, SF-04 (Phase 4 셀프 픽스).
 *
 * 운영 패턴:
 *   - 카운터(`view_count`, `helpful_yes`, `helpful_no`)는 단순 증가만. 1회 제약은 localStorage.
 *   - 비활성은 `is_active = false` 소프트 삭제. 물리 삭제 금지.
 *   - 정렬은 `sort_order` (작을수록 위), 동일하면 `created_at desc`.
 *
 * 인덱스:
 *   - (product_code, sort_order) — 제품별 노출 순서
 *   - (is_active, product_code) — 활성 필터링 + 카운트
 *
 * 참고: product_code, issue_type은 categories.code를 참조하지만 FK는 걸지 않음 (마스터 변경 유연성 확보, articles와 동일 정책).
 */

import {
  index,
  integer,
  pgTable,
  text,
} from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';

export const faqs = pgTable(
  'faqs',
  {
    ...commonColumns(),
    productCode: text('product_code').notNull(),
    issueType: text('issue_type'),
    question: text('question').notNull(),
    answerMarkdown: text('answer_markdown').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),
    helpfulYes: integer('helpful_yes').notNull().default(0),
    helpfulNo: integer('helpful_no').notNull().default(0),
  },
  (table) => [
    index('faqs_product_sort_idx').on(table.productCode, table.sortOrder),
    index('faqs_active_product_idx').on(table.isActive, table.productCode),
  ],
);

export type Faq = typeof faqs.$inferSelect;
export type NewFaq = typeof faqs.$inferInsert;
