/**
 * 검색 실사용 로그 — Layer B (온라인 행동 지표).
 *
 * 실제 사용자 검색을 기록해 운영 지표를 산출:
 *   - 0건 검색률 + 0건 top 질의 (콘텐츠/동의어 갭 신호)
 *   - CTR(클릭률) · 평균 클릭 위치
 *   - 검색→접수 전환율 (deflection 반대 지표) — 검색 후 티켓 접수로 넘어간 비율
 *
 * 1행 = 1회 검색. 클릭/티켓 전환은 같은 행을 사후 업데이트(best-effort).
 * fire-and-forget 기록 — 실패해도 검색 메인 흐름에 영향 없음.
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { users } from './users';

export type SearchResultCounts = {
  help: number;
  faq: number;
  notice: number;
  incident: number;
};

export const searchLogs = pgTable(
  'search_logs',
  {
    ...commonColumns(),
    /** 원본 검색어. */
    query: text('query').notNull(),
    /** 정규화 질의 (lower+trim) — 집계 그룹핑용. */
    normalizedQuery: text('normalized_query').notNull(),
    /** 탭별 결과 수. */
    resultCounts: jsonb('result_counts')
      .$type<SearchResultCounts>()
      .notNull()
      .default({ help: 0, faq: 0, notice: 0, incident: 0 }),
    totalResults: integer('total_results').notNull().default(0),
    /** 결과 0건 여부 (콘텐츠 갭 핵심 지표). */
    zeroResult: boolean('zero_result').notNull().default(false),
    /** 결과 클릭 여부. */
    clicked: boolean('clicked').notNull().default(false),
    clickedKind: text('clicked_kind'), // 'help' | 'faq' | 'notice' | 'incident'
    clickedRef: text('clicked_ref'),
    /** 클릭한 결과의 순위 (1-based) — 평균 클릭 위치 산출. */
    clickedPosition: integer('clicked_position'),
    /** 검색 후 티켓 접수로 이어졌는지 (deflection 실패 = 자가해결 실패). */
    ledToTicket: boolean('led_to_ticket').notNull().default(false),
    productCode: text('product_code'),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    role: text('role'),
    /** 검색→클릭→티켓 연결용 클라이언트 세션 키. */
    sessionKey: text('session_key'),
  },
  (table) => [
    index('search_logs_created_idx').on(table.createdAt),
    index('search_logs_zero_idx').on(table.zeroResult),
    index('search_logs_norm_idx').on(table.normalizedQuery),
    index('search_logs_session_idx').on(table.sessionKey),
  ],
);

export type SearchLog = typeof searchLogs.$inferSelect;
export type NewSearchLog = typeof searchLogs.$inferInsert;
