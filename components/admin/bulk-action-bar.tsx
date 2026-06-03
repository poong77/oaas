'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * 일괄 작업 바 — 리스트에서 항목 선택 시 상단에 노출.
 * count>0 일 때만 렌더. 우측에 액션 버튼(children)을 배치한다.
 */
export function BulkActionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-brand-200 bg-brand-50 px-4 py-2.5 text-sm dark:border-brand-900/60 dark:bg-brand-950/40">
      <span className="inline-flex items-center gap-1.5 font-medium text-brand-700 dark:text-brand-300">
        <button
          type="button"
          onClick={onClear}
          className="rounded p-0.5 text-brand-500 transition-colors hover:bg-brand-100 hover:text-brand-700 dark:hover:bg-brand-900/60"
          aria-label="선택 해제"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="tabular-nums">{count}</span>개 선택됨
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}
