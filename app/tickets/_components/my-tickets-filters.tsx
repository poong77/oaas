'use client';

/**
 * 내 문의 필터 (시안 반영) — 상태 탭 + 제품(대분류) + 정렬 + 검색.
 *
 * 상태 탭은 프로덕션 3종(접수/처리중/완료) + 전체.
 * 검색은 Enter 또는 아이콘 클릭 시 q 파라미터로 반영.
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Search } from 'lucide-react';
import { Select } from '@/components/ui/select';

const STATUS_TABS = [
  { key: 'all', label: '전체' },
  { key: 'received', label: '접수' },
  { key: 'in_progress', label: '처리중' },
  { key: 'completed', label: '완료' },
] as const;

export function MyTicketsFilters({
  status,
  sortOrder,
  productCode,
  q,
  products,
}: {
  status: string;
  sortOrder: 'asc' | 'desc';
  productCode: string | null;
  q: string;
  products: Array<{ code: string; label: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [query, setQuery] = useState(q);

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
      {/* 상태 탭 */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const active = status === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => updateParam({ status: tab.key })}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 제품(대분류) + 정렬 + 검색 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Select
            value={productCode ?? ''}
            onChange={(e) => updateParam({ productCode: e.target.value || null })}
            className="h-[40px] w-full rounded-lg border-black/[0.06] bg-white shadow-none dark:border-white/10 dark:bg-slate-900 sm:w-[136px]"
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
            className="h-[40px] w-full rounded-lg border-black/[0.06] bg-white shadow-none dark:border-white/10 dark:bg-slate-900 sm:w-[120px]"
          >
            <option value="desc">최신순</option>
            <option value="asc">오래된순</option>
          </Select>
        </div>
        <label className="flex h-[40px] w-full items-center gap-3 rounded-lg border border-black/[0.06] bg-[#F7F8F9] px-4 dark:border-white/10 dark:bg-slate-800 sm:w-[280px]">
          <button
            type="button"
            aria-label="검색"
            onClick={() => updateParam({ q: query.trim() || null })}
            className="shrink-0 text-[#868B94]"
          >
            <Search className="h-5 w-5" />
          </button>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') updateParam({ q: query.trim() || null });
            }}
            placeholder="검색어를 입력해 주세요"
            className="w-full bg-transparent text-sm text-[#1A1C20] placeholder:text-[#B0B3BA] focus:outline-none dark:text-slate-100"
          />
        </label>
      </div>
    </div>
  );
}
