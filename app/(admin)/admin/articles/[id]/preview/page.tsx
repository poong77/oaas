/**
 * /admin/articles/[id]/preview — 매니저 미리보기.
 *
 * Design D-6 결정: 별도 페이지 (다이얼로그 미사용). 호텔리어 화면과 100% 동일.
 *
 * 동작: articleId 조회 → `/help/[product]/[content_type]/[slug]`로 302.
 * 매니저/어드민은 canPreview=true이므로 draft 상태도 호텔리어 페이지에서 정상 렌더링됨.
 */

import { notFound, redirect } from 'next/navigation';

import { requireRole } from '@/lib/permissions';
import { getArticleById } from '@/lib/services/articles';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ id: string }>;

export default async function ArticlePreviewPage({
  params,
}: {
  params: RouteParams;
}) {
  await requireRole(['manager', 'admin']);
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) notFound();

  redirect(
    `/help/${article.productCode}/${article.contentType}/${article.slug}`,
  );
}
