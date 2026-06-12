'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { ProductCategoryView } from '@/lib/services/categories';

export function FaqFilters({
  initial,
  productCategories,
  issueTypeCategories,
}: {
  initial: { q?: string; productCode?: string; issueType?: string };
  productCategories: ProductCategoryView[];
  issueTypeCategories: Array<{ code: string; label: string }>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(initial.q ?? '');
  const [pending, startTransition] = useTransition();

  function apply(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => router.push(`/faq?${next.toString()}`));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    apply({ q });
  }

  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-900/30 sm:grid-cols-3">
      <form onSubmit={onSubmit} className="relative sm:col-span-3 lg:col-span-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="질문/답변 키워드 검색"
          className="pl-8 pr-8"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              apply({ q: undefined });
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            aria-label="검색어 지우기"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      <Select
        value={initial.productCode ?? ''}
        onChange={(e) => apply({ productCode: e.target.value || undefined })}
        aria-label="제품 필터"
      >
        <option value="">모든 제품</option>
        {productCategories.map((c) => (
          <option key={c.id} value={c.code}>
            {c.label}
          </option>
        ))}
      </Select>

      <Select
        value={initial.issueType ?? ''}
        onChange={(e) => apply({ issueType: e.target.value || undefined })}
        aria-label="문제유형 필터"
      >
        <option value="">모든 유형</option>
        {issueTypeCategories.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label}
          </option>
        ))}
      </Select>

      {pending && (
        <span className="text-xs text-slate-500 sm:col-span-3">적용 중...</span>
      )}
    </div>
  );
}
