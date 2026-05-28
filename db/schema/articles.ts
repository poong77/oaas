/**
 * `articles` — SS-02, SS-03, SS-06 (Phase 3 셀프 서치 핸드북).
 *
 * 운영 패턴:
 *   - draft = `published_at IS NULL`
 *   - 발행 = `published_at = now()`, TOC 자동 추출
 *   - 비활성 = `is_active = false` (소프트 삭제)
 *   - 조회수 증가는 페이지 진입 시 fire-and-forget
 *   - 도움됨 카운터(`helpful_yes`, `helpful_no`)는 `article_feedback` 변경 시 트랜잭션으로 갱신
 *
 * 인덱스:
 *   - slug unique
 *   - (product_code, published_at desc) — 제품별 발행 목록
 *   - (is_active, published_at desc) — 통합 발행 목록
 *
 * 참고: product_code는 categories.code 참조 (FK 미설정 — 카테고리 변경 유연성 확보)
 */

import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { users } from './users';

/** TOC 엔트리 (발행 시 본문에서 자동 추출). */
export type TocEntry = {
  level: 1 | 2 | 3;
  text: string;
  anchor: string;
};

export const articles = pgTable(
  'articles',
  {
    ...commonColumns(),
    productCode: text('product_code').notNull(),
    categoryPath: text('category_path').array(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    summary30s: text('summary_30s'),
    bodyMarkdown: text('body_markdown').notNull(),
    toc: jsonb('toc').$type<TocEntry[]>(),
    relatedArticleIds: uuid('related_article_ids').array(),
    authorId: uuid('author_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    viewCount: integer('view_count').notNull().default(0),
    helpfulYes: integer('helpful_yes').notNull().default(0),
    helpfulNo: integer('helpful_no').notNull().default(0),
  },
  (table) => [
    uniqueIndex('articles_slug_uq').on(table.slug),
    index('articles_product_published_idx').on(
      table.productCode,
      table.publishedAt,
    ),
    index('articles_active_published_idx').on(
      table.isActive,
      table.publishedAt,
    ),
  ],
);

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
