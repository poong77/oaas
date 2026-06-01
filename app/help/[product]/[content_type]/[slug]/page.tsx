/**
 * /help/[product]/[content_type]/[slug] — 아티클 상세 (SS-03, v1.1 신규 URL).
 *
 * 구성 (Plan §2 + Design §5.1):
 *   - 헤더 (제목 + 메타: 발행일/작성자/조회수/도움됨%)
 *   - 30초 요약 카드 (있을 때만)
 *   - 본문 마크다운 + TOC (sticky 우측 사이드바, 모바일은 상단 collapsible)
 *   - 도움됨 위젯
 *   - 관련 문서 카드 3~5건
 *   - 공유/인쇄/링크 버튼
 *   - view_count 1회 증가 (client effect)
 *
 * v1.1 변경:
 *   - URL에 content_type 포함 (Plan Q-5)
 *   - status='published' 명시 (Plan Q-4)
 *   - 메타 표시에 contentType + keywords 칩 추가
 */

import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  Eye,
  Pencil,
  ThumbsUp,
  User as UserIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MarkdownView } from '@/components/articles/markdown-view';
import { ArticleToc } from '@/components/articles/article-toc';
import { ArticleFeedbackWidget } from '@/components/articles/article-feedback-widget';
import { ArticleShareBar } from '@/components/articles/article-share-bar';
import { ArticleViewTracker } from '@/components/articles/article-view-tracker';
import {
  getArticleBySlug,
  getArticleBySlugAndType,
  getRelatedArticles,
} from '@/lib/services/articles';
import { getCurrentUser } from '@/lib/permissions';
import { getProductCategories } from '@/lib/services/categories';
import { formatDateKst } from '@/lib/business-hours/format';
import { CONTENT_TYPE_LABEL } from '@/lib/articles/zod-schemas';
import type { ArticleContentType } from '@/db/schema';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{
  product: string;
  content_type: string;
  slug: string;
}>;

const VALID_CONTENT_TYPES: ArticleContentType[] = [
  'howto',
  'feature',
  'troubleshoot',
];

function isValidContentType(v: string): v is ArticleContentType {
  return (VALID_CONTENT_TYPES as string[]).includes(v);
}

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: '도움말 — OA 통합 AS' };
  return {
    title: `${article.title} — OA 통합 AS`,
    description: article.summary ?? article.summary30s ?? undefined,
  };
}

export default async function HelpArticlePage({
  params,
}: {
  params: RouteParams;
}) {
  const { product, content_type, slug } = await params;

  if (!isValidContentType(content_type)) {
    // 알 수 없는 content_type — 안전망. slug로 조회해서 정식 URL로 redirect 시도
    const fallback = await getArticleBySlug(slug);
    if (fallback) {
      permanentRedirect(
        `/help/${fallback.productCode}/${fallback.contentType}/${fallback.slug}`,
      );
    }
    notFound();
  }

  const user = await getCurrentUser();
  const canPreview = user?.role === 'manager' || user?.role === 'admin';

  const article = await getArticleBySlugAndType(product, content_type, slug, {
    includeUnpublished: canPreview,
  });

  if (!article) {
    // 1) slug로 조회해서 product/content_type 불일치인지 확인 (이 경우 정식 URL로 redirect)
    const fallback = await getArticleBySlug(slug, {
      includeUnpublished: canPreview,
    });
    if (fallback) {
      permanentRedirect(
        `/help/${fallback.productCode}/${fallback.contentType}/${fallback.slug}`,
      );
    }
    notFound();
  }

  if (!canPreview && article.status !== 'published') notFound();

  const [related, productCats] = await Promise.all([
    getRelatedArticles(
      article.relatedArticleIds,
      article.productCode,
      4,
    ),
    getProductCategories(),
  ]);
  const productLabel =
    productCats.find((c) => c.code === product)?.label ?? product;

  const helpfulTotal = article.helpfulYes + article.helpfulNo;
  const helpfulPct =
    helpfulTotal > 0
      ? Math.round((article.helpfulYes / helpfulTotal) * 100)
      : null;

  const summaryText = article.summary ?? article.summary30s;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <ArticleViewTracker articleId={article.id} />

      <div className="flex flex-col gap-3">
        <Link
          href={`/help/${product}`}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:underline"
        >
          <ArrowLeft className="h-3 w-3" />
          {productLabel} 가이드
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand" className="uppercase">
            {productLabel}
          </Badge>
          <Badge
            tone={
              article.contentType === 'howto'
                ? 'brand'
                : article.contentType === 'feature'
                  ? 'success'
                  : 'warn'
            }
          >
            {CONTENT_TYPE_LABEL[article.contentType]}
          </Badge>
          {article.categoryPath?.map((seg, i) => (
            <Badge key={`${seg}-${i}`} tone="slate">
              {seg}
            </Badge>
          ))}
          {article.status !== 'published' && (
            <Badge tone="warn">DRAFT (미리보기)</Badge>
          )}
          {!article.isActive && <Badge tone="danger">비활성</Badge>}
        </div>

        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {article.title}
        </h1>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          {article.publishedAt && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatDateKst(article.publishedAt)} 발행
            </span>
          )}
          {article.authorName && (
            <span className="inline-flex items-center gap-1">
              <UserIcon className="h-3 w-3" />
              {article.authorName}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3 w-3" />
            조회 {article.viewCount.toLocaleString()}
          </span>
          {helpfulPct !== null && (
            <span className="inline-flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              도움됨 {helpfulPct}% ({helpfulTotal}명)
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <ArticleShareBar title={article.title} />
          {canPreview && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/articles/${article.id}`}>
                <Pencil className="h-3.5 w-3.5" />
                관리자 편집
              </Link>
            </Button>
          )}
        </div>
      </div>

      <ArticleToc toc={article.toc ?? []} variant="mobile" />

      <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
        <article className="flex flex-col gap-5">
          {summaryText && (
            <Card className="border-brand-200 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/40">
              <CardContent className="flex flex-col gap-1 p-4 sm:p-5">
                <span className="text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                  30초 요약
                </span>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 sm:text-base">
                  {summaryText}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-5 sm:p-7">
              <MarkdownView source={article.bodyMarkdown} />
            </CardContent>
          </Card>

          <ArticleFeedbackWidget
            articleId={article.id}
            initialYes={article.helpfulYes}
            initialNo={article.helpfulNo}
            isLoggedIn={Boolean(user)}
          />

          {related.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-bold tracking-tight">
                관련 문서
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {related
                  .filter((r) => r.id !== article.id)
                  .slice(0, 4)
                  .map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/help/${r.productCode}/${r.contentType}/${r.slug}`}
                        className="flex h-full flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-700"
                      >
                        <div className="flex items-center gap-2">
                          <Badge tone="brand" className="uppercase">
                            {r.productCode}
                          </Badge>
                          <Badge
                            tone={
                              r.contentType === 'howto'
                                ? 'brand'
                                : r.contentType === 'feature'
                                  ? 'success'
                                  : 'warn'
                            }
                            className="text-[10px]"
                          >
                            {CONTENT_TYPE_LABEL[r.contentType]}
                          </Badge>
                        </div>
                        <span className="line-clamp-2 text-sm font-semibold">
                          {r.title}
                        </span>
                        {(r.summary ?? r.summary30s) && (
                          <span className="line-clamp-1 text-xs text-slate-500">
                            {r.summary ?? r.summary30s}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </article>

        <ArticleToc toc={article.toc ?? []} variant="sidebar" />
      </div>
    </div>
  );
}

