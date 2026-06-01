/**
 * `faqs` — SF-01, SF-04 (Phase 4 셀프 픽스).
 *
 * 운영 패턴:
 *   - 카운터(`view_count`, `helpful_yes`, `helpful_no`)는 단순 증가만. 1회 제약은 localStorage.
 *   - 비활성은 `is_active = false` 소프트 삭제. 물리 삭제 금지.
 *   - 정렬은 `sort_order` (작을수록 위), 동일하면 `created_at desc`.
 *
 * 인덱스:
 *   - (product_code, sort_order) — 제품별 노출 순서
 *   - (is_active, product_code) — 활성 필터링 + 카운트
 *
 * 참고: product_code, issue_type은 categories.code를 참조하지만 FK는 걸지 않음 (마스터 변경 유연성 확보, articles와 동일 정책).
 */

import {
  index,
  integer,
  pgTable,
  text,
  vector,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { commonColumns } from './_shared';

export const faqs = pgTable(
  'faqs',
  {
    ...commonColumns(),
    productCode: text('product_code').notNull(),
    issueType: text('issue_type'),
    question: text('question').notNull(),
    answerMarkdown: text('answer_markdown').notNull(),
    /**
     * v1.7 — synonyms-master 결합 검색 보강 (articles.keywords와 동일 정책).
     * 어드민이 수동 큐레이션(+AI 제안)하는 한글 검색 키워드. 약어·영문·교차언어는
     * 여기가 아니라 동의어 마스터(term_groups/term_synonyms) 담당.
     * searchFaqs가 expandKeywords 결과와 arrayOverlaps(GIN)로 매칭.
     */
    keywords: text('keywords')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    sortOrder: integer('sort_order').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),
    helpfulYes: integer('helpful_yes').notNull().default(0),
    helpfulNo: integer('helpful_no').notNull().default(0),
    /**
     * v1.7 — 시맨틱 검색용 임베딩 (OpenAI text-embedding-3-small, 1536차원).
     * question+keywords+answer로 생성. null = 미생성(키워드 검색만).
     * articles.embedding과 동일 정책 + graceful degrade.
     */
    embedding: vector('embedding', { dimensions: 1536 }),
  },
  (table) => [
    index('faqs_product_sort_idx').on(table.productCode, table.sortOrder),
    index('faqs_active_product_idx').on(table.isActive, table.productCode),
    // v1.7 — keywords 배열 OR 매칭 (synonyms-master expandKeywords 결합)
    index('faqs_keywords_gin').using('gin', table.keywords),
    // v1.7 — 시맨틱 검색 HNSW 코사인 인덱스 (pgvector).
    // CREATE EXTENSION vector 는 articles 0020에서 이미 보강됨.
    index('faqs_embedding_hnsw').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  ],
);

export type Faq = typeof faqs.$inferSelect;
export type NewFaq = typeof faqs.$inferInsert;
