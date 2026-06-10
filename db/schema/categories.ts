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
  uuid,
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
    /** 업로드 아이콘 이미지 표시 URL(공개 프록시). 있으면 프론트에서 lucide(icon)보다 우선. */
    iconImageUrl: text('icon_image_url'),
    sortOrder: integer('sort_order').notNull().default(0),
    /**
     * 계층(대/중/소) 부모. NULL이면 대분류(root). 같은 type 내 self 참조.
     * 주로 product 분류 계층화에 사용. FK 미설정(마이그레이션/삭제 유연성).
     */
    parentId: uuid('parent_id'),
    /** 운영 메모 (예: '문의 디폴트값', 'PG/VAN/POS'). */
    memo: text('memo'),
    /** lucide 아이콘명·색상·기타 메타 (JSONB) */
    meta: jsonb('meta').notNull().default({}).$type<Record<string, unknown>>(),
  },
  (table) => [
    uniqueIndex('categories_type_code_uq').on(table.type, table.code),
  ],
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
