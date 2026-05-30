/**
 * /admin/articles/[id] — 아티클 편집 (SS-06).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { requireRole } from '@/lib/permissions';
import { getArticleById } from '@/lib/services/articles';
import { getProductCategories } from '@/lib/services/categories';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArticleEditor } from '../_components/article-editor';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { id } = await params;
  const article = await getArticleById(id);
  return {
    title: article
      ? `${article.title} 편집 — OA 통합 AS 어드민`
      : '아티클 편집 — OA 통합 AS 어드민',
  };
}

export default async function EditArticlePage({
  params,
}: {
  params: RouteParams;
}) {
  await requireRole(['manager', 'admin']);
  const { id } = await params;
  const [article, categories] = await Promise.all([
    getArticleById(id),
    getProductCategories(),
  ]);
  if (!article) notFound();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            아티클 편집
            {article.status === 'published' ? (
              <Badge tone="success">발행됨</Badge>
            ) : (
              <Badge tone="warn">Draft</Badge>
            )}
            {!article.isActive && <Badge tone="danger">비활성</Badge>}
          </span>
        }
        description={`/${article.slug}`}
        breadcrumb={
          <Link
            href="/admin/articles"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            아티클 관리
          </Link>
        }
        actions={
          article.status === 'published' ? (
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/help/${article.productCode}/${article.contentType}/${article.slug}`}
                target="_blank"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                공개 페이지 보기
              </Link>
            </Button>
          ) : null
        }
      />
      <ArticleEditor
        categories={categories}
        mode="edit"
        initial={{
          id: article.id,
          productCode: article.productCode,
          contentType: article.contentType,
          categoryPath: article.categoryPath ?? null,
          slug: article.slug,
          title: article.title,
          summary: article.summary ?? '',
          summary30s: article.summary30s ?? '',
          keywords: article.keywords ?? [],
          bodyMarkdown: article.bodyMarkdown,
          relatedSlugs: article.relatedSlugs ?? [],
          relatedArticleIds: article.relatedArticleIds ?? null,
          isPublished: article.status === 'published',
        }}
      />
    </div>
  );
}
