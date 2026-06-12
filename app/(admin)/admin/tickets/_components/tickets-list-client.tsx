'use client';

/**
 * 큐 리스트 (데스크탑 테이블 + 모바일 카드뷰).
 */

import Link from 'next/link';
import {
  Clock,
  Flame,
  Hash,
  MessageSquare,
  UserCircle2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { STATUS_LABEL } from '@/lib/services/tickets-meta';
import type { TicketListItem } from '@/lib/services/tickets';
import type { TicketStatus } from '@/db/schema';

const STATUS_TONE: Record<TicketStatus, 'slate' | 'brand' | 'warn' | 'success'> = {
  received: 'brand',
  in_progress: 'warn',
  completed: 'success',
};

function fmtDate(d: Date | null | string): string {
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

export function TicketsListClient({
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
            icon={<Hash className="h-6 w-6" />}
            title="조건에 맞는 티켓이 없습니다"
            description="필터를 조정하거나 다른 상태 탭을 확인해주세요."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* 데스크탑 테이블 */}
      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 lg:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left font-medium">번호</th>
              <th className="px-3 py-2 text-left font-medium">제목</th>
              <th className="px-3 py-2 text-left font-medium">호텔</th>
              <th className="px-3 py-2 text-left font-medium">제품·유형</th>
              <th className="px-3 py-2 text-left font-medium">긴급도</th>
              <th className="px-3 py-2 text-left font-medium">담당</th>
              <th className="px-3 py-2 text-left font-medium">상태</th>
              <th className="px-3 py-2 text-left font-medium">접수일</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr
                key={t.id}
                className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-brand-50/30 dark:border-slate-800 dark:hover:bg-brand-950/20"
              >
                <td className="px-3 py-2 font-mono text-xs">
                  <Link
                    href={`/admin/tickets/${t.id}`}
                    className="text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {t.ticketNo}
                  </Link>
                </td>
                <td className="px-3 py-2 font-medium">
                  <Link
                    href={`/admin/tickets/${t.id}`}
                    className="block max-w-md truncate hover:underline"
                  >
                    {t.title}
                  </Link>
                  {t.messageCount > 0 && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-[11px] text-slate-400">
                      <MessageSquare className="h-3 w-3" />
                      {t.messageCount}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {t.hotelName ?? '-'}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {productMap[t.productCode] ?? t.productCode}
                  <span className="text-slate-400"> · </span>
                  {issueTypeMap[t.issueType] ?? t.issueType}
                </td>
                <td className="px-3 py-2">
                  {t.urgency === 'p1' ? (
                    <Badge tone="danger">
                      <Flame className="h-3 w-3" />
                      P1
                    </Badge>
                  ) : t.urgency === 'p2' ? (
                    <Badge tone="warn">P2</Badge>
                  ) : (
                    <Badge tone="slate">P3</Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {t.assigneeName ?? (
                    <span className="text-slate-400">미배정</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge tone={STATUS_TONE[t.status]}>
                    {STATUS_LABEL[t.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                  {fmtDate(t.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드뷰 */}
      <ul className="flex flex-col gap-2 lg:hidden">
        {items.map((t) => (
          <li key={t.id}>
            <Link href={`/admin/tickets/${t.id}`} className="block">
              <Card className="transition-colors hover:border-brand-300 dark:hover:border-brand-700">
                <CardContent className="flex flex-col gap-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                      <Hash className="h-3 w-3" />
                      {t.ticketNo}
                    </span>
                    <Badge tone={STATUS_TONE[t.status]}>
                      {STATUS_LABEL[t.status]}
                    </Badge>
                  </div>
                  <div className="text-sm font-semibold">{t.title}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{t.hotelName ?? '-'}</span>
                    <span>·</span>
                    <span>{productMap[t.productCode] ?? t.productCode}</span>
                    <span>·</span>
                    <span>{issueTypeMap[t.issueType] ?? t.issueType}</span>
                    {t.urgency === 'p1' && (
                      <Badge tone="danger">
                        <Flame className="h-3 w-3" />
                        P1
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {fmtDate(t.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserCircle2 className="h-3 w-3" />
                      {t.assigneeName ?? '미배정'}
                    </span>
                    {t.messageCount > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {t.messageCount}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
