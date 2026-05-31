/**
 * /help/[product]/[content_type] — depth-2 인덱스 + 레거시 슬러그 호환.
 *
 * v1.1 라우팅에서 Next.js 동적 세그먼트 동명 규칙 때문에
 * 이 자리(파라미터 이름 = content_type)에 레거시 /help/[product]/[slug] 리다이렉트 로직을 함께 둡니다.
 *
 * 분기:
 *   1) 두 번째 세그먼트가 유효 content_type(howto/feature/troubleshoot)
 *      → 현재는 카테고리 인덱스 미구현이므로 404 (후속에서 카테고리 목록 페이지로 확장 예정)
 *   2) 그 외 값 → 레거시 슬러그로 간주하여 article_redirects 폴백 포함 308 리다이렉트
 *      - 직접 slug 조회 성공 → /help/[product]/[content_type]/[slug] 308
 *      - article_redirects 폴백 → toSlug로 재조회 후 308
 *      - 모두 실패 → 404
 *
 * @see app/help/[product]/[content_type]/[slug]/page.tsx (canonical detail)
 * @see lib/services/article-redirects.ts
 */

import { notFound, permanentRedirect } from 'next/navigation';
import { getArticleBySlug } from '@/lib/services/articles';
import { getRedirectByFromPath } from '@/lib/services/article-redirects';

export const dynamic = 'force-dynamic';

const VALID_CONTENT_TYPES = new Set(['howto', 'feature', 'troubleshoot']);

type RouteParams = Promise<{ product: string; content_type: string }>;

export default async function HelpProductContentTypeIndex({
  params,
}: {
  params: RouteParams;
}) {
  const { product, content_type: contentType } = await params;

  // 1) 유효 content_type — 카테고리 인덱스는 후속 작업, 현재는 404
  if (VALID_CONTENT_TYPES.has(contentType)) {
    notFound();
  }

  // 2) 레거시 슬러그로 간주 — 직접 조회
  const article = await getArticleBySlug(contentType, { includeUnpublished: false });
  if (article) {
    permanentRedirect(
      `/help/${article.productCode}/${article.contentType}/${article.slug}`,
    );
  }

  // 3) article_redirects 폴백
  const redirect = await getRedirectByFromPath(`/help/${product}/${contentType}`);
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
