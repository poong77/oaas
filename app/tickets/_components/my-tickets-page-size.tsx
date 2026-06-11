'use client';

/**
 * 내 문의 목록 페이지 보기 옵션 — 10/30/50.
 * pageSize 파라미터를 갱신하고 page는 1로 초기화한다.
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Select } from '@/components/ui/select';

const OPTIONS = [10, 30, 50] as const;

export function MyTicketsPageSize({ pageSize }: { pageSize: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-sm text-[#868B94] dark:text-slate-400">
      <span>보기</span>
      <Select
        value={String(pageSize)}
        onChange={(e) => {
          const params = new URLSearchParams(sp.toString());
          params.set('pageSize', e.target.value);
          params.delete('page');
          router.push(`${pathname}?${params.toString()}`);
        }}
        className="h-8 w-20"
      >
        {OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}개
          </option>
        ))}
      </Select>
    </label>
  );
}
