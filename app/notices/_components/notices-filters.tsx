'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Select } from '@/components/ui/select';
import type { ProductCategoryView } from '@/lib/services/categories';

export function NoticesFilters({
  initial,
  categories,
}: {
  initial: { kind?: string; productCode?: string };
  categories: ProductCategoryView[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function applyFilters(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === '' || v === 'all') next.delete(k);
      else next.set(k, v);
    }
    next.delete('page');
    startTransition(() => router.push(`/notices?${next.toString()}`));
  }

  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-900/30 sm:grid-cols-2">
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
        <option value="">모든 제품 (전체 공지 포함)</option>
        {categories.map((c) => (
          <option key={c.id} value={c.code}>
            {c.label}
          </option>
        ))}
      </Select>

      {pending && (
        <span className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">적용 중...</span>
      )}
    </div>
  );
}
