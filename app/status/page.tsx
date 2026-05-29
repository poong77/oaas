/**
 * 공개 서비스 상태 페이지 (/status).
 *
 * - 현재 상태 카드 (큼지막한 색상 표시)
 * - 최근 30일 이력 테이블 (모바일 카드뷰)
 *
 * 비로그인 접근 OK.
 */

import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import {
  getLatestServiceStatus,
  listServiceStatusHistory,
  SERVICE_STATUS_META,
} from '@/lib/services/service-status';
import type { ServiceStatusValue } from '@/db/schema';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: '서비스 상태 — OA 통합 AS',
  description: '실시간 서비스 상태와 최근 이력을 확인하세요.',
};

const ICONS: Record<ServiceStatusValue, LucideIcon> = {
  normal: CheckCircle2,
  degraded: AlertTriangle,
  incident: AlertOctagon,
  maintenance: Wrench,
};

const CONTAINER_CLASS: Record<ServiceStatusValue, string> = {
  normal:
    'border-emerald-300 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30',
  degraded:
    'border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30',
  incident: 'border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30',
  maintenance:
    'border-brand-300 bg-brand-50 dark:border-brand-900/60 dark:bg-brand-950/30',
};

const ICON_CLASS: Record<ServiceStatusValue, string> = {
  normal: 'bg-emerald-600 text-white',
  degraded: 'bg-amber-600 text-white',
  incident: 'bg-red-600 text-white',
  maintenance: 'bg-brand-600 text-white',
};

export default async function PublicServiceStatusPage() {
  const [latest, history] = await Promise.all([
    getLatestServiceStatus(),
    listServiceStatusHistory(50),
  ]);

  const Icon = ICONS[latest.status];
  const meta = SERVICE_STATUS_META[latest.status];
  const summary =
    latest.status === 'normal'
      ? '모든 시스템이 정상 작동 중입니다.'
      : latest.message?.trim() || meta.label;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title="서비스 상태"
        description="OA PMS · CMS · Keyless · 키오스크 · 웹서비스의 실시간 상태를 확인하세요."
      />

      {/* 현재 상태 메인 카드 */}
      <section
        className={cn(
          'flex flex-col gap-4 rounded-2xl border p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8',
          CONTAINER_CLASS[latest.status],
        )}
      >
        <div className="flex items-start gap-4">
          <span
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-md',
              ICON_CLASS[latest.status],
            )}
          >
            <Icon className="h-7 w-7" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
              현재 상태
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 sm:text-2xl">
              {meta.label}
            </h2>
            <p className="max-w-xl text-sm text-slate-700 dark:text-slate-200">
              {summary}
            </p>
            {latest.startedAt && latest.status !== 'normal' && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                시작 {formatDateTime(latest.startedAt)}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 이력 */}
      <section className="flex flex-col gap-3">
        <h3 className="text-base font-bold tracking-tight sm:text-lg">
          최근 이력
        </h3>
        <Card>
          <CardContent className="p-0">
            {history.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<CheckCircle2 className="h-6 w-6" />}
                  title="기록된 변경 이력이 없습니다"
                  description="서비스가 안정적으로 운영되고 있습니다."
                />
              </div>
            ) : (
              <PublicHistoryTable items={history} />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function PublicHistoryTable({
  items,
}: {
  items: Awaited<ReturnType<typeof listServiceStatusHistory>>;
}) {
  return (
    <>
      <ul className="flex flex-col gap-2 p-4 sm:hidden">
        {items.map((s) => {
          const meta = SERVICE_STATUS_META[s.status];
          return (
            <li
              key={s.id}
              className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <Badge tone={meta.tone} className="self-start">
                {meta.emoji} {meta.label}
              </Badge>
              {s.message && (
                <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                  {s.message}
                </p>
              )}
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {formatDateTime(s.startedAt)}
                {s.endedAt ? ` ~ ${formatDateTime(s.endedAt)}` : ''}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
              <th className="px-4 py-2.5">상태</th>
              <th className="px-4 py-2.5">메시지</th>
              <th className="px-4 py-2.5">시작 ~ 종료</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => {
              const meta = SERVICE_STATUS_META[s.status];
              return (
                <tr
                  key={s.id}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                >
                  <td className="px-4 py-3">
                    <Badge tone={meta.tone}>
                      {meta.emoji} {meta.label}
                    </Badge>
                  </td>
                  <td className="max-w-md px-4 py-3 text-slate-700 dark:text-slate-200">
                    {s.message || <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {formatDateTime(s.startedAt)}
                    {s.endedAt ? ` ~ ${formatDateTime(s.endedAt)}` : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
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
