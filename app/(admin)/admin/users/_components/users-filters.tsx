'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Search, X, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export function UsersFilters({
  initial,
  resultCount,
}: {
  initial: {
    q?: string;
    role?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  };
  resultCount: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(initial.q ?? '');
  const [pending, startTransition] = useTransition();

  function applyFilters(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, v);
    }
    next.delete('page'); // 필터 변경 시 1페이지로
    startTransition(() => router.push(`/admin/users?${next.toString()}`));
  }

  const status = initial.status ?? 'active';
  const role = initial.role ?? '';
  const sort = `${initial.sortBy ?? 'created_at'}:${initial.sortOrder ?? 'desc'}`;
  const hasActiveFilters =
    !!initial.q || role !== '' || status !== 'active' || sort !== 'created_at:desc';

  function resetAll() {
    setQ('');
    startTransition(() => router.push('/admin/users'));
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-12">
        {/* 검색 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters({ q });
          }}
          className="relative sm:col-span-2 lg:col-span-5"
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름·아이디·이메일·연락처·호텔명 검색"
            className="pl-8 pr-8"
            aria-label="사용자 검색"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ('');
                applyFilters({ q: undefined });
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              aria-label="검색어 지우기"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <Select
          value={role}
          onChange={(e) => applyFilters({ role: e.target.value || undefined })}
          aria-label="권한 필터"
          className="lg:col-span-2"
        >
          <option value="">전체 권한</option>
          <option value="hotelier">호텔리어</option>
          <option value="manager">매니저</option>
          <option value="admin">어드민</option>
        </Select>

        <Select
          value={status}
          onChange={(e) => applyFilters({ status: e.target.value })}
          aria-label="상태 필터"
          className="lg:col-span-2"
        >
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
          <option value="all">전체 상태</option>
        </Select>

        <Select
          value={sort}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split(':');
            applyFilters({ sortBy, sortOrder });
          }}
          aria-label="정렬"
          className="lg:col-span-3"
        >
          <option value="created_at:desc">가입일 최신순</option>
          <option value="created_at:asc">가입일 오래된순</option>
          <option value="last_login_at:desc">최근 로그인순</option>
          <option value="name:asc">이름 가나다순</option>
          <option value="email:asc">이메일 순</option>
        </Select>
      </div>

      {/* 결과 요약 바 */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800">
        <span className="inline-flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {pending ? (
            <span className="animate-pulse">불러오는 중…</span>
          ) : (
            <>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {resultCount.toLocaleString()}
              </span>
              명 검색됨
            </>
          )}
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            필터 초기화
          </button>
        )}
      </div>
    </div>
  );
}
