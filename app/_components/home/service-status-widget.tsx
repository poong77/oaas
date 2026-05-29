/**
 * LP-01 ⑥ 서비스 상태 위젯 (LP-03).
 *
 * 최신 상태에 따라 카드 색·아이콘·메시지 변경.
 * 상태 페이지(/status)로 자세히 보기 링크.
 */

import Link from 'next/link';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  SERVICE_STATUS_META,
  type getLatestServiceStatus,
} from '@/lib/services/service-status';
import { cn } from '@/lib/utils';

type LatestStatus = Awaited<ReturnType<typeof getLatestServiceStatus>>;

const ICON_BY_STATUS: Record<LatestStatus['status'], LucideIcon> = {
  normal: CheckCircle2,
  degraded: AlertTriangle,
  incident: AlertOctagon,
  maintenance: Wrench,
};

const CONTAINER_BY_STATUS: Record<LatestStatus['status'], string> = {
  normal:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200',
  degraded:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200',
  incident:
    'border-red-300 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200',
  maintenance:
    'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900/60 dark:bg-brand-950/30 dark:text-brand-200',
};

const ICON_TONE_BY_STATUS: Record<LatestStatus['status'], string> = {
  normal: 'text-emerald-600 dark:text-emerald-300',
  degraded: 'text-amber-600 dark:text-amber-300',
  incident: 'text-red-600 dark:text-red-300',
  maintenance: 'text-brand-600 dark:text-brand-300',
};

export function ServiceStatusWidget({ latest }: { latest: LatestStatus }) {
  const Icon = ICON_BY_STATUS[latest.status];
  const meta = SERVICE_STATUS_META[latest.status];
  const messageDefault =
    latest.status === 'normal'
      ? '모든 서비스가 정상 동작하고 있습니다.'
      : latest.status === 'degraded'
        ? '일부 기능에 제한이 있습니다.'
        : latest.status === 'incident'
          ? '서비스 장애가 발생했습니다.'
          : '예정된 점검이 진행 중입니다.';

  return (
    <section
      aria-labelledby="service-status-heading"
      className="bg-slate-50/60 py-8 dark:bg-slate-900/40 sm:py-10"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2
              id="service-status-heading"
              className="text-lg font-bold tracking-tight sm:text-xl"
            >
              서비스 상태
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
              현재 운영 중인 서비스의 상태를 실시간으로 안내합니다.
            </p>
          </div>
          <Link
            href="/status"
            className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            이력 보기 →
          </Link>
        </div>

        <div
          className={cn(
            'flex flex-col gap-3 rounded-xl border p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between',
            CONTAINER_BY_STATUS[latest.status],
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm dark:bg-slate-900',
                ICON_TONE_BY_STATUS[latest.status],
              )}
              aria-hidden
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold sm:text-base">
                {meta.label}
              </span>
              <p className="text-sm leading-relaxed">
                {(latest.message?.trim() || messageDefault)}
              </p>
              {latest.startedAt && latest.status !== 'normal' && (
                <span className="text-xs opacity-80">
                  시작 {formatDateTime(latest.startedAt)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatDateTime(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
