'use client';

import { useState } from 'react';
import { ChevronDown, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TocEntry } from '@/db/schema';

/**
 * 아티클 TOC (목차).
 *
 * - 데스크탑(lg+): sticky 우측 사이드바
 * - 모바일: 상단 collapsible (기본 닫힘)
 */
export function ArticleToc({
  toc,
  variant = 'sidebar',
}: {
  toc: TocEntry[];
  variant?: 'sidebar' | 'mobile';
}) {
  const [open, setOpen] = useState(false);

  if (toc.length === 0) return null;

  if (variant === 'mobile') {
    return (
      <div className="rounded-md border border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-900 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 font-semibold"
          aria-expanded={open}
        >
          <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <List className="h-4 w-4" />
            목차 ({toc.length})
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
        {open && (
          <ul className="border-t border-slate-200 px-3 py-2 dark:border-slate-700">
            {toc.map((entry, i) => (
              <TocItem key={`${entry.anchor}-${i}`} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <aside className="hidden flex-col gap-2 lg:flex">
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-md border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
        <h4 className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <List className="h-3.5 w-3.5" />
          목차
        </h4>
        <ul className="space-y-1">
          {toc.map((entry, i) => (
            <TocItem key={`${entry.anchor}-${i}`} entry={entry} />
          ))}
        </ul>
      </div>
    </aside>
  );
}

function TocItem({ entry }: { entry: TocEntry }) {
  return (
    <li
      className={cn(
        entry.level === 1 && 'font-semibold',
        entry.level === 2 && 'pl-2',
        entry.level === 3 && 'pl-5 text-xs',
      )}
    >
      <a
        href={`#${entry.anchor}`}
        className="block truncate rounded px-1 py-0.5 text-slate-700 hover:bg-brand-50 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-brand-950/40 dark:hover:text-brand-300"
      >
        {entry.text}
      </a>
    </li>
  );
}
