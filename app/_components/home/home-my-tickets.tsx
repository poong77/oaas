/**
 * LP-01 ⑥ 내 문의 — 로그인 사용자 전용 (시안 구조, 2026-06-11).
 *
 * 좌: 상태 요약(접수/처리중/답변완료) + 문의하기 / 우: 최근 문의 리스트.
 * 데이터: listTickets(본인/호텔 스코프). 비로그인 시 page.tsx에서 미렌더.
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { TicketListItem } from '@/lib/services/tickets';
import type { TicketStatus } from '@/db/schema';

const STATUS_META: Record<
  TicketStatus,
  { label: string; badge: string; num: string }
> = {
  received: {
    label: '접수',
    badge: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
    num: 'text-sky-600 dark:text-sky-400',
  },
  in_progress: {
    label: '처리중',
    badge: 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
    num: 'text-violet-600 dark:text-violet-400',
  },
  completed: {
    label: '답변 완료',
    badge: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    num: 'text-emerald-600 dark:text-emerald-400',
  },
};

const ORDER: TicketStatus[] = ['received', 'in_progress', 'completed'];

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

export function HomeMyTickets({
  counts,
  items,
  productMap,
  issueMap,
}: {
  counts: Record<TicketStatus, number>;
  items: TicketListItem[];
  productMap: Record<string, string>;
  issueMap: Record<string, string>;
}) {
  return (
    <section
      aria-labelledby="my-tickets-heading"
      className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8"
    >
      <div className="mx-auto w-full max-w-[1200px]">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="my-tickets-heading" className="text-heading-medium-bold tracking-tight">
          내 문의
        </h2>
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1 text-label-medium-medium text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400"
        >
          내 문의 전체보기
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* 상태 요약 카드 */}
        <div className="flex h-fit flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-3 gap-2 text-center">
            {ORDER.map((s) => (
              <div key={s} className="flex flex-col gap-1">
                <span className="text-body-small-regular text-slate-500 dark:text-slate-400">
                  {STATUS_META[s].label}
                </span>
                <span className={`text-heading-medium-bold ${STATUS_META[s].num}`}>
                  {counts[s] ?? 0}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/tickets/new"
            className="rounded-lg bg-brand-600 py-3 text-center text-label-large-semibold text-white transition-colors hover:bg-brand-500"
          >
            문의하기
          </Link>
        </div>

        {/* 최근 문의 리스트 */}
        {items.length > 0 ? (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map((t) => {
              const m = STATUS_META[t.status];
              const meta = [productMap[t.productCode] ?? t.productCode, t.issueType ? (issueMap[t.issueType] ?? t.issueType) : null]
                .filter(Boolean)
                .join(' · ');
              return (
                <li key={t.id}>
                  <Link
                    href={`/tickets/${t.id}`}
                    className="grid grid-cols-[80px_minmax(0,1fr)_auto] items-center gap-x-4 px-2 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/40"
                  >
                    <span
                      className={`inline-flex w-[69px] items-center justify-center whitespace-nowrap rounded-full border px-1.5 py-3 text-label-small-semibold ${m.badge}`}
                    >
                      {m.label}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-title-medium-semibold text-slate-900 dark:text-slate-100">
                        {t.title}
                      </span>
                      <span className="truncate text-body-small-regular text-slate-500 dark:text-slate-400">{meta}</span>
                    </span>
                    <span className="shrink-0 text-body-small-regular text-slate-400">{fmtDate(t.createdAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 p-8 text-body-medium-regular text-slate-400 dark:border-slate-800">
            아직 접수한 문의가 없습니다.
          </div>
        )}
      </div>
      </div>
    </section>
  );
}
