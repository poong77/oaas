/**
 * `article_seq_counters` — Slug 운영 ID 채번 카운터 (A7).
 *
 * 운영 패턴:
 *   - 신규 아티클 작성 시 atomic UPSERT (INSERT ... ON CONFLICT DO UPDATE RETURNING).
 *   - composite key (product_code, content_type) — 카테고리별 독립 시퀀스.
 *   - last_seq = N → 다음 채번 N+1, slug = `{productCode}-{contentType}-{seq3-padded}`.
 *
 * 예시:
 *   ('pms', 'howto', 42)  → 다음 slug: pms-howto-043
 *   ('cms', 'troubleshoot', 13) → cms-troubleshoot-014
 *
 * 시드/기존 published 아티클은 카운터에 포함하지 않음 (신규 작성만 추적).
 *
 * @see docs/02-design/knowledge-base-overhaul/PLAN.md §12-1
 */

import { integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

export const articleSeqCounters = pgTable(
  'article_seq_counters',
  {
    productCode: text('product_code').notNull(),
    contentType: text('content_type').notNull(),
    /** 마지막 발급 시퀀스 (0 = 미발급, 첫 채번 시 1). */
    lastSeq: integer('last_seq').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.productCode, t.contentType] }),
  }),
);

export type ArticleSeqCounter = typeof articleSeqCounters.$inferSelect;
export type NewArticleSeqCounter = typeof articleSeqCounters.$inferInsert;
