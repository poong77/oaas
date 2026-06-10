import type { ReactNode } from 'react';
import Link from 'next/link';
import { Plus, Users as UsersIcon, UserCheck, UserX } from 'lucide-react';
import { listUsers, getUserCounts } from '@/lib/services/users';
import { parsePageSize } from '@/lib/list-params';
import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { UsersListClient } from './_components/users-list-client';
import { UsersFilters } from './_components/users-filters';

export const dynamic = 'force-dynamic';
export const metadata = { title: '사용자 관리 — OA서포트 어드민' };

type SearchParams = Promise<{
  q?: string;
  role?: 'hotelier' | 'manager' | 'admin';
  status?: 'active' | 'inactive' | 'all';
  sortBy?: 'created_at' | 'last_login_at' | 'name' | 'email';
  sortOrder?: 'asc' | 'desc';
  page?: string;
  pageSize?: string;
}>;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Phase 2: 매니저는 admin layout 진입 가능하지만 사용자 관리는 어드민 전용.
  await requireRole(['admin']);
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const requestedPageSize = parsePageSize(params.pageSize);
  const isActive =
    params.status === 'all'
      ? 'all'
      : params.status === 'inactive'
        ? false
        : true;

  const [{ items, total, pageSize }, counts] = await Promise.all([
    listUsers({
      q: params.q,
      role: params.role,
      isActive,
      sortBy: params.sortBy ?? 'created_at',
      sortOrder: params.sortOrder ?? 'desc',
      page,
      pageSize: requestedPageSize,
    }),
    getUserCounts(),
  ]);

  const currentStatus = params.status ?? 'active';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="사용자 관리"
        guideAnchor="accounts"
        description="호텔리어·매니저·어드민 계정을 통합 관리합니다."
        actions={
          <Button asChild>
            <Link href="/admin/users/new">
              <Plus className="h-4 w-4" />사용자 추가
            </Link>
          </Button>
        }
      />

      {/* 요약 통계 — 전역 카운트(필터 무관). 클릭 시 상태 필터 적용 */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="총 사용자"
          value={counts.total}
          icon={<UsersIcon className="h-5 w-5" />}
          tone="slate"
          href="/admin/users?status=all"
          active={currentStatus === 'all'}
        />
        <StatCard
          label="활성"
          value={counts.active}
          icon={<UserCheck className="h-5 w-5" />}
          tone="success"
          href="/admin/users?status=active"
          active={currentStatus === 'active'}
        />
        <StatCard
          label="비활성"
          value={counts.inactive}
          icon={<UserX className="h-5 w-5" />}
          tone="muted"
          href="/admin/users?status=inactive"
          active={currentStatus === 'inactive'}
        />
      </div>

      <UsersFilters initial={params} resultCount={total} />

      <Card className="overflow-hidden">
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
  icon,
  tone,
  href,
  active,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: 'slate' | 'success' | 'muted';
  href: string;
  active: boolean;
}) {
  const toneMap = {
    slate: {
      icon: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
      value: 'text-slate-900 dark:text-slate-100',
      ring: 'ring-slate-300 dark:ring-slate-600',
    },
    success: {
      icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
      value: 'text-emerald-600 dark:text-emerald-400',
      ring: 'ring-emerald-400 dark:ring-emerald-600',
    },
    muted: {
      icon: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
      value: 'text-slate-500 dark:text-slate-400',
      ring: 'ring-slate-300 dark:ring-slate-600',
    },
  }[tone];

  return (
    <Link
      href={href}
      aria-label={`${label} ${value}명 보기`}
      className={`group flex items-center gap-3 rounded-lg border bg-white p-4 transition-all hover:shadow-sm dark:bg-slate-900 ${
        active
          ? `border-transparent ring-2 ${toneMap.ring}`
          : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
      }`}
    >
      <span
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${toneMap.icon}`}
      >
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span className={`text-2xl font-bold leading-tight ${toneMap.value}`}>
          {value.toLocaleString()}
        </span>
      </span>
    </Link>
  );
}
