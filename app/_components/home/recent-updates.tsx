/**
 * LP-01 ⑦ 최근 업데이트 위젯 — Phase 7 통합.
 *
 * 변경:
 *   - 기존 (Phase 3): articles 최근 3건만 노출
 *   - Phase 7: pinned notices 1건(있을 때) + notices 발행 최근 2건 + articles 1건을
 *             published_at desc로 통합 정렬해서 최대 3건 노출
 *   - 종류 라벨: 공지/릴리즈/장애/가이드 (NOTICE_KIND_CLASSES + slate)
 */

import Link from 'next/link';
import { ArrowUpRight, Megaphone, Pin } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { listRecentPublishedArticles } from '@/lib/services/articles';
import {
  listPinnedPublishedNotices,
  listRecentPublishedNotices,
  summarizeNoticeBody,
} from '@/lib/services/notices';
import type { NoticeKind } from '@/db/schema';
import {
  NOTICE_KIND_CLASSES,
  NOTICE_KIND_META,
} from '@/lib/services/notices-meta';

type UpdateItem =
  | {
      source: 'notice';
      id: string;
      href: string;
      kind: NoticeKind;
      title: string;
      summary: string;
      label: string;
      labelClass: string;
      publishedAt: Date | string | null;
      pinned: boolean;
    }
  | {
      source: 'article';
      id: string;
      href: string;
      productCode: string;
      title: string;
      summary: string;
      publishedAt: Date | string | null;
    };

export async function RecentUpdates() {
  const [pinnedNotices, recentNotices, recentArticles] = await Promise.all([
    listPinnedPublishedNotices(1),
    listRecentPublishedNotices(2),
    listRecentPublishedArticles(1),
  ]);

  // 통합 정렬용 리스트 (pinned는 별도 상단 카드로 분리)
  const pool: UpdateItem[] = [];

  // pinned는 별도 상단으로 — 일반 풀에는 넣지 않음 (중복 방지: 같은 notice가 recentNotices에도 있을 수 있음)
  const pinnedIds = new Set(pinnedNotices.map((n) => n.id));

  for (const n of recentNotices) {
    if (pinnedIds.has(n.id)) continue; // pinned는 위에 별도 노출
    pool.push({
      source: 'notice',
      id: n.id,
      href: `/notices/${n.id}`,
      kind: n.kind,
      title: n.title,
      summary: summarizeNoticeBody(n.bodyMarkdown, 60),
      label: NOTICE_KIND_META[n.kind].label,
      labelClass: NOTICE_KIND_CLASSES[n.kind],
      publishedAt: n.publishedAt,
      pinned: false,
    });
  }
  for (const a of recentArticles) {
    pool.push({
      source: 'article',
      id: a.id,
      href: `/help/${a.productCode}/${a.slug}`,
      productCode: a.productCode,
      title: a.title,
      summary: a.summary30s ?? '',
      publishedAt: a.publishedAt,
    });
  }

  // published_at desc 정렬, 최대 3건
  pool.sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });
  const items = pool.slice(0, 3);

  const pinnedItems: UpdateItem[] = pinnedNotices.map((n) => ({
    source: 'notice' as const,
    id: n.id,
    href: `/notices/${n.id}`,
    kind: n.kind,
    title: n.title,
    summary: summarizeNoticeBody(n.bodyMarkdown, 80),
    label: NOTICE_KIND_META[n.kind].label,
    labelClass: NOTICE_KIND_CLASSES[n.kind],
    publishedAt: n.publishedAt,
    pinned: true,
  }));

  const hasContent = pinnedItems.length > 0 || items.length > 0;

  return (
    <section
      aria-labelledby="updates-heading"
      className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
    >
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2
            id="updates-heading"
            className="text-lg font-bold tracking-tight sm:text-xl"
          >
            최근 업데이트
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            최근 공지·릴리즈·가이드를 한눈에 확인하세요.
          </p>
        </div>
        <Link
          href="/notices"
          className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          전체 공지 →
        </Link>
      </div>

      {!hasContent ? (
        <EmptyState
          icon={<Megaphone className="h-6 w-6" />}
          title="아직 발행된 공지/아티클이 없습니다"
          description="매니저가 공지나 핸드북을 작성하면 이 곳에서 최신 업데이트를 확인할 수 있습니다."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {/* pinned 카드 (별도 강조) */}
          {pinnedItems.map((item) =>
            item.source === 'notice' ? (
              <Link
                key={`pinned-${item.id}`}
                href={item.href}
                className="flex flex-col gap-2 rounded-xl border border-brand-300 bg-brand-50/50 p-4 ring-1 ring-brand-200 transition-colors hover:bg-brand-50 dark:border-brand-700 dark:bg-brand-950/30 dark:ring-brand-800/50 dark:hover:bg-brand-950/50"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    <Pin className="h-3 w-3" />
                    고정
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${item.labelClass}`}
                  >
                    {item.label}
                  </span>
                  {item.publishedAt && (
                    <span className="text-xs text-slate-500">
                      {formatDate(item.publishedAt)}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold sm:text-base">
                  {item.title}
                </h3>
                {item.summary && (
                  <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-300 sm:text-sm">
                    {item.summary}
                  </p>
                )}
              </Link>
            ) : null,
          )}

          {/* 일반 3건 */}
          {items.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <li key={`${item.source}-${item.id}`}>
                  <Link
                    href={item.href}
                    className="flex h-full flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:-translate-y-0.5 hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
                  >
                    <div className="flex items-center gap-2">
                      {item.source === 'notice' ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${item.labelClass}`}
                        >
                          {item.label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          가이드 · {item.productCode}
                        </span>
                      )}
                      {item.publishedAt && (
                        <span className="text-xs text-slate-400">
                          {formatDate(item.publishedAt)}
                        </span>
                      )}
                    </div>
                    <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </h3>
                    {item.summary && (
                      <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                        {item.summary}
                      </p>
                    )}
                    <div className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-brand-600 dark:text-brand-400">
                      자세히 보기
                      <ArrowUpRight className="h-3 w-3" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function formatDate(d: Date | string | null): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
