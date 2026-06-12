/**
 * MyTicketsList — 내 문의 목록 (시안 반영).
 *
 * 데스크톱: 테이블(문의일·처리상태·제목·문의유형·답변일).
 * 모바일: 카드뷰. 빈 상태: EmptyState.
 * 상태 pill은 프로덕션 3종(접수/처리중/완료)에 맞춘다.
 */

import Link from 'next/link';
import { ListChecks } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import type { TicketListItem } from '@/lib/services/tickets';
import type { TicketStatus } from '@/db/schema';

const STATUS_META: Record<TicketStatus, { label: string; cls: string }> = {
  received: { label: '접수', cls: 'border-[#217CF9] bg-[#EFF6FF] text-[#217CF9]' },
  in_progress: { label: '처리중', cls: 'border-[#8969EA] bg-[#F5F3FE] text-[#8969EA]' },
  completed: { label: '답변 완료', cls: 'border-[#008A59] bg-[#E6F7F0] text-[#00A36B]' },
};

function StatusPill({ status }: { status: TicketStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium min-w-[80px] ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

function fmtDate(d: Date | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

export function MyTicketsList({
  items,
  productMap,
  issueTypeMap,
}: {
  items: TicketListItem[];
  productMap: Record<string, string>;
  issueTypeMap: Record<string, string>;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-black/[0.06] bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
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
      </div>
    );
  }

  const typeLabel = (t: TicketListItem) =>
    `${productMap[t.productCode] ?? t.productCode}·${issueTypeMap[t.issueType] ?? t.issueType}`;

  return (
    <>
      {/* 데스크톱 테이블 */}
      <div className="hidden overflow-hidden rounded-xl border border-black/[0.06] dark:border-slate-800 sm:block">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-[120px]" />
            <col className="w-[120px]" />
            <col />
            <col className="w-[150px]" />
            <col className="w-[110px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-black/[0.06] text-sm text-[#868B94] dark:border-slate-800">
              <th className="px-5 py-3 text-left font-medium">문의일</th>
              <th className="px-5 py-3 text-left font-medium">처리 상태</th>
              <th className="px-5 py-3 text-left font-medium">제목</th>
              <th className="px-5 py-3 text-left font-medium">문의 유형</th>
              <th className="px-5 py-3 text-right font-medium">답변일</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr
                key={t.id}
                className="border-b border-black/[0.06] text-sm last:border-b-0 dark:border-slate-800"
              >
                <td className="px-5 py-4 text-[#555D6D] dark:text-slate-300">
                  {fmtDate(t.createdAt)}
                </td>
                <td className="px-5 py-4">
                  <StatusPill status={t.status} />
                </td>
                <td className="px-5 py-4">
                  <Link
                    href={`/tickets/${t.id}`}
                    title={t.title}
                    className="block truncate font-medium text-[#1A1C20] hover:text-[#00A36B] dark:text-slate-100"
                  >
                    {t.title}
                  </Link>
                </td>
                <td className="px-5 py-4 text-[#555D6D] dark:text-slate-300">
                  <span className="block truncate" title={typeLabel(t)}>
                    {typeLabel(t)}
                  </span>
                </td>
                <td className="px-5 py-4 text-right text-[#868B94] dark:text-slate-400">
                  {fmtDate(t.answeredAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드뷰 */}
      <ul className="flex flex-col gap-3 sm:hidden">
        {items.map((t) => (
          <li key={t.id}>
            <Link
              href={`/tickets/${t.id}`}
              className="flex flex-col gap-2 rounded-xl border border-black/[0.06] p-4 dark:border-slate-800"
            >
              <div className="flex items-center justify-between">
                <StatusPill status={t.status} />
                <span className="text-xs text-[#868B94] dark:text-slate-400">
                  {fmtDate(t.createdAt)}
                </span>
              </div>
              <span className="text-base font-semibold text-[#1A1C20] dark:text-slate-100">
                {t.title}
              </span>
              <div className="flex items-center justify-between text-sm text-[#555D6D] dark:text-slate-300">
                <span>{typeLabel(t)}</span>
                <span className="text-[#868B94] dark:text-slate-400">
                  답변일 {fmtDate(t.answeredAt)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
