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
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { getProductCategories } from '@/lib/services/categories';
import { listArticles } from '@/lib/services/articles';
import { getMenuTaxonomyTreeByProduct } from '@/lib/services/master-menu-taxonomies';
import { parsePathParam, pathToKey } from '@/lib/url-query';
import { MasterIcon } from '@/components/master-icon';
import { MenuTreeSidebar } from './_components/menu-tree-sidebar';
import { ProductArticleBrowser } from './_components/product-article-browser';
import { PageContainer } from '@/components/layout/page-container';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ product: string }>;
type SearchParams = Promise<{
  q?: string;
  sortBy?: 'published_at' | 'view_count' | 'helpful';
  sortOrder?: 'asc' | 'desc';
  page?: string;
  /** B1 — menu_taxonomies 트리 노드 선택. 배열 파라미터 ?path=parent&path=child 형태. */
  path?: string | string[];
}>;

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { product } = await params;
  const cats = await getProductCategories();
  const current = cats.find((c) => c.code === product);
  return {
    title: `${current?.label ?? product} 가이드 — OA서포트`,
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
  // B1 — path는 배열 파라미터(?path=A&path=B). 라벨에 '/'가 있어도 깨지지 않는다.
  // @see lib/url-query.ts
  const selectedPath = parsePathParam(sp.path);

  // B1 — 메인 리스트는 selectedPath 필터 + 페이지네이션
  const { items, total, pageSize } = await listArticles({
    productCode: current.code,
    q: sp.q,
    publishedOnly: true,
    selectedPath,
    sortBy,
    sortOrder,
    page,
    pageSize: 10,
  });

  // B1 — 사이드바 트리 + 카운트는 productCode 전체 (필터 없음, max 1000개)
  const [menuTree, allInProduct] = await Promise.all([
    getMenuTaxonomyTreeByProduct(current.code),
    listArticles({
      productCode: current.code,
      publishedOnly: true,
      pageSize: 1000,
    }),
  ]);

  // 누적 카운트: ['예약 관리', '예약 등록'] → '예약 관리': +1, '예약 관리/예약 등록': +1.
  // 키는 pathToKey(라벨에 없는 제어문자 구분자)로 직렬화해 '/' 포함 라벨도 충돌 없음.
  const articleCountsByPath: Record<string, number> = {};
  for (const a of allInProduct.items) {
    if (!a.categoryPath) continue;
    for (let i = 1; i <= a.categoryPath.length; i++) {
      const key = pathToKey(a.categoryPath.slice(0, i));
      articleCountsByPath[key] = (articleCountsByPath[key] ?? 0) + 1;
    }
  }

  const others = categories.filter((c) => c.code !== product);

  return (
    <PageContainer className="py-10 sm:py-14" innerClassName="flex flex-col gap-6">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center text-brand-600 dark:text-brand-300">
              <MasterIcon
                iconName={current.icon}
                iconImageUrl={current.iconImageUrl}
                className="h-5 w-5"
              />
            </span>
            {current.label} 가이드
          </span>
        }
        breadcrumb={
          <Link
            href="/"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />홈
          </Link>
        }
      />

      {/* 좌측 사이드바(검색+카테고리) + 우측 무한스크롤 리스트.
          카테고리 변경 시 selectedPath 기준으로 브라우저 상태를 리셋한다. */}
      <ProductArticleBrowser
        key={pathToKey(selectedPath)}
        productCode={current.code}
        productLabel={current.label}
        selectedPath={selectedPath}
        initialItems={items}
        initialTotal={total}
        pageSize={pageSize}
        sidebarExtra={
          <div className="flex flex-col gap-4">
            {/* B1 — menu_taxonomies 트리 사이드바 (좌측) */}
            <MenuTreeSidebar
              productCode={current.code}
              tree={menuTree}
              selectedPath={selectedPath}
              articleCountsByPath={articleCountsByPath}
              totalCount={allInProduct.total}
            />
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
          </div>
        }
      />
    </PageContainer>
  );
}
