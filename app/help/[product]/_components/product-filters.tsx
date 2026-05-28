'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export function ProductFilters({
  initial,
  productCode,
}: {
  initial: {
    q?: string;
    sortBy?: string;
    sortOrder?: string;
  };
  productCode: string;
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
    next.delete('page');
    startTransition(() =>
      router.push(`/help/${productCode}?${next.toString()}`),
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    applyFilters({ q });
  }

  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-900/30 sm:grid-cols-2 lg:grid-cols-4">
      <form onSubmit={onSubmit} className="relative lg:col-span-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이 제품 안에서 검색"
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
        value={`${initial.sortBy ?? 'published_at'}:${initial.sortOrder ?? 'desc'}`}
        onChange={(e) => {
          const [sortBy, sortOrder] = e.target.value.split(':');
          applyFilters({ sortBy, sortOrder });
        }}
        aria-label="정렬"
      >
        <option value="published_at:desc">최신 발행순</option>
        <option value="published_at:asc">오래된 발행순</option>
        <option value="view_count:desc">조회수 많은순</option>
        <option value="helpful:desc">도움됨 많은순</option>
      </Select>

      {pending && (
        <span className="text-xs text-slate-500 sm:col-span-2 lg:col-span-4">
          적용 중...
        </span>
      )}
    </div>
  );
}
