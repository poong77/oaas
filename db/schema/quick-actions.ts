/**
 * `quick_actions` — Phase 9.
 *
 * 홈 LP-01 ④ "자주 찾는 작업" 카드 정의.
 * icon은 lucide-react 컴포넌트 이름 문자열 (예: 'KeyRound').
 * visible=false면 어드민에서는 보이되 홈에서는 숨김.
 */

import { boolean, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';

export const quickActions = pgTable('quick_actions', {
  ...commonColumns(),
  label: text('label').notNull(),
  description: text('description'),
  icon: text('icon'),
  linkUrl: text('link_url').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  visible: boolean('visible').notNull().default(true),
});

export type QuickAction = typeof quickActions.$inferSelect;
export type NewQuickAction = typeof quickActions.$inferInsert;
