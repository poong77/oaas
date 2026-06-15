/**
 * /notices — 공지/업데이트 목록 (시안 레이아웃 적용, 2026-06-10).
 *
 * 시안대로: 종류 필터 탭(전체/공지사항/서비스 장애/릴리즈) + 검색 + 행 리스트 + 번호 페이지네이션.
 * 실데이터(listNotices) · URL 기반 필터/검색/페이지 유지. 전역 RoleScope 크롬 안에서 렌더.
 */

import Link from 'next/link';
import { ChevronLeft, ChevronRight, Megaphone, Pin, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { listNotices } from '@/lib/services/notices';
import {
  NOTICE_KIND_CLASSES,
  NOTICE_KIND_META,
} from '@/lib/services/notices-meta';
import type { NoticeKind } from '@/db/schema';
import { formatDateKst } from '@/lib/business-hours/format';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '공지/업데이트 — OA서포트',
  description: '서비스 변경 사항·점검·장애·릴리즈 노트를 한곳에서 확인하세요.',
};

type SearchParams = Promise<{
  kind?: NoticeKind | 'all';
  q?: string;
  page?: string;
}>;

const PAGE_SIZE = 10;

const FILTERS: { key: 'all' | NoticeKind; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'notice', label: '공지사항' },
  { key: 'incident', label: '서비스 장애' },
  { key: 'release', label: '릴리즈' },
];

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const activeKind: 'all' | NoticeKind = sp.kind ?? 'all';
  const kindParam = activeKind !== 'all' ? activeKind : undefined;
  const q = (sp.q ?? '').trim() || undefined;

  const { items, total } = await listNotices({
    kind: kindParam,
    q,
    publishedOnly: true,
    isActive: true,
    sortBy: 'published_at',
    sortOrder: 'desc',
    page,
    pageSize: PAGE_SIZE,
  });

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(next: { kind?: string; q?: string; page?: number }): string {
    const u = new URLSearchParams();
    const k = next.kind ?? activeKind;
    const query = next.q ?? q;
    if (k && k !== 'all') u.set('kind', k);
    if (query) u.set('q', query);
    if (next.page && next.page > 1) u.set('page', String(next.page));
    const qs = u.toString();
    return `/notices${qs ? `?${qs}` : ''}`;
  }

  // 번호 페이지네이션 윈도우 (최대 5개)
  const windowStart = Math.max(1, Math.min(page - 2, lastPage - 4));
  const pageNumbers = Array.from(
    { length: Math.min(5, lastPage) },
    (_, i) => windowStart + i,
  ).filter((p) => p >= 1 && p <= lastPage);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">공지사항</h1>

      {/* 필터 탭 + 검색 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => {
            const active = f.key === activeKind;
            return (
              <Link
                key={f.key}
                href={buildHref({ kind: f.key, page: 1 })}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
        <form action="/notices" method="get" className="sm:w-80">
          {activeKind !== 'all' && (
            <input type="hidden" name="kind" value={activeKind} />
          )}
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 focus-within:border-brand-500 dark:border-slate-700 dark:bg-slate-900">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="search"
              name="q"
              defaultValue={sp.q ?? ''}
              placeholder="검색어를 입력해 주세요"
              className="w-full bg-transparent text-sm placeholder:text-slate-400 focus:outline-none"
            />
          </label>
        </form>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Megaphone className="h-6 w-6" />}
              title="조건에 맞는 공지가 없습니다"
              description="다른 필터나 검색어를 시도해보세요."
            />
          </CardContent>
        </Card>
      ) : (
        <ul className="border-t border-slate-200 dark:border-slate-800">
          {items.map((n) => {
            const meta = NOTICE_KIND_META[n.kind];
            const kindClass = NOTICE_KIND_CLASSES[n.kind];
            return (
              <li
                key={n.id}
                className="border-b border-slate-200 dark:border-slate-800"
              >
                <Link
                  href={`/notices/${n.id}`}
                  className="flex flex-col gap-2 px-2 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/40 sm:flex-row sm:items-center sm:gap-5"
                >
                  <span className="flex shrink-0 items-center gap-1.5">
                    {n.pinned && (
                      <span
                        className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        title="상단 고정"
                      >
                        <Pin className="h-3 w-3" />
                        고정
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-medium min-w-[88px] ${kindClass}`}
                    >
                      {meta.label}
                    </span>
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {n.title}
                  </span>
                  {n.publishedAt && (
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatDateKst(n.publishedAt)}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* 번호 페이지네이션 */}
      {lastPage > 1 && (
        <nav className="flex items-center justify-center gap-1">
          {page > 1 ? (
            <Link
              href={buildHref({ page: page - 1 })}
              aria-label="이전"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 dark:text-slate-600">
              <ChevronLeft className="h-4 w-4" />
            </span>
          )}
          {pageNumbers.map((p) => (
            <Link
              key={p}
              href={buildHref({ page: p })}
              className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {p}
            </Link>
          ))}
          {page < lastPage ? (
            <Link
              href={buildHref({ page: page + 1 })}
              aria-label="다음"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 dark:text-slate-600">
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
