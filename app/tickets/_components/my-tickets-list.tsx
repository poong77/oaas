import Link from 'next/link';
import {
  ChevronRight,
  Clock,
  Hash,
  ListChecks,
  MessageSquare,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import type { TicketListItem } from '@/lib/services/tickets';
import { STATUS_LABEL } from '@/lib/services/tickets-meta';
import type { TicketStatus } from '@/db/schema';

const STATUS_TONE: Record<TicketStatus, 'slate' | 'brand' | 'warn' | 'success'> = {
  received: 'brand',
  in_progress: 'warn',
  on_hold: 'slate',
  completed: 'success',
};

function fmtDate(d: Date | null): string {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MyTicketsList({
  items,
  productMap,
  issueTypeMap,
  urgencyMap,
}: {
  items: TicketListItem[];
  productMap: Record<string, string>;
  issueTypeMap: Record<string, string>;
  urgencyMap: Record<string, string>;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={<ListChecks className="h-6 w-6" />}
            title="아직 접수된 문의가 없습니다"
            description="궁금한 점이나 발생한 문제를 접수하시면 처리 상태와 답변을 이곳에서 확인할 수 있습니다."
            action={
              <Button asChild size="sm">
                <Link href="/tickets/new">신규 문의 접수</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((t) => (
        <li key={t.id}>
          <Link href={`/tickets/${t.id}`} className="block">
            <Card className="transition-colors hover:border-brand-300 hover:bg-brand-50/30 dark:hover:border-brand-700 dark:hover:bg-brand-950/20">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex flex-col gap-1 sm:flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Hash className="h-3 w-3" />
                      {t.ticketNo}
                    </span>
                    <span>·</span>
                    <span>{productMap[t.productCode] ?? t.productCode}</span>
                    <span>·</span>
                    <span>{issueTypeMap[t.issueType] ?? t.issueType}</span>
                    {t.urgency === 'p1' && (
                      <Badge tone="danger">P1 긴급</Badge>
                    )}
                  </div>
                  <div className="text-base font-semibold text-slate-900 dark:text-slate-50">
                    {t.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {fmtDate(t.createdAt)}
                    </span>
                    {t.messageCount > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        답변 {t.messageCount}
                      </span>
                    )}
                    {t.assigneeName && (
                      <span className="inline-flex items-center gap-1">
                        담당: {t.assigneeName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                  <Badge tone={STATUS_TONE[t.status]}>
                    {STATUS_LABEL[t.status]}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
