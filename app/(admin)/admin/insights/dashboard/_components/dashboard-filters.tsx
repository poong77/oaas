'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  DASHBOARD_PERIODS,
  PERIOD_LABEL,
  type DashboardPeriod,
} from '@/lib/services/insights-shared';

export function DashboardFilters({
  period,
  productCode,
  products,
}: {
  period: DashboardPeriod;
  productCode: string | null;
  products: { code: string; label: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function push(next: URLSearchParams) {
    startTransition(() =>
      router.push(`/admin/insights/dashboard?${next.toString()}`),
    );
  }
  function selectPeriod(value: DashboardPeriod) {
    const next = new URLSearchParams(sp.toString());
    next.set('period', value);
    push(next);
  }
  function selectProduct(value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set('product', value);
    else next.delete('product');
    push(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-900/30">
      <span className="mr-1 text-xs font-medium text-slate-500">기간</span>
      {DASHBOARD_PERIODS.map((p) => (
        <Button
          key={p}
          type="button"
          size="sm"
          variant={period === p ? 'default' : 'outline'}
          disabled={pending}
          onClick={() => selectPeriod(p)}
        >
          {PERIOD_LABEL[p]}
        </Button>
      ))}
      <span className="ml-2 mr-1 text-xs font-medium text-slate-500">제품</span>
      <select
        value={productCode ?? ''}
        disabled={pending}
        onChange={(e) => selectProduct(e.target.value)}
        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        <option value="">전체 제품</option>
        {products.map((p) => (
          <option key={p.code} value={p.code}>
            {p.label}
          </option>
        ))}
      </select>
      <span className="ml-auto text-xs text-slate-400">
        KST · 오늘 제외 집계
      </span>
    </div>
  );
}
