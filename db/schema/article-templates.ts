/**
 * `article_templates` — content_type별 본문 골격 마스터 (A1+).
 *
 * 운영 패턴:
 *   - 코드 상수(`lib/articles/templates.ts`)는 seed 기본값으로 보존
 *   - 어드민 `master/article-templates`에서 편집 → DB 정본
 *   - 에디터는 `getArticleTemplate(contentType)`이 DB fetch (캐시 적용)
 *   - 비활성 = `is_active = false` (코드 상수로 폴백)
 *
 * 컬럼:
 *   - content_type — 'howto' | 'feature' | 'troubleshoot' (FK는 enum이라 X, 앱 레벨 검증)
 *   - version — 같은 content_type 안에서 버전 관리. 가장 큰 active version이 정본.
 *   - body_markdown — 본문 골격 (H2 + H3 + placeholder blockquote)
 *   - outline — TemplateHeading[] JSONB (UI용 메타: level/text/required/placeholder)
 *   - hover_preview — content_type 카드 호버 시 popover 텍스트 (~120자)
 *
 * @see docs/02-design/knowledge-base-overhaul/PLAN.md §12-2
 */

import { integer, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';

export const articleTemplates = pgTable(
  'article_templates',
  {
    ...commonColumns(),
    contentType: text('content_type').notNull(),
    version: integer('version').notNull().default(1),
    bodyMarkdown: text('body_markdown').notNull(),
    /** TemplateHeading[] — { level, text, placeholder, required } */
    outline: jsonb('outline').notNull(),
    hoverPreview: text('hover_preview').notNull(),
  },
  (t) => ({
    uqContentVersion: uniqueIndex('article_templates_content_version_uq').on(
      t.contentType,
      t.version,
    ),
  }),
);

export type ArticleTemplate = typeof articleTemplates.$inferSelect;
export type NewArticleTemplate = typeof articleTemplates.$inferInsert;
