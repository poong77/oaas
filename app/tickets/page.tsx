/**
 * `/tickets` — 내 문의 목록 (Phase 5 IS-01, 시안 반영).
 *
 * 호텔리어: 본인 reporter_id OR 같은 hotel_id 티켓.
 * 매니저+어드민: 본인 reporter_id 티켓만 (전체 큐는 `/admin/tickets`).
 *
 * 필터: status(탭, 프로덕션 3종), productCode(대분류), sortOrder, q(검색). 페이지당 고정 20개.
 */

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { requireAuth } from '@/lib/permissions';
import { listTickets } from '@/lib/services/tickets';
import {
  getProductCategories,
  getCategoriesByType,
} from '@/lib/services/categories';
import type { TicketStatus } from '@/db/schema';
import { MyTicketsList } from './_components/my-tickets-list';
import { MyTicketsFilters } from './_components/my-tickets-filters';

export const metadata = { title: '내 문의 — OA서포트' };
export const dynamic = 'force-dynamic';

// 내 문의는 필터가 많아 보기 갯수 선택 UI 없이 고정 20개씩 표시한다.
const PAGE_SIZE = 20;

type SearchParams = Promise<{
  status?: string;
  productCode?: string;
  sortOrder?: 'asc' | 'desc';
  q?: string;
  page?: string;
}>;

export default async function MyTicketsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireAuth('/tickets');
  const params = await searchParams;

  const statusRaw = params.status ?? 'all';
  const status: TicketStatus | 'all' =
    statusRaw === 'received' ||
    statusRaw === 'in_progress' ||
    statusRaw === 'completed' ||
    statusRaw === 'all'
      ? (statusRaw as TicketStatus | 'all')
      : 'all';

  const sortOrder: 'asc' | 'desc' = params.sortOrder === 'asc' ? 'asc' : 'desc';
  const productCode = params.productCode || null;
  const q = params.q?.trim() || '';
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const pageSize = PAGE_SIZE;

  // 호텔리어: 같은 호텔까지 모두. 매니저·어드민: 본인 접수만.
  const filter =
    user.role === 'hotelier'
      ? user.hotelId
        ? { hotelId: user.hotelId }
        : { reporterId: user.id }
      : { reporterId: user.id };

  // 필터 드롭다운은 대분류(roots)만. 라벨 해석은 전체 product 맵 사용.
  const [productRoots, allProducts, ticketsResult] = await Promise.all([
    getProductCategories(),
    getCategoriesByType('product'),
    listTickets(
      {
        ...filter,
        status,
        productCode: productCode ?? undefined,
        q: q || undefined,
        sortOrder,
        sortBy: 'created_at',
        page,
        pageSize,
      },
      { id: user.id, role: user.role, hotelId: user.hotelId },
    ),
  ]);

  const issueTypeCategories = await getCategoriesByType('issue_type');
  const productMap: Record<string, string> = Object.fromEntries(
    allProducts.map((c) => [c.code, c.label]),
  );
  const issueTypeMap: Record<string, string> = Object.fromEntries(
    issueTypeCategories.map((c) => [c.code, c.label]),
  );

  const total = ticketsResult.total;
  const totalPages = Math.max(1, Math.ceil(total / ticketsResult.pageSize));

  const buildHref = (p: number) => {
    const sp = new URLSearchParams();
    if (status !== 'all') sp.set('status', status);
    if (productCode) sp.set('productCode', productCode);
    if (sortOrder !== 'desc') sp.set('sortOrder', sortOrder);
    if (q) sp.set('q', q);
    sp.set('page', String(p));
    return `/tickets?${sp.toString()}`;
  };

  // 번호 페이지네이션 윈도우 (최대 5개, 현재±2)
  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pageNumbers = Array.from(
    { length: Math.min(5, totalPages) },
    (_, i) => windowStart + i,
  ).filter((p) => p >= 1 && p <= totalPages);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[#1A1C20] dark:text-white">
          내 문의
        </h1>
        <Link
          href="/tickets/new"
          className="rounded-lg bg-[#00A36B] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#008A59]"
        >
          문의하기
        </Link>
      </div>

      <MyTicketsFilters
        status={status}
        sortOrder={sortOrder}
        productCode={productCode}
        q={q}
        products={productRoots.map((c) => ({ code: c.code, label: c.label }))}
      />

      <MyTicketsList
        items={ticketsResult.items}
        productMap={productMap}
        issueTypeMap={issueTypeMap}
      />

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <nav className="mt-2 flex items-center justify-center gap-1">
          {page > 1 ? (
            <Link
              href={buildHref(page - 1)}
              aria-label="이전"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#868B94] hover:bg-[#F3F4F5] dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-md text-[#DCDEE3] dark:text-slate-600">
              <ChevronLeft className="h-4 w-4" />
            </span>
          )}
          {pageNumbers.map((p) => {
            const active = p === page;
            return (
              <Link
                key={p}
                href={buildHref(p)}
                className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#1A1C20] text-white'
                    : 'text-[#555D6D] hover:bg-[#F3F4F5] dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {p}
              </Link>
            );
          })}
          {page < totalPages ? (
            <Link
              href={buildHref(page + 1)}
              aria-label="다음"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#868B94] hover:bg-[#F3F4F5] dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-md text-[#DCDEE3] dark:text-slate-600">
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
