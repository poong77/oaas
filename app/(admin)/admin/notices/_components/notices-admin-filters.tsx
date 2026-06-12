'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { ProductCategoryView } from '@/lib/services/categories';

export function NoticesAdminFilters({
  initial,
  categories,
}: {
  initial: {
    q?: string;
    kind?: string;
    productCode?: string;
    status?: string;
    active?: string;
    sortBy?: string;
    sortOrder?: string;
  };
  categories: ProductCategoryView[];
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
      router.push(`/admin/notices?${next.toString()}`),
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    applyFilters({ q });
  }

  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-900/30 sm:grid-cols-2 lg:grid-cols-6">
      <form onSubmit={onSubmit} className="relative lg:col-span-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="제목/본문 검색"
          className="pl-8 pr-8"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              applyFilters({ q: undefined });
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            aria-label="검색어 지우기"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      <Select
        value={initial.kind ?? 'all'}
        onChange={(e) => applyFilters({ kind: e.target.value })}
        aria-label="종류 필터"
      >
        <option value="all">모든 종류</option>
        <option value="notice">공지</option>
        <option value="release">릴리즈 노트</option>
        <option value="incident">장애 공지</option>
      </Select>

      <Select
        value={initial.productCode ?? ''}
        onChange={(e) =>
          applyFilters({ productCode: e.target.value || undefined })
        }
        aria-label="제품 필터"
      >
        <option value="">모든 제품</option>
        {categories.map((c) => (
          <option key={c.id} value={c.code}>
            {c.label}
          </option>
        ))}
      </Select>

      <Select
        value={initial.status ?? 'all'}
        onChange={(e) => applyFilters({ status: e.target.value })}
        aria-label="발행 상태"
      >
        <option value="all">발행/Draft 모두</option>
        <option value="published">발행만</option>
        <option value="draft">Draft만</option>
      </Select>

      <Select
        value={`${initial.sortBy ?? 'published_at'}:${initial.sortOrder ?? 'desc'}`}
        onChange={(e) => {
          const [sortBy, sortOrder] = e.target.value.split(':');
          applyFilters({ sortBy, sortOrder });
        }}
        aria-label="정렬"
      >
        <option value="published_at:desc">최근 발행순</option>
        <option value="updated_at:desc">최근 수정순</option>
        <option value="view_count:desc">조회수 많은순</option>
        <option value="created_at:desc">최근 작성순</option>
      </Select>

      <Select
        value={initial.active ?? 'active'}
        onChange={(e) => applyFilters({ active: e.target.value })}
        aria-label="활성 상태"
        className="sm:col-span-2 lg:col-span-6"
      >
        <option value="active">활성만</option>
        <option value="inactive">비활성만</option>
        <option value="all">전체</option>
      </Select>

      {pending && (
        <span className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2 lg:col-span-6">
          적용 중...
        </span>
      )}
    </div>
  );
}
