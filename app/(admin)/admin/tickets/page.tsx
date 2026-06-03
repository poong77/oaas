/**
 * `/admin/tickets` — 매니저+어드민 티켓 큐 (IS-04).
 *
 * 상태 탭 + 제품/유형/긴급도/담당자 필터 + 검색 + 페이지네이션.
 * 상단 요약 카드 4종 (P1 긴급 / 미처리 / 처리중 / 오늘 완료).
 */

import Link from 'next/link';
import { FilePlus2, Headset } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { requireRole } from '@/lib/permissions';
import {
  getTicketQueueSummary,
  listAssignableManagers,
  listTickets,
} from '@/lib/services/tickets';
import { getCategoriesByType } from '@/lib/services/categories';
import { parsePageSize } from '@/lib/list-params';
import { PageSizeSelect } from '@/components/admin/page-size-select';
import type { TicketStatus } from '@/db/schema';
import { TicketsFilters } from './_components/tickets-filters';
import { TicketsListClient } from './_components/tickets-list-client';
import { TicketsSummaryCards } from './_components/tickets-summary-cards';
import { ListKanbanToggle } from './_components/list-kanban-toggle';

export const metadata = { title: '티켓 큐 — OA 통합 AS' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  status?: string;
  productCode?: string;
  issueType?: string;
  urgency?: string;
  assigneeId?: string;
  q?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: string;
  pageSize?: string;
}>;

export default async function AdminTicketsQueuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole(['manager', 'admin']);
  const params = await searchParams;

  const statusRaw = params.status ?? 'received';
  const status: TicketStatus | 'all' =
    statusRaw === 'received' ||
    statusRaw === 'in_progress' ||
    statusRaw === 'on_hold' ||
    statusRaw === 'completed' ||
    statusRaw === 'all'
      ? (statusRaw as TicketStatus | 'all')
      : 'received';

  const sortOrder: 'asc' | 'desc' =
    params.sortOrder === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const pageSize = parsePageSize(params.pageSize);

  const [
    productCategories,
    issueTypeCategories,
    urgencyCategories,
    managers,
    summary,
    ticketsResult,
  ] = await Promise.all([
    getCategoriesByType('product'),
    getCategoriesByType('issue_type'),
    getCategoriesByType('urgency'),
    listAssignableManagers(),
    getTicketQueueSummary(),
    listTickets(
      {
        status,
        productCode: params.productCode || undefined,
        issueType: params.issueType || undefined,
        urgency: params.urgency || undefined,
        assigneeId: params.assigneeId || undefined,
        q: params.q || undefined,
        sortBy: 'created_at',
        sortOrder,
        page,
        pageSize,
      },
      { id: user.id, role: user.role, hotelId: user.hotelId },
    ),
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

  const totalPages = Math.max(
    1,
    Math.ceil(ticketsResult.total / ticketsResult.pageSize),
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <span>티켓 큐</span>
            <ListKanbanToggle />
          </span>
        }
        description={`총 ${ticketsResult.total}건의 티켓이 필터 조건에 해당합니다.`}
        guideAnchor="tickets"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/tickets/new-by-phone">
                <Headset className="h-4 w-4" />
                대리 접수
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/tickets/new">
                <FilePlus2 className="h-4 w-4" />
                직접 접수
              </Link>
            </Button>
          </div>
        }
      />

      <TicketsSummaryCards {...summary} />

      <TicketsFilters
        status={status}
        productCode={params.productCode || null}
        issueType={params.issueType || null}
        urgency={params.urgency || null}
        assigneeId={params.assigneeId || null}
        q={params.q ?? ''}
        products={productCategories.map((c) => ({
          code: c.code,
          label: c.label,
        }))}
        issueTypes={issueTypeCategories.map((c) => ({
          code: c.code,
          label: c.label,
        }))}
        urgencies={urgencyCategories.map((c) => ({
          code: c.code,
          label: c.label,
        }))}
        managers={managers.map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role,
        }))}
        currentUserId={user.id}
      />

      <TicketsListClient
        items={ticketsResult.items}
        productMap={productMap}
        issueTypeMap={issueTypeMap}
        urgencyMap={urgencyMap}
      />

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <PageSizeSelect pageSize={pageSize} />
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(0, 20)
              .map((p) => {
                const sp = new URLSearchParams();
                if (status !== 'received') sp.set('status', status);
                if (params.productCode) sp.set('productCode', params.productCode);
                if (params.issueType) sp.set('issueType', params.issueType);
                if (params.urgency) sp.set('urgency', params.urgency);
                if (params.assigneeId) sp.set('assigneeId', params.assigneeId);
                if (params.q) sp.set('q', params.q);
                if (sortOrder !== 'desc') sp.set('sortOrder', sortOrder);
                if (pageSize !== 20) sp.set('pageSize', String(pageSize));
                sp.set('page', String(p));
                const href = `/admin/tickets?${sp.toString()}`;
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
    </div>
  );
}
