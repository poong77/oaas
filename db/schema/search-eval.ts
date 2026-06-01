/**
 * 검색 품질 평가 — Layer A (오프라인 골든셋 평가).
 *
 * search_eval_queries — 골든셋(정답셋). "이 질의엔 이 글/FAQ가 정답" 매핑.
 *   - FAQ에서 자동 시드(question→해당 FAQ) 또는 어드민 수기 등록 또는 LLM 생성.
 * search_eval_runs — 평가 실행 1회의 집계 점수 + 질의별 상세(jsonb).
 *   - Hit@1 / Hit@3 / MRR / nDCG@5 를 실제 검색 함수로 산출.
 *
 * @see lib/services/search-eval.ts (평가 엔진)
 */

import {
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { commonColumns } from './_shared';
import { users } from './users';

/** 골든셋 질의 출처. */
export const searchEvalSourceEnum = pgEnum('search_eval_source', [
  'faq', // 기존 FAQ에서 자동 시드 (question = 질의, 해당 FAQ = 정답)
  'manual', // 어드민 수기 등록 (자주 묻는 100문항 등)
  'llm', // LLM이 아티클에서 생성한 현실적 질의
]);
export type SearchEvalSource = (typeof searchEvalSourceEnum.enumValues)[number];

/** 적합도 판정 방식. */
export const searchEvalJudgeEnum = pgEnum('search_eval_judge', [
  'label', // 골든셋 정답 라벨 기준 (Hit = 정답 ref가 top-k에 존재)
  'llm', // LLM이 결과 적합도 0~3 채점 → graded nDCG
  'hybrid', // 라벨 있으면 라벨, 없으면 LLM
]);
export type SearchEvalJudge = (typeof searchEvalJudgeEnum.enumValues)[number];

export const searchEvalQueries = pgTable(
  'search_eval_queries',
  {
    ...commonColumns(),
    /** 테스트 질의 (사용자가 칠 법한 검색어). */
    query: text('query').notNull(),
    /** 정답 아티클 slug 목록 (any 매칭 시 정답). */
    expectedArticleSlugs: text('expected_article_slugs')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** 정답 FAQ id 목록 (any 매칭 시 정답). */
    expectedFaqIds: uuid('expected_faq_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    /** 검색 재현용 제품 필터 (선택). */
    productCode: text('product_code'),
    source: searchEvalSourceEnum('source').notNull().default('manual'),
    /** 분류/메모 (예: "결제", "도어락"). 실패 분석 그룹핑용. */
    note: text('note'),
  },
  (table) => [
    index('search_eval_queries_active_idx').on(table.isActive),
    index('search_eval_queries_source_idx').on(table.source),
  ],
);

export type SearchEvalQuery = typeof searchEvalQueries.$inferSelect;
export type NewSearchEvalQuery = typeof searchEvalQueries.$inferInsert;

/** 질의별 상세 평가 결과 (run.details jsonb 요소). */
export type SearchEvalDetail = {
  queryId: string;
  query: string;
  /** 질의 분류/메모 (실패 분석 그룹핑). */
  note?: string | null;
  /** 정답이 처음 등장한 등수 (1-based). 못 찾으면 null. */
  rankOfFirstRelevant: number | null;
  reciprocalRank: number; // 1/rank, 못 찾으면 0
  ndcg: number; // nDCG@5
  hitTop1: boolean;
  hitTop3: boolean;
  /** 상위 결과 스냅샷 (실패 분석용). */
  top: Array<{
    kind: 'help' | 'faq';
    ref: string; // article slug 또는 faq id
    title: string;
    score: number;
    relevant: boolean; // 라벨/LLM 기준 적합 여부
    judgeScore?: number; // LLM 0~3 (judge=llm/hybrid일 때)
  }>;
};

export const searchEvalRuns = pgTable(
  'search_eval_runs',
  {
    ...commonColumns(),
    queryCount: integer('query_count').notNull().default(0),
    /** Hit@1 (정답이 1위) 비율 0~1. */
    hit1: doublePrecision('hit1').notNull().default(0),
    /** Hit@3 (정답이 top3) 비율 0~1. */
    hit3: doublePrecision('hit3').notNull().default(0),
    /** Mean Reciprocal Rank 0~1. */
    mrr: doublePrecision('mrr').notNull().default(0),
    /** Mean nDCG@5 0~1. */
    ndcg: doublePrecision('ndcg').notNull().default(0),
    judgeMode: searchEvalJudgeEnum('judge_mode').notNull().default('label'),
    /** 실행 시점 검색 파라미터 스냅샷 (vecWeight 등). */
    params: jsonb('params').notNull().default({}),
    /** 질의별 상세 (SearchEvalDetail[]). */
    details: jsonb('details').$type<SearchEvalDetail[]>().notNull().default([]),
    triggeredBy: uuid('triggered_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    ranAt: timestamp('ran_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('search_eval_runs_ran_at_idx').on(table.ranAt)],
);

export type SearchEvalRun = typeof searchEvalRuns.$inferSelect;
export type NewSearchEvalRun = typeof searchEvalRuns.$inferInsert;
