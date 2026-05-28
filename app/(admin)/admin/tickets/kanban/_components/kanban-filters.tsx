'use client';

/**
 * 칸반 필터 — 긴급도 / 제품 / "내 담당" 토글.
 * URL searchParams 기반 (Phase 5 tickets-filters 패턴 축소판).
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export function KanbanFilters({
  productCode,
  urgency,
  mineOnly,
  products,
  urgencies,
}: {
  productCode: string | null;
  urgency: string | null;
  mineOnly: boolean;
  products: Array<{ code: string; label: string }>;
  urgencies: Array<{ code: string; label: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(partial: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(partial)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  }

  function reset() {
    startTransition(() => {
      router.push(pathname);
    });
  }

  const hasAny = !!(productCode || urgency || mineOnly);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <Select
        value={urgency ?? ''}
        onChange={(e) => update({ urgency: e.target.value || null })}
        disabled={pending}
        className="h-9 max-w-[140px] text-sm"
        aria-label="긴급도 필터"
      >
        <option value="">전체 긴급도</option>
        {urgencies.map((u) => (
          <option key={u.code} value={u.code}>
            {u.label}
          </option>
        ))}
      </Select>
      <Select
        value={productCode ?? ''}
        onChange={(e) => update({ productCode: e.target.value || null })}
        disabled={pending}
        className="h-9 max-w-[180px] text-sm"
        aria-label="제품 필터"
      >
        <option value="">전체 제품</option>
        {products.map((p) => (
          <option key={p.code} value={p.code}>
            {p.label}
          </option>
        ))}
      </Select>
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          checked={mineOnly}
          onChange={(e) =>
            update({ mineOnly: e.target.checked ? '1' : null })
          }
          disabled={pending}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span>내 담당만</span>
      </label>
      {hasAny && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reset}
          disabled={pending}
        >
          필터 초기화
        </Button>
      )}
    </div>
  );
}
