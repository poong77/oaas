/**
 * /admin/articles — 아티클 관리 (SS-06).
 *
 * 매니저+어드민. 검색·필터·정렬·페이징. 발행/비활성/편집.
 */

import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { listArticles } from '@/lib/services/articles';
import { getProductCategories } from '@/lib/services/categories';
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

  const [{ items, total, pageSize }, categories] = await Promise.all([
    listArticles({
      q: sp.q,
      productCode: sp.productCode,
      publishedOnly,
      isActive,
      sortBy: sp.sortBy ?? 'updated_at',
      sortOrder: sp.sortOrder ?? 'desc',
      page,
      pageSize: 20,
    }),
    getProductCategories(),
  ]);

  const publishedCount = items.filter((a) => a.publishedAt).length;
  const draftCount = items.filter((a) => !a.publishedAt).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="아티클 관리"
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

      <ArticlesFilters initial={sp} categories={categories} />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="전체 (이 페이지)" value={items.length} />
        <StatCard
          label="발행"
          value={publishedCount}
          tone="success"
        />
        <StatCard label="Draft" value={draftCount} tone="warn" />
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
