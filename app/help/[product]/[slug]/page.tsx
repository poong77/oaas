/**
 * /help/[product]/[slug] — 레거시 URL → /help/[product]/[content_type]/[slug] 308 리다이렉트.
 *
 * v1.1 URL 패턴 변경 (Plan Q-5, Design §5):
 *   - 옛: /help/[product]/[slug]
 *   - 새: /help/[product]/[content_type]/[slug]
 *
 * 동작:
 *   1) slug로 articles 조회 → content_type 알면 정식 URL로 308
 *   2) 없으면 article_redirects 폴백 조회 → toSlug로 articles 재조회
 *   3) 둘 다 실패 시 404
 */

import { notFound, permanentRedirect } from 'next/navigation';
import { getArticleBySlug } from '@/lib/services/articles';
import { getRedirectByFromPath } from '@/lib/services/article-redirects';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ product: string; slug: string }>;

export default async function LegacyHelpArticleRedirect({
  params,
}: {
  params: RouteParams;
}) {
  const { product, slug } = await params;

  // 1) 직접 slug 조회
  const article = await getArticleBySlug(slug, { includeUnpublished: false });
  if (article) {
    permanentRedirect(
      `/help/${article.productCode}/${article.contentType}/${article.slug}`,
    );
  }

  // 2) article_redirects 폴백
  const redirect = await getRedirectByFromPath(`/help/${product}/${slug}`);
  if (redirect) {
    const target = await getArticleBySlug(redirect.toSlug, {
      includeUnpublished: false,
    });
    if (target) {
      permanentRedirect(
        `/help/${target.productCode}/${target.contentType}/${target.slug}`,
      );
    }
  }

  notFound();
}
