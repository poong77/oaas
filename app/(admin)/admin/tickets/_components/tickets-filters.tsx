'use client';

/**
 * 매니저 큐 필터 — 제품/유형/긴급도/담당자/검색.
 * 상태 필터는 상단 상태 카드(TicketsSummaryCards)가 담당한다(탭 제거, 중복 해소).
 */

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export function TicketsFilters({
  productCode,
  issueType,
  urgency,
  assigneeId,
  q,
  products,
  issueTypes,
  urgencies,
  managers,
  currentUserId,
}: {
  productCode: string | null;
  issueType: string | null;
  urgency: string | null;
  assigneeId: string | null;
  q: string;
  products: Array<{ code: string; label: string }>;
  issueTypes: Array<{ code: string; label: string }>;
  urgencies: Array<{ code: string; label: string }>;
  managers: Array<{ id: string; name: string; role: string }>;
  currentUserId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [searchValue, setSearchValue] = useState(q);

  const updateParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === '') params.delete(k);
        else params.set(k, v);
      }
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, sp],
  );

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateParams({ q: searchValue.trim() || null });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Select
            value={productCode ?? ''}
            onChange={(e) =>
              updateParams({ productCode: e.target.value || null })
            }
            className="h-9"
          >
            <option value="">제품 전체</option>
            {products.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </Select>
          <Select
            value={issueType ?? ''}
            onChange={(e) =>
              updateParams({ issueType: e.target.value || null })
            }
            className="h-9"
          >
            <option value="">유형 전체</option>
            {issueTypes.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select
            value={urgency ?? ''}
            onChange={(e) => updateParams({ urgency: e.target.value || null })}
            className="h-9"
          >
            <option value="">긴급도 전체</option>
            {urgencies.map((u) => (
              <option key={u.code} value={u.code}>
                {u.label}
              </option>
            ))}
          </Select>
          <Select
            value={assigneeId ?? ''}
            onChange={(e) =>
              updateParams({ assigneeId: e.target.value || null })
            }
            className="h-9"
          >
            <option value="">담당 전체</option>
            <option value="unassigned">미배정</option>
            <option value="mine">내 담당</option>
            <option disabled>──────</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.id === currentUserId ? '(나)' : ''}
              </option>
            ))}
          </Select>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="제목·티켓번호·내용 검색"
              className="w-full pl-8 sm:w-64"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            검색
          </Button>
        </form>
      </div>
    </div>
  );
}
