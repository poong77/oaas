/**
 * LP-01 Hero 우측 컴팩트 박스.
 *
 * - 상단: 서비스 상태 1줄 (정상이어도 항상 노출)
 * - 하단: 최근 공지/업데이트 2건 (pinned 우선 → 발행 공지 최신순)
 *   가이드 아티클은 노출하지 않는다 — 공지 테이블(공지·릴리즈·장애)만 표시.
 *
 * Hero와 같은 줄에 들어가는 컴팩트 위젯이므로 자체 패딩/배경만 가진다.
 * (전체 섹션의 패딩/배경은 부모 Hero가 담당)
 */

import Link from 'next/link';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ServiceStatusValue } from '@/db/schema';
import {
  SERVICE_STATUS_META,
  type getLatestServiceStatus,
} from '@/lib/services/service-status';
import {
  listPinnedPublishedNotices,
  listRecentPublishedNotices,
} from '@/lib/services/notices';
import {
  NOTICE_KIND_CLASSES,
  NOTICE_KIND_META,
} from '@/lib/services/notices-meta';
import type { NoticeKind } from '@/db/schema';

type LatestStatus = Awaited<ReturnType<typeof getLatestServiceStatus>>;

const ICON_BY_STATUS: Record<ServiceStatusValue, LucideIcon> = {
  normal: CheckCircle2,
  degraded: AlertTriangle,
  incident: AlertOctagon,
  maintenance: Wrench,
};

const STATUS_DOT_CLASS: Record<ServiceStatusValue, string> = {
  normal: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  incident: 'bg-red-500',
  maintenance: 'bg-brand-500',
};

const STATUS_TEXT_CLASS: Record<ServiceStatusValue, string> = {
  normal: 'text-emerald-700 dark:text-emerald-300',
  degraded: 'text-amber-700 dark:text-amber-300',
  incident: 'text-red-700 dark:text-red-300',
  maintenance: 'text-brand-700 dark:text-brand-300',
};

const STATUS_BG_CLASS: Record<ServiceStatusValue, string> = {
  normal:
    'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/30',
  degraded:
    'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30',
  incident:
    'border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/30',
  maintenance:
    'border-brand-200 bg-brand-50/70 dark:border-brand-900/60 dark:bg-brand-950/30',
};

type UpdateItem = {
  source: 'notice';
  id: string;
  href: string;
  label: string;
  labelClass: string;
  title: string;
  publishedAt: Date | string | null;
  pinned: boolean;
};

export async function HomeStatusUpdatesBox({ latest }: { latest: LatestStatus }) {
  // pinned 1 + 최근 공지 → 공지/업데이트만 최대 2건 (가이드 아티클 제외)
  const [pinnedNotices, recentNotices] = await Promise.all([
    listPinnedPublishedNotices(1),
    listRecentPublishedNotices(3),
  ]);

  const pinnedIds = new Set(pinnedNotices.map((n) => n.id));
  const items: UpdateItem[] = [];

  const toItem = (
    n: (typeof pinnedNotices)[number],
    pinned: boolean,
  ): UpdateItem => ({
    source: 'notice',
    id: n.id,
    href: `/notices/${n.id}`,
    label: NOTICE_KIND_META[n.kind as NoticeKind].label,
    labelClass: NOTICE_KIND_CLASSES[n.kind as NoticeKind],
    title: n.title,
    publishedAt: n.publishedAt,
    pinned,
  });

  for (const n of pinnedNotices) {
    items.push(toItem(n, true));
  }

  // pinned 우선 채우고 최근 공지(최신순)로 총 2건
  for (const n of recentNotices) {
    if (items.length >= 2) break;
    if (pinnedIds.has(n.id)) continue;
    items.push(toItem(n, false));
  }
  const shown = items.slice(0, 2);

  const StatusIcon = ICON_BY_STATUS[latest.status];
  const statusMeta = SERVICE_STATUS_META[latest.status];
  const statusMessage =
    latest.message?.trim() ||
    (latest.status === 'normal'
      ? '모든 시스템이 정상 동작 중입니다.'
      : statusMeta.label);

  return (
    <aside
      aria-label="서비스 상태 및 최근 업데이트"
      className="flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:p-5"
    >
      {/* 서비스 상태 (1줄) */}
      <Link
        href="/status"
        className={cn(
          'group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
          STATUS_BG_CLASS[latest.status],
        )}
      >
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm',
            STATUS_DOT_CLASS[latest.status],
          )}
          aria-hidden
        >
          <StatusIcon className="h-4 w-4" />
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={cn(
              'shrink-0 text-label-small-semibold sm:text-label-medium-semibold',
              STATUS_TEXT_CLASS[latest.status],
            )}
          >
            {statusMeta.label}
          </span>
          <span className="truncate text-body-small-regular text-slate-600 dark:text-slate-300 sm:text-body-medium-regular">
            {statusMessage}
          </span>
        </div>
        <ArrowUpRight className="hidden h-3.5 w-3.5 shrink-0 text-slate-400 transition-colors group-hover:text-brand-500 sm:block" />
      </Link>

      {/* 최근 업데이트 — 한 줄 row(칩 + 제목 + 날짜) */}
      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-center text-body-small-regular text-slate-500 dark:border-slate-700 dark:text-slate-400">
          아직 발행된 공지가 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {shown.map((item) => (
            <li key={`${item.source}-${item.id}`}>
              <Link
                href={item.href}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-label-small-semibold',
                    item.labelClass,
                  )}
                >
                  {item.label}
                </span>
                <p className="min-w-0 flex-1 truncate text-body-small-medium text-slate-800 dark:text-slate-100 sm:text-body-medium-medium">
                  {item.title}
                </p>
                {item.publishedAt && (
                  <span className="shrink-0 text-label-small-semibold text-slate-400">
                    {formatDate(item.publishedAt)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function formatDate(d: Date | string | null): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  });
}
