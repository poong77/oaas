/**
 * LP-01 ④ 공지사항 — 최근 발행 공지 리스트 (시안 구조, 2026-06-10).
 *
 * listRecentPublishedNotices(n) 결과를 kind 배지 + 제목 + 날짜로 노출.
 * 행 → /notices/{id}, 전체보기 → /notices.
 */

import Link from 'next/link';
import { ArrowRight, Bell } from 'lucide-react';
import type { NoticeListItem } from '@/lib/services/notices';
import { NoticeKindBadge } from '@/components/badges/notice-kind-badge';

function fmtDate(d: Date | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

export function HomeNoticeList({ items }: { items: NoticeListItem[] }) {
  // 공지가 없어도 섹션은 유지하고 EmptyState를 노출한다(레이아웃 빈 구멍 방지).
  return (
    <section
      aria-labelledby="home-notice-heading"
      className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8"
    >
      <div className="mx-auto w-full max-w-[1200px]">
      <div className="mb-4 flex items-center justify-between">
        <h2
          id="home-notice-heading"
          className="text-heading-medium-bold tracking-tight"
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

      {items.length > 0 ? (
        <ul className="border-t border-slate-200 dark:border-slate-800">
          {items.map((n) => {
            return (
              <li key={n.id} className="border-b border-slate-200 dark:border-slate-800">
                <Link
                  href={`/notices/${n.id}`}
                  className="grid grid-cols-[100px_minmax(0,1fr)_auto] items-center gap-x-4 px-2 py-6 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/40"
                >
                  <NoticeKindBadge kind={n.kind} />
                  <span className="min-w-0 truncate text-title-medium-medium text-slate-800 dark:text-slate-100">
                    {n.title}
                  </span>
                  <span className="shrink-0 text-body-medium-medium text-slate-400 dark:text-slate-500">
                    {fmtDate(n.publishedAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-14 text-center dark:border-slate-800">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
            <Bell className="h-5 w-5" />
          </span>
          <p className="text-body-medium-medium text-slate-500 dark:text-slate-400">
            등록된 공지사항이 없습니다.
          </p>
          <p className="text-body-small-regular text-slate-400 dark:text-slate-500">
            새로운 소식이 등록되면 이곳에 표시됩니다.
          </p>
        </div>
      )}
      </div>
    </section>
  );
}
