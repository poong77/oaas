/**
 * `term_synonyms` — 그룹별 동의어 (synonyms-master Phase).
 *
 * 한 그룹에 N개. 같은 (group_id, term, language) 중복 방지.
 *
 * `term` 은 원본 보존 (대소문자/공백 그대로). 매칭 시점에 lower+trim 비교 (Q-2).
 * Q-3: 검색 확장 시 2자 미만 term은 제외 (`expandKeywords` 단계에서 필터).
 *
 * 다의어 허용: 같은 term이 여러 그룹에 등록 가능 (예: 'CI'가 'check-in'과 'continuous integration'에).
 */

import { index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { termGroups } from './term-groups';

export const termSynonyms = pgTable(
  'term_synonyms',
  {
    ...commonColumns(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => termGroups.id, { onDelete: 'cascade' }),
    /** 동의어 원본 (대소문자/공백 보존). 검색 시 lower+trim 비교 */
    term: text('term').notNull(),
    /** 'ko' | 'en' (P0). 'ja'/'zh'는 P2 — enum 대신 text */
    language: text('language').notNull().default('ko'),
    /** 가중치 (0~10). P0에선 보관만, 랭킹은 후속 */
    weight: integer('weight').notNull().default(5),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    uniqueIndex('term_synonyms_group_term_uq').on(
      table.groupId,
      table.term,
      table.language,
    ),
    index('term_synonyms_term_idx').on(table.term),
    index('term_synonyms_group_idx').on(table.groupId),
  ],
);

export type TermSynonym = typeof termSynonyms.$inferSelect;
export type NewTermSynonym = typeof termSynonyms.$inferInsert;
