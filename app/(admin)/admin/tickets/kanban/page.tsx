/**
 * `/admin/tickets/kanban` — IS-04 칸반뷰 (Phase 6).
 *
 * 매니저+어드민 전용. 3컬럼 (received / in_progress / completed).
 * 드래그앤드롭으로 상태 변경 → moveTicketStatusAction → 호텔리어 자동 알림.
 *
 * 페이지네이션 없음, 검색 없음 (시각화 우선). completed는 최근 30일만.
 */

import { FilePlus2, Headset } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { requireRole } from '@/lib/permissions';
import {
  getTicketQueueSummary,
  listAllTicketsForKanban,
} from '@/lib/services/tickets';
import { getCategoriesByType } from '@/lib/services/categories';
import { TicketsSummaryCards } from '../_components/tickets-summary-cards';
import { ListKanbanToggle } from '../_components/list-kanban-toggle';
import { KanbanFilters } from './_components/kanban-filters';
import { KanbanBoard, type KanbanCard } from './_components/kanban-board';

export const metadata = { title: '문의 관리 (칸반) — OA서포트' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  urgency?: string;
  productCode?: string;
  mineOnly?: string;
}>;

export default async function AdminTicketsKanbanPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole(['manager', 'admin']);
  const params = await searchParams;
  const mineOnly = params.mineOnly === '1';

  const [productCategories, urgencyCategories, summary, columns] =
    await Promise.all([
      getCategoriesByType('product'),
      getCategoriesByType('urgency'),
      getTicketQueueSummary(),
      listAllTicketsForKanban(
        { id: user.id, role: user.role, hotelId: user.hotelId },
        {
          urgency: params.urgency || null,
          productCode: params.productCode || null,
          mineOnly,
        },
      ),
    ]);

  // Server → Client serialization 위해 Date를 ISO string으로 변환
  const initial: Record<keyof typeof columns, KanbanCard[]> = {
    received: columns.received.map(toCard),
    in_progress: columns.in_progress.map(toCard),
    completed: columns.completed.map(toCard),
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <span>문의 관리</span>
            <ListKanbanToggle />
          </span>
        }
        description="상태별 카드를 한눈에 보고, 드래그앤드롭으로 상태를 변경하세요."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href="/admin/tickets/new-by-phone">
                <Headset className="h-4 w-4" />
                티켓 생성
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/tickets/new">
                <FilePlus2 className="h-4 w-4" />
                호텔리어 접수
              </Link>
            </Button>
          </div>
        }
      />

      <TicketsSummaryCards {...summary} />

      <KanbanFilters
        urgency={params.urgency ?? null}
        productCode={params.productCode ?? null}
        mineOnly={mineOnly}
        products={productCategories.map((c) => ({
          code: c.code,
          label: c.label,
        }))}
        urgencies={urgencyCategories.map((c) => ({
          code: c.code,
          label: c.label,
        }))}
      />

      <KanbanBoard initial={initial} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Row → Card 직렬화
// ─────────────────────────────────────────────────────────────────────

function toCard(row: {
  id: string;
  ticketNo: string;
  title: string;
  productCode: string;
  urgency: string;
  status: 'received' | 'in_progress' | 'completed';
  createdAt: Date | string;
  dueDate: Date | string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  hotelId: string | null;
  hotelName: string | null;
}): KanbanCard {
  return {
    id: row.id,
    ticketNo: row.ticketNo,
    title: row.title,
    productCode: row.productCode,
    urgency: row.urgency,
    status: row.status,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : row.createdAt,
    dueDate: row.dueDate
      ? row.dueDate instanceof Date
        ? row.dueDate.toISOString()
        : row.dueDate
      : null,
    assigneeId: row.assigneeId,
    assigneeName: row.assigneeName,
    hotelId: row.hotelId,
    hotelName: row.hotelName,
  };
}
