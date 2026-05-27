'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { User, UserRole } from '@/db/schema';

type ListItem = User & { hotelName: string | null };

export function UsersListClient({
  items,
  total,
  page,
  pageSize,
}: {
  items: ListItem[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  function go(p: number) {
    const next = new URLSearchParams(sp.toString());
    next.set('page', String(p));
    router.push(`/admin/users?${next.toString()}`);
  }

  return (
    <>
      {/* 데스크탑 테이블 */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">호텔</th>
              <th className="px-3 py-2 text-left">이름·직책</th>
              <th className="px-3 py-2 text-left">이메일·연락처</th>
              <th className="px-3 py-2 text-left">권한</th>
              <th className="px-3 py-2 text-left">가입일</th>
              <th className="px-3 py-2 text-left">최근 로그인</th>
              <th className="px-3 py-2 text-left">상태</th>
              <th className="px-3 py-2 text-right">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((u) => (
              <tr key={u.id} className={u.isActive ? '' : 'opacity-60'}>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                  {u.hotelName ?? <span className="text-slate-400">-</span>}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{u.name}</div>
                  {u.title && (
                    <div className="text-xs text-slate-500">{u.title}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  <div>{u.email}</div>
                  <div className="text-xs text-slate-500">{u.phone ?? '-'}</div>
                </td>
                <td className="px-3 py-2"><RoleBadge role={u.role} /></td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {formatDate(u.createdAt)}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {u.lastLoginAt ? formatDate(u.lastLoginAt) : '미접속'}
                </td>
                <td className="px-3 py-2">
                  {u.isActive ? (
                    <Badge tone="success">활성</Badge>
                  ) : (
                    <Badge tone="slate">비활성</Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/admin/users/${u.id}`}>
                      <Pencil className="h-3.5 w-3.5" />편집
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드뷰 */}
      <div className="flex flex-col gap-2 p-3 md:hidden">
        {items.map((u) => (
          <Link
            key={u.id}
            href={`/admin/users/${u.id}`}
            className={`rounded-md border border-slate-200 p-3 transition-colors hover:border-brand-400 dark:border-slate-800 ${u.isActive ? '' : 'opacity-60'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{u.name}</div>
                <div className="text-xs text-slate-500">
                  {u.hotelName ?? '소속 없음'} · {u.title ?? '직책 없음'}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <RoleBadge role={u.role} />
                {u.isActive ? (
                  <Badge tone="success">활성</Badge>
                ) : (
                  <Badge tone="slate">비활성</Badge>
                )}
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              <div>{u.email}</div>
              <div>{u.phone ?? '-'}</div>
              <div className="mt-1 text-slate-400">
                가입 {formatDate(u.createdAt)} · 최근접속{' '}
                {u.lastLoginAt ? formatDate(u.lastLoginAt) : '미접속'}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* 페이지네이션 */}
      {lastPage > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-3 py-3 text-sm dark:border-slate-800">
          <div className="text-xs text-slate-500">
            {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} / {total}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => go(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />이전
            </Button>
            <span className="px-2 text-sm font-medium">
              {page} / {lastPage}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= lastPage}
              onClick={() => go(page + 1)}
            >
              다음<ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const tone = role === 'admin' ? 'danger' : role === 'manager' ? 'warn' : 'brand';
  const label = role === 'admin' ? '어드민' : role === 'manager' ? '매니저' : '호텔리어';
  return <Badge tone={tone}>{label}</Badge>;
}

function formatDate(d: Date | string | null) {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '-';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
