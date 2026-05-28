'use client';

/**
 * 내 문의 필터 — 상태 탭 + 정렬.
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const STATUS_TABS = [
  { key: 'all', label: '전체' },
  { key: 'received', label: '접수' },
  { key: 'in_progress', label: '처리중' },
  { key: 'on_hold', label: '보류' },
  { key: 'completed', label: '완료' },
] as const;

export function MyTicketsFilters({
  status,
  sortOrder,
  productCode,
  products,
}: {
  status: string;
  sortOrder: 'asc' | 'desc';
  productCode: string | null;
  products: Array<{ code: string; label: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const updateParam = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === '' || v === 'all') params.delete(k);
        else params.set(k, v);
      }
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, sp],
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="-mb-px flex flex-wrap items-center gap-1 overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const active = status === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => updateParam({ status: tab.key })}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={productCode ?? ''}
          onChange={(e) => updateParam({ productCode: e.target.value || null })}
          className="h-8 w-32"
        >
          <option value="">전체 제품</option>
          {products.map((p) => (
            <option key={p.code} value={p.code}>
              {p.label}
            </option>
          ))}
        </Select>
        <Select
          value={sortOrder}
          onChange={(e) => updateParam({ sortOrder: e.target.value })}
          className="h-8 w-28"
        >
          <option value="desc">최신순</option>
          <option value="asc">오래된순</option>
        </Select>
      </div>
    </div>
  );
}
