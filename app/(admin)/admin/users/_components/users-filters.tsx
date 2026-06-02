'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export function UsersFilters({
  initial,
}: {
  initial: {
    q?: string;
    role?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  };
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

  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-900/30 sm:grid-cols-2 lg:grid-cols-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters({ q });
        }}
        className="relative lg:col-span-2"
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름·아이디·이메일·연락처 검색"
          className="pl-8 pr-8"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              applyFilters({ q: undefined });
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="검색어 지우기"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      <Select
        value={initial.role ?? ''}
        onChange={(e) => applyFilters({ role: e.target.value || undefined })}
        aria-label="권한 필터"
      >
        <option value="">전체 권한</option>
        <option value="hotelier">호텔리어</option>
        <option value="manager">매니저</option>
        <option value="admin">어드민</option>
      </Select>

      <Select
        value={initial.status ?? 'active'}
        onChange={(e) => applyFilters({ status: e.target.value })}
        aria-label="상태 필터"
      >
        <option value="active">활성</option>
        <option value="inactive">비활성</option>
        <option value="all">전체</option>
      </Select>

      <Select
        value={`${initial.sortBy ?? 'created_at'}:${initial.sortOrder ?? 'desc'}`}
        onChange={(e) => {
          const [sortBy, sortOrder] = e.target.value.split(':');
          applyFilters({ sortBy, sortOrder });
        }}
        aria-label="정렬"
      >
        <option value="created_at:desc">가입일 최신순</option>
        <option value="created_at:asc">가입일 오래된순</option>
        <option value="last_login_at:desc">최근 로그인순</option>
        <option value="name:asc">이름 가나다순</option>
        <option value="email:asc">이메일 순</option>
      </Select>

      {pending && (
        <Button type="button" variant="ghost" size="sm" disabled className="sm:col-span-2 lg:col-span-5">
          적용 중...
        </Button>
      )}
    </div>
  );
}
