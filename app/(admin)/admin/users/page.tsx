import Link from 'next/link';
import { Plus, Users as UsersIcon } from 'lucide-react';
import { listUsers } from '@/lib/services/users';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { UsersListClient } from './_components/users-list-client';
import { UsersFilters } from './_components/users-filters';

export const dynamic = 'force-dynamic';
export const metadata = { title: '사용자 관리 — OA 통합 AS 어드민' };

type SearchParams = Promise<{
  q?: string;
  role?: 'hotelier' | 'manager' | 'admin';
  status?: 'active' | 'inactive' | 'all';
  sortBy?: 'created_at' | 'last_login_at' | 'name' | 'email';
  sortOrder?: 'asc' | 'desc';
  page?: string;
}>;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const isActive =
    params.status === 'all'
      ? 'all'
      : params.status === 'inactive'
        ? false
        : true;

  const { items, total, pageSize } = await listUsers({
    q: params.q,
    role: params.role,
    isActive,
    sortBy: params.sortBy ?? 'created_at',
    sortOrder: params.sortOrder ?? 'desc',
    page,
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="사용자 관리"
        description={`전체 ${total}명 (${pageSize}명/페이지). 호텔리어·매니저·어드민 계정을 통합 관리합니다.`}
        actions={
          <Button asChild>
            <Link href="/admin/users/new">
              <Plus className="h-4 w-4" />사용자 추가
            </Link>
          </Button>
        }
      />

      <UsersFilters initial={params} />

      {/* 요약 통계 */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="총 사용자" value={total} />
        <StatCard label="활성" value={items.filter((u) => u.isActive).length} tone="success" />
        <StatCard label="비활성" value={items.filter((u) => !u.isActive).length} tone="slate" />
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<UsersIcon className="h-6 w-6" />}
                title="검색 결과가 없습니다"
                description="필터를 조정하거나 새 사용자를 추가해보세요."
                action={
                  <Button asChild size="sm">
                    <Link href="/admin/users/new">사용자 추가</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <UsersListClient
              items={items}
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
  tone?: 'slate' | 'success';
}) {
  const valueClass =
    tone === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
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
