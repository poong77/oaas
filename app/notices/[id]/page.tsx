/**
 * /notices/[id] — 공지 상세 (NT-01, Phase 7).
 *
 * - 진입 시 view_count +1 (Server Action fire-and-forget)
 * - 관련 공지 3건 (같은 product 또는 같은 kind)
 * - 인쇄 / 공유 (Client Component 분리)
 * - 비활성 / 미발행은 404
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pin } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { MarkdownView } from '@/components/articles/markdown-view';
import {
  getNoticeById,
  listRelatedNotices,
} from '@/lib/services/notices';
import { getProductCategories } from '@/lib/services/categories';
import {
  NOTICE_KIND_CLASSES,
  NOTICE_KIND_META,
} from '@/lib/services/notices-meta';
import { formatDateKst } from '@/lib/business-hours/format';
import { NoticeViewBumper } from './_components/notice-view-bumper';
import { NoticeActionsBar } from './_components/notice-actions-bar';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { id } = await params;
  const notice = await getNoticeById(id);
  return {
    title: notice
      ? `${notice.title} — 공지/업데이트`
      : '공지 — OA서포트',
    description: notice
      ? notice.bodyMarkdown.slice(0, 120)
      : '서비스 변경 사항·점검·장애·릴리즈 노트',
  };
}

export default async function NoticeDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  const { id } = await params;
  const notice = await getNoticeById(id);
  if (!notice) notFound();

  const [related, categories] = await Promise.all([
    listRelatedNotices(notice.id, notice.productCode, notice.kind, 3),
    getProductCategories(),
  ]);

  const meta = NOTICE_KIND_META[notice.kind];
  const kindClass = NOTICE_KIND_CLASSES[notice.kind];
  const productLabel = notice.productCode
    ? (categories.find((c) => c.code === notice.productCode)?.label ??
      notice.productCode)
    : '전체';

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 print:max-w-full print:px-0 print:py-2">
      {/* view_count 증분 (Client Component, useEffect 1회) */}
      <NoticeViewBumper noticeId={notice.id} />

      <div className="print:hidden">
        <PageHeader
          title={
            <span className="inline-flex flex-wrap items-center gap-2">
              {notice.pinned && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
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
              <span className="text-xl font-bold tracking-tight sm:text-2xl">
                {notice.title}
              </span>
            </span>
          }
          breadcrumb={
            <Link
              href="/notices"
              className="inline-flex items-center gap-1 hover:underline"
            >
              <ArrowLeft className="h-3 w-3" />
              공지/업데이트 목록
            </Link>
          }
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>
              <strong className="font-medium text-slate-700 dark:text-slate-200">
                제품
              </strong>
              <span className="ml-1">{productLabel}</span>
            </span>
            <span className="text-slate-300">·</span>
            <span>
              <strong className="font-medium text-slate-700 dark:text-slate-200">
                발행일
              </strong>
              <span className="ml-1">{formatDateKst(notice.publishedAt)}</span>
            </span>
            <span className="text-slate-300">·</span>
            <span>
              <strong className="font-medium text-slate-700 dark:text-slate-200">
                작성자
              </strong>
              <span className="ml-1">
                {notice.authorName ?? '운영팀'}
              </span>
            </span>
            <span className="text-slate-300">·</span>
            <span>조회 {notice.viewCount.toLocaleString()}</span>
          </div>

          <article>
            <MarkdownView source={notice.bodyMarkdown} />
          </article>

          <NoticeActionsBar
            noticeId={notice.id}
            title={notice.title}
            className="print:hidden"
          />
        </CardContent>
      </Card>

      {related.length > 0 && (
        <section
          aria-labelledby="related-notices"
          className="flex flex-col gap-3 print:hidden"
        >
          <h2
            id="related-notices"
            className="text-base font-semibold tracking-tight"
          >
            관련 공지
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => {
              const rMeta = NOTICE_KIND_META[r.kind];
              const rKindClass = NOTICE_KIND_CLASSES[r.kind];
              return (
                <li key={r.id}>
                  <Link
                    href={`/notices/${r.id}`}
                    className="flex h-full flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-medium min-w-[88px] ${rKindClass}`}
                      >
                        {rMeta.label}
                      </span>
                      {r.publishedAt && (
                        <span className="text-xs text-slate-400">
                          {formatDateKst(r.publishedAt)}
                        </span>
                      )}
                    </div>
                    <h3 className="line-clamp-2 text-sm font-semibold">
                      {r.title}
                    </h3>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

