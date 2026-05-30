/**
 * article_redirects 서비스 — slug 변경 시 옛 URL 보존.
 *
 * @see docs/02-design/features/아티클관리시스템.design.md §3.2, §5.2
 */

import 'server-only';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import {
  articleRedirects,
  type ArticleRedirect,
  type NewArticleRedirect,
} from '@/db/schema';

export type RedirectReason =
  | 'slug_rename'
  | 'content_type_change'
  | 'manual';

/** fromPath 기준 단건 조회 (활성만). */
export async function getRedirectByFromPath(
  fromPath: string,
): Promise<ArticleRedirect | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(articleRedirects)
      .where(
        and(
          eq(articleRedirects.fromPath, fromPath),
          eq(articleRedirects.isActive, true),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[article-redirects.getRedirectByFromPath] 실패:', err);
    return null;
  }
}

/**
 * 리다이렉트 등록 (UPSERT — fromPath 중복 시 toSlug 갱신).
 *
 * 호출자 책임:
 *   - fromPath는 path-only (예: `/help/oa-pms/old-slug`)
 *   - 이미 있어도 정상 (toSlug만 최신화)
 */
export async function upsertRedirect(
  input: Pick<NewArticleRedirect, 'fromPath' | 'toSlug' | 'reason'>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .insert(articleRedirects)
      .values({
        fromPath: input.fromPath,
        toSlug: input.toSlug,
        reason: input.reason ?? null,
      })
      .onConflictDoUpdate({
        target: articleRedirects.fromPath,
        set: {
          toSlug: input.toSlug,
          reason: input.reason ?? null,
          isActive: true,
        },
      });
    return { ok: true };
  } catch (err) {
    console.error('[article-redirects.upsertRedirect] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}
