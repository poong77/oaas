/**
 * `term_groups` — 동의어 그룹 마스터 (synonyms-master Phase).
 *
 * 대표어(canonical) 1개 + 동의어 N개(`term_synonyms`)로 구성.
 * 검색 시 입력 토큰이 같은 그룹의 어떤 동의어와도 일치하면 그룹 전체 term을 OR 확장.
 *
 * `canonicalTerm`은 사용자 노출 표준 라벨, `term_synonyms`에 별도 INSERT 하지 않음.
 *  → `expandKeywords` 가 항상 canonical을 자동으로 포함한다.
 *
 * 어드민 마스터 메뉴: `/admin/master/synonyms`.
 */

import { index, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { commonColumns, termGroupCategoryEnum } from './_shared';

export const termGroups = pgTable(
  'term_groups',
  {
    ...commonColumns(),
    /** 대표어 — 사용자 노출 표준 한글 표현. unique. */
    canonicalTerm: text('canonical_term').notNull(),
    /** 도메인 분류 (운영/청소/F&B/프런트/PMS/제품/장애/직무/기타) — 어드민 필터 용도 */
    category: termGroupCategoryEnum('category').notNull().default('misc'),
    /** 운영자 메모 (검색 미반영) */
    description: text('description'),
    /**
     * 카테고리 자동 매칭 시 추천할 categories.id (issue_type/product 등).
     * FK 없음 (Q-5 결정) — 운영 유연성 우선. 조회 시 categories와 join으로 정합성 보강.
     */
    suggestedCategoryId: text('suggested_category_id'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    uniqueIndex('term_groups_canonical_uq').on(table.canonicalTerm),
    index('term_groups_category_idx').on(table.category),
    index('term_groups_sort_idx').on(table.sortOrder),
  ],
);

export type TermGroup = typeof termGroups.$inferSelect;
export type NewTermGroup = typeof termGroups.$inferInsert;
