/**
 * `quick_reply_templates` — Phase 9.
 *
 * 매니저가 티켓 답변 작성 시 자주 쓰는 응대 문구 템플릿.
 * 카테고리는 자유 텍스트 (예: '결제', '카드키', '일반').
 */

import { integer, pgTable, text } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';

export const quickReplyTemplates = pgTable('quick_reply_templates', {
  ...commonColumns(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  category: text('category'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export type QuickReplyTemplate = typeof quickReplyTemplates.$inferSelect;
export type NewQuickReplyTemplate = typeof quickReplyTemplates.$inferInsert;
