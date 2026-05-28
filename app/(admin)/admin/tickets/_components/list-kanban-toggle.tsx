'use client';

/**
 * 리스트뷰 / 칸반뷰 토글 — 헤더 공유 컴포넌트.
 *
 * `/admin/tickets` 와 `/admin/tickets/kanban` 양쪽 헤더에서 마운트.
 * 현재 모드는 `usePathname()` 으로 판단 — searchParams 보존은 일부러 생략
 * (리스트 필터 ↔ 칸반 필터는 의미가 다르므로 깨끗하게 시작).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ListKanbanToggle() {
  const pathname = usePathname();
  const isKanban = pathname.startsWith('/admin/tickets/kanban');

  return (
    <div
      role="tablist"
      aria-label="티켓 큐 보기 모드"
      className="inline-flex items-center rounded-md border border-slate-200 bg-white p-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900"
    >
      <Link
        href="/admin/tickets"
        role="tab"
        aria-selected={!isKanban}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm px-2.5 py-1 transition-colors',
          !isKanban
            ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
        )}
      >
        <ListChecks className="h-3.5 w-3.5" />
        리스트
      </Link>
      <Link
        href="/admin/tickets/kanban"
        role="tab"
        aria-selected={isKanban}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm px-2.5 py-1 transition-colors',
          isKanban
            ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        칸반
      </Link>
    </div>
  );
}
