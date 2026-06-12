/**
 * LP-01 ④ 공지사항 — 최근 발행 공지 리스트 (시안 구조, 2026-06-10).
 *
 * listRecentPublishedNotices(n) 결과를 kind 배지 + 제목 + 날짜로 노출.
 * 행 → /notices/{id}, 전체보기 → /notices.
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { NoticeListItem } from '@/lib/services/notices';
import type { NoticeKind } from '@/db/schema';

const KIND_META: Record<NoticeKind, { label: string; cls: string }> = {
  notice: { label: '공지사항', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' },
  release: { label: '릴리즈', cls: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' },
  incident: { label: '서비스 장애', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
};

function fmtDate(d: Date | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

export function HomeNoticeList({ items }: { items: NoticeListItem[] }) {
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="home-notice-heading"
      className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2
          id="home-notice-heading"
          className="text-title-large-bold tracking-tight sm:text-heading-small-bold"
        >
          공지사항
        </h2>
        <Link
          href="/notices"
          className="inline-flex items-center gap-1 text-label-medium-medium text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400"
        >
          공지사항 전체보기
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <ul className="border-t border-slate-200 dark:border-slate-800">
        {items.map((n) => {
          const m = KIND_META[n.kind];
          return (
            <li key={n.id} className="border-b border-slate-200 dark:border-slate-800">
              <Link
                href={`/notices/${n.id}`}
                className="flex flex-col gap-2 px-2 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/40 sm:flex-row sm:items-center sm:gap-5"
              >
                <span
                  className={`inline-flex w-fit shrink-0 items-center justify-center rounded-lg px-2 py-0.5 text-label-small-medium min-w-[88px] ${m.cls}`}
                >
                  {m.label}
                </span>
                <span className="flex-1 truncate text-body-medium-medium text-slate-800 dark:text-slate-100">
                  {n.title}
                </span>
                <span className="shrink-0 text-body-small-regular text-slate-400 dark:text-slate-500">
                  {fmtDate(n.publishedAt)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
