/**
 * /admin/notices — 공지 관리 (NT-01, Phase 7).
 *
 * 매니저+어드민. 검색·필터·정렬·페이징. 발행/비활성/편집.
 * 패턴은 /admin/articles와 동일.
 */

import Link from 'next/link';
import { Megaphone, Plus } from 'lucide-react';
import { listNotices } from '@/lib/services/notices';
import { getProductCategories } from '@/lib/services/categories';
import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import type { NoticeKind } from '@/db/schema';
import { NoticesAdminFilters } from './_components/notices-admin-filters';
import { NoticesListClient } from './_components/notices-list-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: '공지 관리 — OA 통합 AS 어드민' };

type SearchParams = Promise<{
  q?: string;
  kind?: NoticeKind | 'all';
  productCode?: string;
  status?: 'published' | 'draft' | 'all';
  active?: 'active' | 'inactive' | 'all';
  sortBy?: 'published_at' | 'view_count' | 'updated_at' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  page?: string;
}>;

export default async function AdminNoticesPage({
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
    sp.active === 'all' ? 'all' : sp.active === 'inactive' ? false : true;
  const kind = sp.kind && sp.kind !== 'all' ? sp.kind : undefined;

  const [{ items, total, pageSize }, categories] = await Promise.all([
    listNotices({
      q: sp.q,
      kind,
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

  const publishedCount = items.filter((n) => n.publishedAt).length;
  const draftCount = items.filter((n) => !n.publishedAt).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="공지 관리"
        description={`전체 ${total}건 (${pageSize}건/페이지). 공지·릴리즈노트·장애 공지를 통합 관리합니다.`}
        actions={
          <Button asChild>
            <Link href="/admin/notices/new">
              <Plus className="h-4 w-4" />
              새 공지
            </Link>
          </Button>
        }
      />

      <NoticesAdminFilters initial={sp} categories={categories} />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="이 페이지" value={items.length} />
        <StatCard label="발행" value={publishedCount} tone="success" />
        <StatCard label="Draft" value={draftCount} tone="warn" />
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Megaphone className="h-6 w-6" />}
                title="조건에 맞는 공지가 없습니다"
                description="필터를 조정하거나 새 공지를 작성하세요."
                action={
                  <Button asChild size="sm">
                    <Link href="/admin/notices/new">새 공지</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <NoticesListClient
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
