/**
 * `/tickets` — 내 문의 목록 (Phase 5 IS-01).
 *
 * 호텔리어: 본인 reporter_id OR 같은 hotel_id 티켓.
 * 매니저+어드민: 본인 reporter_id 티켓만 (전체 큐는 `/admin/tickets`).
 *
 * 필터: status (탭), productCode, sortOrder
 */

import Link from 'next/link';
import { FilePlus2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { requireAuth } from '@/lib/permissions';
import { listTickets } from '@/lib/services/tickets';
import { getCategoriesByType } from '@/lib/services/categories';
import type { TicketStatus } from '@/db/schema';
import { MyTicketsList } from './_components/my-tickets-list';
import { MyTicketsFilters } from './_components/my-tickets-filters';

export const metadata = { title: '내 문의 — OA서포트' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  status?: string;
  productCode?: string;
  sortOrder?: 'asc' | 'desc';
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

  const sortOrder: 'asc' | 'desc' =
    params.sortOrder === 'asc' ? 'asc' : 'desc';
  const productCode = params.productCode || null;
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);

  // 호텔리어: 같은 호텔까지 모두. 매니저·어드민: 본인 접수만.
  // listTickets는 reporterId/hotelId OR 조건을 직접 지원하지 않으므로 호텔리어는 hotelId만 사용.
  // (본인 접수는 자동 포함됨 — 같은 호텔이니까. 호텔 미매핑 호텔리어는 reporter_id로 조회.)
  const filter =
    user.role === 'hotelier'
      ? user.hotelId
        ? { hotelId: user.hotelId }
        : { reporterId: user.id }
      : { reporterId: user.id };

  const [productCategories, ticketsResult] = await Promise.all([
    getCategoriesByType('product'),
    listTickets(
      {
        ...filter,
        status,
        productCode: productCode ?? undefined,
        sortOrder,
        sortBy: 'created_at',
        page,
        pageSize: 20,
      },
      { id: user.id, role: user.role, hotelId: user.hotelId },
    ),
  ]);

  const [issueTypeCategories, urgencyCategories] = await Promise.all([
    getCategoriesByType('issue_type'),
    getCategoriesByType('urgency'),
  ]);
  const productMap: Record<string, string> = Object.fromEntries(
    productCategories.map((c) => [c.code, c.label]),
  );
  const issueTypeMap: Record<string, string> = Object.fromEntries(
    issueTypeCategories.map((c) => [c.code, c.label]),
  );
  const urgencyMap: Record<string, string> = Object.fromEntries(
    urgencyCategories.map((c) => [c.code, c.label]),
  );

  const total = ticketsResult.total;
  const pageSize = ticketsResult.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title="내 문의"
        description={
          user.role === 'hotelier' && user.hotelId
            ? '본인과 같은 호텔에서 접수된 문의 전체를 확인할 수 있습니다.'
            : '본인이 접수한 문의의 처리 상태와 답변을 확인합니다.'
        }
        actions={
          <Button asChild size="sm">
            <Link href="/tickets/new">
              <FilePlus2 className="h-4 w-4" />
              신규 접수
            </Link>
          </Button>
        }
      />

      <MyTicketsFilters
        status={status}
        sortOrder={sortOrder}
        productCode={productCode}
        products={productCategories.map((c) => ({ code: c.code, label: c.label }))}
      />

      <MyTicketsList
        items={ticketsResult.items}
        productMap={productMap}
        issueTypeMap={issueTypeMap}
        urgencyMap={urgencyMap}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            const sp = new URLSearchParams();
            if (status !== 'all') sp.set('status', status);
            if (productCode) sp.set('productCode', productCode);
            if (sortOrder !== 'desc') sp.set('sortOrder', sortOrder);
            sp.set('page', String(p));
            const href = `/tickets?${sp.toString()}`;
            const active = p === page;
            return (
              <Link
                key={p}
                href={href}
                className={
                  active
                    ? 'inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-white'
                    : 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                }
              >
                {p}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
