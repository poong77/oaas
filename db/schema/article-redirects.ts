/**
 * `article_redirects` — 옛 아티클 URL → 새 slug 매핑.
 *
 * 용도:
 *   - slug 변경 시 옛 URL 보존 (SEO/북마크)
 *   - content_type 변경은 articles 자체 조회로 처리 가능하므로 본 테이블 불필요
 *   - 본 테이블은 "slug가 바뀌어 articles에서 못 찾을 때"의 백업 폴백
 *
 * 동작:
 *   - fromPath = 옛 경로 (예: `/help/oa-pms/old-slug`)
 *   - toSlug = 새 slug (articles.slug — slug가 unique이므로 충분)
 *   - reason: 'slug_rename' | 'content_type_change' | 'manual'
 *
 * @see docs/02-design/features/아티클관리시스템.design.md §3.2
 */

import { pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';

export const articleRedirects = pgTable(
  'article_redirects',
  {
    ...commonColumns(),
    /** 옛 경로 (path-only, host 미포함). 예: `/help/oa-pms/reservation-create` */
    fromPath: text('from_path').notNull(),
    /** 새 slug — articles.slug 참조 (FK 없음, slug rename 자유) */
    toSlug: text('to_slug').notNull(),
    /** 'slug_rename' | 'content_type_change' | 'manual' */
    reason: text('reason'),
  },
  (table) => [
    uniqueIndex('article_redirects_from_uq').on(table.fromPath),
  ],
);

export type ArticleRedirect = typeof articleRedirects.$inferSelect;
export type NewArticleRedirect = typeof articleRedirects.$inferInsert;
