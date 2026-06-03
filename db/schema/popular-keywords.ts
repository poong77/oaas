/**
 * `popular_keywords` — 인기검색어 하이브리드 큐레이션 (SS-04).
 *
 * 홈 Hero + /search 빈 결과 화면의 "# 키워드" 칩.
 *
 * 하이브리드 방식:
 *   - auto: search_logs.topQueries(30일) 실시간 집계 (이 테이블에 저장하지 않음)
 *   - pin  : 어드민이 항상 상단 고정 (sort_order)
 *   - block: 자동집계에서 제외할 노이즈/금칙어 (normalized_keyword로 매칭)
 *
 * 노출 = pin → auto(block 제외 + pin 중복 제외) 순서로 병합, 최대 N개.
 * DB row 0건 또는 auto 0건이면 _constants.ts 하드코딩 fallback.
 */

import { index, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { commonColumns, popularKeywordKindEnum } from './_shared';

export const popularKeywords = pgTable(
  'popular_keywords',
  {
    ...commonColumns(),
    /** 표시용 원본 키워드 (pin은 이 값을 그대로 노출). */
    keyword: text('keyword').notNull(),
    /** normalizeTerm() 적용 키 — block ↔ auto(normalizedQuery) 매칭용. */
    normalizedKeyword: text('normalized_keyword').notNull(),
    kind: popularKeywordKindEnum('kind').notNull().default('pin'),
    /** pin 정렬 순서 (작을수록 앞). block은 의미 없음. */
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    index('popular_keywords_kind_idx').on(table.kind),
    index('popular_keywords_norm_idx').on(table.normalizedKeyword),
  ],
);

export type PopularKeyword = typeof popularKeywords.$inferSelect;
export type NewPopularKeyword = typeof popularKeywords.$inferInsert;
