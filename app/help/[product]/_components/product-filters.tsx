'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toQueryString } from '@/lib/url-query';

export function ProductFilters({
  initial,
  productCode,
  only,
}: {
  initial: {
    q?: string;
    sortBy?: string;
    sortOrder?: string;
  };
  productCode: string;
  /** 'search' = 검색창만, 'sort' = 정렬만, 미지정 = 둘 다(박스) */
  only?: 'search' | 'sort';
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(initial.q ?? '');
  const [pending, startTransition] = useTransition();

  // URL의 q가 외부에서 바뀌면(예: 사이드바 카테고리 클릭으로 q 제거, 브라우저 뒤로가기)
  // 입력창도 동기화. 사용자가 타이핑 중에는 urlQ가 그대로라 effect가 덮어쓰지 않는다.
  const urlQ = sp.get('q') ?? '';
  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  function applyFilters(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, v);
    }
    next.delete('page');
    startTransition(() =>
      router.push(`/help/${productCode}?${toQueryString(next)}`),
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    applyFilters({ q });
  }

  const searchEl = (
    <form onSubmit={onSubmit} className="relative w-full">
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
  );

  const sortEl = (
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
  );

  // 검색창만 — 좌측 사이드바 배치용
  if (only === 'search') {
    return (
      <div className="flex flex-col gap-1">
        {searchEl}
        {pending && <span className="text-xs text-slate-500">적용 중...</span>}
      </div>
    );
  }

  // 정렬만 — 상단 우측 배치용
  if (only === 'sort') {
    return (
      <div className="flex items-center gap-2">
        {pending && <span className="text-xs text-slate-500">적용 중...</span>}
        <div className="w-44">{sortEl}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-900/30 sm:grid-cols-2 lg:grid-cols-4">
      <div className="lg:col-span-3">{searchEl}</div>
      {sortEl}
      {pending && (
        <span className="text-xs text-slate-500 sm:col-span-2 lg:col-span-4">
          적용 중...
        </span>
      )}
    </div>
  );
}
