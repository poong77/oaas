'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import type { SearchLogPeriod } from '@/lib/services/search-logs';

const OPTIONS: { value: SearchLogPeriod; label: string }[] = [
  { value: 'yesterday', label: '어제 (1일)' },
  { value: '7d', label: '최근 7일' },
  { value: '30d', label: '최근 30일' },
];

export function SearchLogsFilters({ period }: { period: SearchLogPeriod }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function select(value: SearchLogPeriod) {
    const next = new URLSearchParams(sp.toString());
    next.set('period', value);
    next.delete('page');
    startTransition(() =>
      router.push(`/admin/insights/search-logs?${next.toString()}`),
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-900/30">
      <span className="mr-1 text-xs font-medium text-slate-500">기간</span>
      {OPTIONS.map((o) => (
        <Button
          key={o.value}
          type="button"
          size="sm"
          variant={period === o.value ? 'default' : 'outline'}
          disabled={pending}
          onClick={() => select(o.value)}
        >
          {o.label}
        </Button>
      ))}
      <span className="ml-auto text-xs text-slate-400">
        오늘은 집계 진행 중이라 제외됩니다 (어제 기준)
      </span>
    </div>
  );
}
