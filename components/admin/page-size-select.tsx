'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Select } from '@/components/ui/select';
import { PAGE_SIZE_OPTIONS } from '@/lib/list-params';

/**
 * 페이지당 표시 개수 선택 (20/50/100).
 * 라우트 비종속 — usePathname 으로 현재 경로에 pageSize 쿼리를 갱신한다.
 * 변경 시 page=1 로 초기화.
 */
export function PageSizeSelect({ pageSize }: { pageSize: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function change(value: string) {
    const next = new URLSearchParams(sp.toString());
    next.set('pageSize', value);
    next.delete('page');
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const current = (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSize)
    ? pageSize
    : 20;

  return (
    <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
      <span className="hidden sm:inline">페이지당</span>
      <Select
        aria-label="페이지당 표시 개수"
        value={String(current)}
        onChange={(e) => change(e.target.value)}
        disabled={pending}
        className="h-8 w-auto min-w-[4.75rem] pr-7 text-xs"
      >
        {PAGE_SIZE_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}개씩
          </option>
        ))}
      </Select>
    </label>
  );
}
