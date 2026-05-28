'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'help', label: '도움말' },
  { key: 'faq', label: 'FAQ' },
  { key: 'notice', label: '공지' },
  { key: 'incident', label: '장애' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function SearchTabs({
  counts,
  current,
  query,
}: {
  counts: Record<TabKey, number>;
  current: TabKey;
  query: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function goTab(tab: TabKey) {
    const next = new URLSearchParams(sp.toString());
    next.set('tab', tab);
    next.set('q', query);
    startTransition(() => router.push(`/search?${next.toString()}`));
  }

  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
      {TABS.map((t) => {
        const active = current === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => goTab(t.key)}
            disabled={pending}
            className={cn(
              '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-brand-500 text-brand-700 dark:text-brand-300'
                : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
            )}
          >
            {t.label}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                active
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              {counts[t.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
