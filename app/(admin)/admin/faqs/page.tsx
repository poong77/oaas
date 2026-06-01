/**
 * /admin/faqs — FAQ 관리 (SF-04).
 *
 * 매니저+어드민. 검색·필터·정렬·페이징, 모바일 카드뷰.
 */

import Link from 'next/link';
import { Plus, HelpCircle } from 'lucide-react';
import { listFaqs, getFaqCounts } from '@/lib/services/faqs';
import {
  getCategoriesByType,
  getProductCategories,
} from '@/lib/services/categories';
import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  buildIssueTypeMap,
  buildProductMap,
} from '@/components/faqs/category-maps';
import { FaqsFilters } from './_components/faqs-filters';
import { FaqsListClient } from './_components/faqs-list-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'FAQ 관리 — OA 통합 AS 어드민' };

type SearchParams = Promise<{
  q?: string;
  productCode?: string;
  issueType?: string;
  active?: 'active' | 'inactive' | 'all';
  sortBy?: 'sort_order' | 'view_count' | 'helpful' | 'updated_at' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  page?: string;
}>;

export default async function AdminFaqsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(['manager', 'admin']);
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const isActive =
    sp.active === 'all'
      ? 'all'
      : sp.active === 'inactive'
        ? false
        : true;

  const countFilter = {
    q: sp.q,
    productCode: sp.productCode,
    issueType: sp.issueType,
  } as const;

  const [
    { items, total, pageSize },
    counts,
    productCategories,
    issueTypeCategories,
  ] = await Promise.all([
    listFaqs({
      ...countFilter,
      isActive,
      sortBy: sp.sortBy ?? 'sort_order',
      sortOrder: sp.sortOrder ?? 'asc',
      page,
      pageSize: 20,
    }),
    getFaqCounts(countFilter),
    getProductCategories(),
    getCategoriesByType('issue_type'),
  ]);

  const productMap = buildProductMap(productCategories);
  const issueTypeMap = buildIssueTypeMap(
    issueTypeCategories.map((c) => ({ code: c.code, label: c.label })),
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="FAQ 관리"
        description={`전체 ${total}건. 호텔리어가 보는 자주 묻는 질문을 관리합니다.`}
        actions={
          <Button asChild>
            <Link href="/admin/faqs/new">
              <Plus className="h-4 w-4" />새 FAQ
            </Link>
          </Button>
        }
      />

      <FaqsFilters
        initial={sp}
        productCategories={productCategories}
        issueTypeCategories={issueTypeCategories.map((c) => ({
          code: c.code,
          label: c.label,
        }))}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="전체" value={counts.total} />
        <StatCard label="활성" value={counts.active} tone="success" />
        <StatCard label="비활성" value={counts.inactive} tone="warn" />
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<HelpCircle className="h-6 w-6" />}
                title="조건에 맞는 FAQ가 없습니다"
                description="필터를 조정하거나 새 FAQ를 작성하세요."
                action={
                  <Button asChild size="sm">
                    <Link href="/admin/faqs/new">새 FAQ</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <FaqsListClient
              items={items}
              productMap={productMap}
              issueTypeMap={issueTypeMap}
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
