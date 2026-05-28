/**
 * /notices — 공지/업데이트 목록 (NT-01, Phase 7).
 *
 * - placeholder 전면 교체
 * - 필터: 제품, 종류
 * - 정렬: pinned DESC → published_at DESC (고정)
 * - 페이지네이션 10건/페이지
 * - 모바일 카드뷰 (이미 기본 카드 흐름)
 */

import Link from 'next/link';
import { ChevronLeft, ChevronRight, Megaphone, Pin } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { listNotices, summarizeNoticeBody } from '@/lib/services/notices';
import { getProductCategories } from '@/lib/services/categories';
import {
  NOTICE_KIND_CLASSES,
  NOTICE_KIND_META,
} from '@/lib/services/notices-meta';
import type { NoticeKind } from '@/db/schema';
import { NoticesFilters } from './_components/notices-filters';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '공지/업데이트 — OA 통합 AS',
  description:
    '서비스 변경 사항·점검·장애·릴리즈 노트를 한곳에서 확인하세요.',
};

type SearchParams = Promise<{
  kind?: NoticeKind | 'all';
  productCode?: string;
  page?: string;
}>;

const PAGE_SIZE = 10;

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const kindParam = sp.kind && sp.kind !== 'all' ? sp.kind : undefined;
  const productCode = sp.productCode || undefined;

  const [{ items, total }, categories] = await Promise.all([
    listNotices({
      kind: kindParam,
      productCode,
      publishedOnly: true,
      isActive: true,
      sortBy: 'published_at',
      sortOrder: 'desc',
      page,
      pageSize: PAGE_SIZE,
    }),
    getProductCategories(),
  ]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const productLabelMap = new Map(categories.map((c) => [c.code, c.label]));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title="공지 / 업데이트"
        description="서비스 변경 사항·점검·장애·릴리즈 노트를 한곳에서 확인하세요."
      />

      <NoticesFilters
        initial={{ kind: sp.kind ?? 'all', productCode }}
        categories={categories}
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Megaphone className="h-6 w-6" />}
              title="조건에 맞는 공지가 없습니다"
              description="다른 필터를 시도해보시거나 전체 공지를 확인해주세요."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {items.map((n) => {
              const summary = summarizeNoticeBody(n.bodyMarkdown, 100);
              const meta = NOTICE_KIND_META[n.kind];
              const kindClass = NOTICE_KIND_CLASSES[n.kind];
              const productLabel = n.productCode
                ? (productLabelMap.get(n.productCode) ?? n.productCode)
                : '전체';
              return (
                <li key={n.id}>
                  <Link
                    href={`/notices/${n.id}`}
                    className={`flex flex-col gap-2 rounded-lg border bg-white p-4 transition-colors hover:-translate-y-0.5 dark:bg-slate-900 ${
                      n.pinned
                        ? 'border-brand-300 ring-1 ring-brand-200 dark:border-brand-700 dark:ring-brand-800/60'
                        : 'border-slate-200 hover:border-brand-300 dark:border-slate-800 dark:hover:border-brand-700'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {n.pinned && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          title="상단 고정"
                        >
                          <Pin className="h-3 w-3" />
                          고정
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${kindClass}`}
                      >
                        {meta.label}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {productLabel}
                      </span>
                      {n.banner && (
                        <span
                          className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                          title="홈 배너 노출 중"
                        >
                          배너 노출
                        </span>
                      )}
                      {n.publishedAt && (
                        <span className="text-xs text-slate-400">
                          {formatDate(n.publishedAt)}
                        </span>
                      )}
                    </div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {n.title}
                    </h2>
                    {summary && (
                      <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                        {summary}
                      </p>
                    )}
                    <div className="text-xs text-slate-400">
                      조회 {n.viewCount.toLocaleString()}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {lastPage > 1 && (
            <Pagination
              page={page}
              lastPage={lastPage}
              total={total}
              pageSize={PAGE_SIZE}
              kind={sp.kind}
              productCode={productCode}
            />
          )}
        </>
      )}
    </div>
  );
}

function Pagination({
  page,
  lastPage,
  total,
  pageSize,
  kind,
  productCode,
}: {
  page: number;
  lastPage: number;
  total: number;
  pageSize: number;
  kind?: string;
  productCode?: string;
}) {
  function buildHref(target: number): string {
    const sp = new URLSearchParams();
    if (kind && kind !== 'all') sp.set('kind', kind);
    if (productCode) sp.set('productCode', productCode);
    if (target > 1) sp.set('page', String(target));
    const qs = sp.toString();
    return `/notices${qs ? `?${qs}` : ''}`;
  }
  return (
    <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
      <div className="text-xs text-slate-500">
        {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} /{' '}
        {total}
      </div>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link
            href={buildHref(page - 1)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </Link>
        ) : (
          <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-300 dark:border-slate-800 dark:text-slate-600">
            <ChevronLeft className="h-4 w-4" />
            이전
          </span>
        )}
        <span className="px-2 text-sm font-medium">
          {page} / {lastPage}
        </span>
        {page < lastPage ? (
          <Link
            href={buildHref(page + 1)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-300 dark:border-slate-800 dark:text-slate-600">
            다음
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}

function formatDate(d: Date | string | null): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
