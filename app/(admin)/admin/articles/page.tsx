/**
 * /admin/articles — 아티클 관리 (SS-06).
 *
 * 매니저+어드민. 검색·필터·정렬·페이징. 발행/비활성/편집.
 */

import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { listArticles } from '@/lib/services/articles';
import { getProductCategories } from '@/lib/services/categories';
import { listMenuTaxonomyFlat } from '@/lib/services/master-menu-taxonomies';
import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ArticlesFilters } from './_components/articles-filters';
import { ArticlesListClient } from './_components/articles-list-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: '아티클 관리 — OA 통합 AS 어드민' };

type SearchParams = Promise<{
  q?: string;
  productCode?: string;
  /** 메뉴구분(중분류>소분류) 경로 — 라벨을 '|'로 join. 제품 선택 시에만 유효. */
  menuPath?: string;
  status?: 'published' | 'draft' | 'all';
  active?: 'active' | 'inactive' | 'all';
  sortBy?: 'published_at' | 'view_count' | 'helpful' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
  page?: string;
}>;

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(['manager', 'admin']);
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const publishedOnly =
    sp.status === 'published'
      ? true
      : sp.status === 'draft'
        ? false
        : undefined;
  const isActive =
    sp.active === 'all'
      ? 'all'
      : sp.active === 'inactive'
        ? false
        : true;

  // 메뉴구분(selectedPath)은 제품이 선택된 경우에만 유효 (메뉴 트리가 제품 종속).
  const selectedPath =
    sp.productCode && sp.menuPath
      ? sp.menuPath.split('|').filter(Boolean)
      : undefined;

  const [
    { items, total, totalPublished, totalDraft, pageSize },
    categories,
    menuNodes,
  ] =
    await Promise.all([
      listArticles({
        q: sp.q,
        productCode: sp.productCode,
        selectedPath,
        publishedOnly,
        isActive,
        sortBy: sp.sortBy ?? 'updated_at',
        sortOrder: sp.sortOrder ?? 'desc',
        page,
        pageSize: 20,
      }),
      getProductCategories(),
      // 제품 선택 시 그 제품의 메뉴 트리(평탄화)만 로드 — 연동 드롭다운용.
      sp.productCode
        ? listMenuTaxonomyFlat({ productCode: sp.productCode })
        : Promise.resolve([]),
    ]);

  // 메뉴구분 드롭다운 옵션: pathLabels를 '|'로 join한 value + ' › '로 표시.
  const menuOptions = menuNodes.map((n) => ({
    value: n.pathLabels.join('|'),
    label: n.pathLabels.join(' › '),
    depth: n.depth,
  }));


  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="아티클 관리"
        guideAnchor="articles"
        description={`전체 ${total}건 (${pageSize}건/페이지). 호텔리어가 보는 핸드북 콘텐츠를 관리합니다.`}
        actions={
          <Button asChild>
            <Link href="/admin/articles/new">
              <Plus className="h-4 w-4" />
              새 아티클
            </Link>
          </Button>
        }
      />

      <ArticlesFilters
        initial={sp}
        categories={categories}
        menuOptions={menuOptions}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="전체" value={total} />
        <StatCard label="발행" value={totalPublished} tone="success" />
        <StatCard label="Draft" value={totalDraft} tone="warn" />
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<FileText className="h-6 w-6" />}
                title="조건에 맞는 아티클이 없습니다"
                description="필터를 조정하거나 새 아티클을 작성하세요."
                action={
                  <Button asChild size="sm">
                    <Link href="/admin/articles/new">새 아티클</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <ArticlesListClient
              items={items}
              categories={categories}
              total={total}
              page={page}
              pageSize={pageSize}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number;
  tone?: 'slate' | 'success' | 'warn';
}) {
  const valueClass =
    tone === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-slate-900 dark:text-slate-100';
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`text-2xl font-bold ${valueClass}`}>{value}</span>
      </CardContent>
    </Card>
  );
}
