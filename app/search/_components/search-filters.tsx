'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { ProductCategoryView } from '@/lib/services/categories';

export function SearchFilters({
  initial,
  categories,
}: {
  initial: { product?: string; sort?: string; contentType?: string };
  categories: ProductCategoryView[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(sp.get('q') ?? '');

  function update(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => router.push(`/search?${next.toString()}`));
  }

  function submitQuery(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    update({ q: trimmed });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-900/30 sm:flex-row sm:flex-wrap sm:items-center">
      <form
        onSubmit={submitQuery}
        className="relative w-full sm:min-w-[200px] sm:flex-1"
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="다시 검색…"
          aria-label="검색어"
          className="pl-8"
        />
      </form>

      <Select
        value={initial.product ?? ''}
        onChange={(e) => update({ product: e.target.value || undefined })}
        aria-label="제품 필터"
        className="w-full shrink-0 sm:w-auto"
      >
        <option value="">모든 제품</option>
        {categories.map((c) => (
          <option key={c.id} value={c.code}>
            {c.label}
          </option>
        ))}
      </Select>

      <Select
        value={initial.contentType ?? ''}
        onChange={(e) => update({ contentType: e.target.value || undefined })}
        aria-label="의도 필터"
        className="w-full shrink-0 sm:w-auto"
      >
        <option value="">모든 의도</option>
        <option value="howto">사용방법 (howto)</option>
        <option value="feature">기능설명 (feature)</option>
        <option value="troubleshoot">문제해결 (troubleshoot)</option>
      </Select>

      <Select
        value={initial.sort ?? 'relevance'}
        onChange={(e) => update({ sort: e.target.value })}
        aria-label="정렬"
        className="w-full shrink-0 sm:w-auto"
      >
        <option value="relevance">관련도 순</option>
        <option value="recent">최신순</option>
        <option value="views">조회수 많은순</option>
      </Select>

      {pending && (
        <span className="text-xs text-slate-500 dark:text-slate-400">적용 중...</span>
      )}
    </div>
  );
}
