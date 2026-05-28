/**
 * /help/[product] — 제품별 가이드 (SS-02).
 *
 * Phase 3:
 *   - 발행된 아티클 목록 (sortBy: latest/views/helpful)
 *   - 검색 인풋 + 필터
 *   - 페이지네이션 (10건/페이지)
 *   - 사이드바: 같은 제품 카테고리 path 트리 (있을 때만)
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { getProductCategories } from '@/lib/services/categories';
import { listArticles } from '@/lib/services/articles';
import { resolveIcon } from '@/app/_components/home/_icon-map';
import { ProductFilters } from './_components/product-filters';
import { ProductArticleList } from './_components/product-article-list';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ product: string }>;
type SearchParams = Promise<{
  q?: string;
  sortBy?: 'published_at' | 'view_count' | 'helpful';
  sortOrder?: 'asc' | 'desc';
  page?: string;
}>;

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { product } = await params;
  const cats = await getProductCategories();
  const current = cats.find((c) => c.code === product);
  return {
    title: `${current?.label ?? product} 가이드 — OA 통합 AS`,
  };
}

export default async function HelpProductPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: SearchParams;
}) {
  const { product } = await params;
  const sp = await searchParams;
  const categories = await getProductCategories();
  const current = categories.find((c) => c.code === product);
  if (!current) notFound();

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const sortBy = sp.sortBy ?? 'published_at';
  const sortOrder = sp.sortOrder ?? 'desc';

  const { items, total, pageSize } = await listArticles({
    productCode: current.code,
    q: sp.q,
    publishedOnly: true,
    sortBy,
    sortOrder,
    page,
    pageSize: 10,
  });

  // 사이드바 트리: categoryPath 첫 단계 카운트
  const pathCounts: Record<string, number> = {};
  for (const a of items) {
    const root = a.categoryPath?.[0];
    if (root) pathCounts[root] = (pathCounts[root] ?? 0) + 1;
  }

  const Icon = resolveIcon(current.icon);
  const others = categories.filter((c) => c.code !== product);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
              <Icon className="h-5 w-5" />
            </span>
            {current.label} 가이드
          </span>
        }
        description={`${current.label} 사용을 위한 핸드북·체크리스트·점검 절차 (총 ${total}건)`}
        breadcrumb={
          <Link
            href="/help"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            제품별 가이드
          </Link>
        }
      />

      <ProductFilters initial={sp} productCode={current.code} />

      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <Card>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<BookOpen className="h-6 w-6" />}
                  title={
                    sp.q
                      ? '검색 결과가 없습니다'
                      : `${current.label} 아티클이 아직 없습니다`
                  }
                  description={
                    sp.q
                      ? '다른 키워드로 시도하거나 문의로 접수해주세요.'
                      : '곧 핸드북이 추가될 예정입니다. 급한 문의는 아래 버튼을 이용하세요.'
                  }
                  action={
                    <Button asChild size="sm">
                      <Link href={`/tickets/new?product=${current.code}`}>
                        {current.label} 문의 접수
                      </Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <ProductArticleList
                items={items}
                productCode={current.code}
                total={total}
                page={page}
                pageSize={pageSize}
              />
            )}
          </CardContent>
        </Card>

        <aside className="hidden flex-col gap-4 lg:flex">
          {Object.keys(pathCounts).length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  카테고리
                </h3>
                <ul className="flex flex-col gap-1 text-sm">
                  {Object.entries(pathCounts)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([root, count]) => (
                      <li
                        key={root}
                        className="flex items-center justify-between rounded px-2 py-1 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <span>{root}</span>
                        <span className="text-xs text-slate-400 tabular-nums">
                          {count}
                        </span>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                다른 제품
              </h3>
              <ul className="flex flex-col gap-1.5 text-sm">
                {others.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/help/${o.code}`}
                      className="block rounded px-2 py-1 text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-brand-950/40 dark:hover:text-brand-300"
                    >
                      {o.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-medium text-slate-700 dark:text-slate-200">
              찾는 내용이 없으신가요?
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              기존 help.oapms.com에 같은 주제가 있을 수 있습니다.
            </p>
          </div>
          <a
            href="https://help.oapms.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 self-start rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-700"
          >
            help.oapms.com 열기
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
