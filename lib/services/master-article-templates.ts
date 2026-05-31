/**
 * 마스터 — 아티클 본문 골격 (A1+).
 *
 * 운영 패턴:
 *   - 코드 상수(`lib/articles/templates.ts`)는 seed 기본값
 *   - DB(`article_templates`)가 정본
 *   - 에디터 fetch 시 캐시 적용 (unstable_cache)
 *   - 비활성 시 코드 상수로 폴백
 *
 * @see docs/02-design/knowledge-base-overhaul/PLAN.md §12-2
 */

import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { unstable_cache, revalidateTag } from 'next/cache';

import { db } from '@/db';
import {
  articleTemplates,
  type ArticleTemplate as ArticleTemplateRow,
  type NewArticleTemplate,
} from '@/db/schema';
import type { ArticleContentType } from '@/db/schema';
import {
  getArticleTemplate as getCodeTemplate,
  type ArticleTemplate as CodeTemplate,
  type TemplateHeading,
} from '@/lib/articles/templates';

const TEMPLATE_CACHE_TAG = 'article-templates';

export type ResolvedTemplate = {
  contentType: ArticleContentType;
  bodyMarkdown: string;
  outline: TemplateHeading[];
  hoverPreview: string;
  source: 'db' | 'code-fallback';
  version: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// 조회 — 에디터 / 어드민 공용
// ─────────────────────────────────────────────────────────────────────────────

const _loadActiveByType = unstable_cache(
  async (
    contentType: ArticleContentType,
  ): Promise<ArticleTemplateRow | null> => {
    if (!db) return null;
    try {
      const rows = await db
        .select()
        .from(articleTemplates)
        .where(
          and(
            eq(articleTemplates.contentType, contentType),
            eq(articleTemplates.isActive, true),
          ),
        )
        .orderBy(desc(articleTemplates.version))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      console.error(
        '[master-article-templates._loadActiveByType] 실패:',
        err,
      );
      return null;
    }
  },
  ['article-templates:v1-active'],
  { revalidate: 300, tags: [TEMPLATE_CACHE_TAG] },
);

/**
 * 에디터 진입점 — DB 정본 우선, 없으면 코드 상수 폴백.
 *
 * @example
 * const tpl = await resolveArticleTemplate('howto');
 * setBody(tpl.bodyMarkdown);
 */
export async function resolveArticleTemplate(
  contentType: ArticleContentType,
): Promise<ResolvedTemplate> {
  const row = await _loadActiveByType(contentType);
  if (row) {
    return {
      contentType,
      bodyMarkdown: row.bodyMarkdown,
      outline: row.outline as TemplateHeading[],
      hoverPreview: row.hoverPreview,
      source: 'db',
      version: row.version,
    };
  }
  // 폴백: 코드 상수
  const code: CodeTemplate = getCodeTemplate(contentType);
  return {
    contentType,
    bodyMarkdown: code.bodyMarkdown,
    outline: code.outline,
    hoverPreview: code.hoverPreview,
    source: 'code-fallback',
    version: 0,
  };
}

/** 어드민 인덱스 — 모든 content_type × 모든 version (비활성 포함). */
export async function listAllArticleTemplates(): Promise<ArticleTemplateRow[]> {
  if (!db) return [];
  try {
    return await db
      .select()
      .from(articleTemplates)
      .orderBy(articleTemplates.contentType, desc(articleTemplates.version));
  } catch (err) {
    console.error('[master-article-templates.listAll] 실패:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 변경 — 어드민 CRUD
// ─────────────────────────────────────────────────────────────────────────────

export type CreateArticleTemplateInput = {
  contentType: ArticleContentType;
  bodyMarkdown: string;
  outline: TemplateHeading[];
  hoverPreview: string;
};

/** 신규 골격 — 같은 content_type의 max(version) + 1로 채번. */
export async function createArticleTemplate(
  input: CreateArticleTemplateInput,
): Promise<{ ok: true; id: string; version: number } | { ok: false; message: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const rows = await db
      .select({ v: articleTemplates.version })
      .from(articleTemplates)
      .where(eq(articleTemplates.contentType, input.contentType))
      .orderBy(desc(articleTemplates.version))
      .limit(1);
    const nextVersion = (rows[0]?.v ?? 0) + 1;

    const [inserted] = await db
      .insert(articleTemplates)
      .values({
        contentType: input.contentType,
        version: nextVersion,
        bodyMarkdown: input.bodyMarkdown,
        outline: input.outline,
        hoverPreview: input.hoverPreview,
      } satisfies NewArticleTemplate)
      .returning({ id: articleTemplates.id });
    revalidateTag(TEMPLATE_CACHE_TAG, 'default');
    return { ok: true, id: inserted!.id, version: nextVersion };
  } catch (err) {
    console.error('[master-article-templates.create] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function updateArticleTemplate(
  id: string,
  patch: Partial<CreateArticleTemplateInput> & { isActive?: boolean },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(articleTemplates)
      .set({
        ...(patch.bodyMarkdown !== undefined ? { bodyMarkdown: patch.bodyMarkdown } : {}),
        ...(patch.outline !== undefined ? { outline: patch.outline } : {}),
        ...(patch.hoverPreview !== undefined ? { hoverPreview: patch.hoverPreview } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      })
      .where(eq(articleTemplates.id, id));
    revalidateTag(TEMPLATE_CACHE_TAG, 'default');
    return { ok: true };
  } catch (err) {
    console.error('[master-article-templates.update] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}
