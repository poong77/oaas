/**
 * /admin/checklists — 체크리스트 관리 (SF-04).
 *
 * 매니저+어드민. 리스트 + 통계.
 */

import Link from 'next/link';
import { ListChecks, Plus } from 'lucide-react';
import { listChecklists } from '@/lib/services/checklists';
import { getProductCategories } from '@/lib/services/categories';
import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { buildProductMap } from '@/components/faqs/category-maps';
import { ChecklistsFilters } from './_components/checklists-filters';
import { ChecklistsListClient } from './_components/checklists-list-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: '체크리스트 관리 — OA 통합 AS 어드민' };

type SearchParams = Promise<{
  q?: string;
  productCode?: string;
  active?: 'active' | 'inactive' | 'all';
  sortBy?: 'sort_order' | 'view_count' | 'resolved' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
  page?: string;
}>;

export default async function AdminChecklistsPage({
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

  const [{ items, total, pageSize }, productCategories] = await Promise.all([
    listChecklists({
      q: sp.q,
      productCode: sp.productCode,
      isActive,
      sortBy: sp.sortBy ?? 'sort_order',
      sortOrder: sp.sortOrder ?? 'asc',
      page,
      pageSize: 20,
    }),
    getProductCategories(),
  ]);

  const productMap = buildProductMap(productCategories);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="체크리스트 관리"
        description={`전체 ${total}건. 단계별 진단으로 셀프 픽스를 돕는 트러블슈팅을 관리합니다.`}
        actions={
          <Button asChild>
            <Link href="/admin/checklists/new">
              <Plus className="h-4 w-4" />새 체크리스트
            </Link>
          </Button>
        }
      />

      <ChecklistsFilters initial={sp} productCategories={productCategories} />

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<ListChecks className="h-6 w-6" />}
                title="조건에 맞는 체크리스트가 없습니다"
                description="필터를 조정하거나 새 체크리스트를 작성하세요."
                action={
                  <Button asChild size="sm">
                    <Link href="/admin/checklists/new">새 체크리스트</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <ChecklistsListClient
              items={items}
              productMap={productMap}
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
