'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import type { SearchLogPeriod } from '@/lib/services/search-logs';

const OPTIONS: { value: SearchLogPeriod; label: string }[] = [
  { value: 'today', label: '오늘 (실시간)' },
  { value: 'yesterday', label: '어제 (1일)' },
  { value: '7d', label: '최근 7일' },
  { value: '30d', label: '최근 30일' },
];

/** 오늘(실시간) 탭에서 서버 데이터 자동 갱신 주기(ms). */
const REALTIME_INTERVAL_MS = 30_000;

export function SearchLogsFilters({ period }: { period: SearchLogPeriod }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  // 오늘(실시간) 탭일 때만 주기적으로 서버 컴포넌트 재요청 → 최신 로그 반영.
  useEffect(() => {
    if (period !== 'today') return;
    const id = setInterval(() => {
      router.refresh();
    }, REALTIME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [period, router]);

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
      <span className="mr-1 text-xs font-medium text-slate-500 dark:text-slate-400">기간</span>
      {OPTIONS.map((o) => {
        const active = period === o.value;
        return (
          <Button
            key={o.value}
            type="button"
            size="sm"
            variant={active ? 'default' : 'outline'}
            disabled={pending}
            onClick={() => select(o.value)}
          >
            {o.value === 'today' && (
              <span
                className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${
                  active
                    ? 'animate-pulse bg-emerald-300'
                    : 'bg-emerald-500'
                }`}
                aria-hidden
              />
            )}
            {o.label}
          </Button>
        );
      })}
      <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
        {period === 'today'
          ? '오늘 00:00~현재까지 · 30초마다 자동 갱신'
          : '어제를 끝으로 집계 (오늘 제외)'}
      </span>
    </div>
  );
}
