/**
 * `role_starters` — Phase 9.
 *
 * 홈 LP-01 ⑤ "역할별 시작하기" 카드.
 * role_key: 'front'|'sales'|'housekeeping'|'manager'|'new_open' (text unique).
 * article_ids는 articles.id 배열. 향후 `/role/[key]` 페이지에서 가이드 리스트로 표시.
 */

import { integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';

export const roleStarters = pgTable(
  'role_starters',
  {
    ...commonColumns(),
    roleKey: text('role_key').notNull(),
    label: text('label').notNull(),
    description: text('description'),
    icon: text('icon'),
    /** articles.id 배열. uuid[] (FK 없음 — articles 변경 유연성) */
    articleIds: uuid('article_ids').array().notNull().default([]),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [uniqueIndex('role_starters_role_key_uq').on(table.roleKey)],
);

export type RoleStarter = typeof roleStarters.$inferSelect;
export type NewRoleStarter = typeof roleStarters.$inferInsert;
