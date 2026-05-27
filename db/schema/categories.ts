/**
 * `categories` — 4종 단일 테이블 (product / issue_type / urgency / impact).
 *
 * (type, code) 조합으로 unique.
 * 어드민 마스터 메뉴에서 편집 (`/admin/master/categories` — Phase 9).
 */

import {
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { categoryTypeEnum, commonColumns } from './_shared';

export const categories = pgTable(
  'categories',
  {
    ...commonColumns(),
    type: categoryTypeEnum('type').notNull(),
    code: text('code').notNull(),
    label: text('label').notNull(),
    icon: text('icon'),
    sortOrder: integer('sort_order').notNull().default(0),
    /** lucide 아이콘명·색상·기타 메타 (JSONB) */
    meta: jsonb('meta').notNull().default({}).$type<Record<string, unknown>>(),
  },
  (table) => [
    uniqueIndex('categories_type_code_uq').on(table.type, table.code),
  ],
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
