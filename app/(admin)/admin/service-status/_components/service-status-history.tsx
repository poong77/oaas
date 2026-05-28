/**
 * 서비스 상태 변경 이력 테이블.
 *
 * 데스크탑: 테이블 / 모바일: 카드뷰 (dev-rules.md §4).
 */

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { type ServiceStatus } from '@/lib/services/service-status';
import { SERVICE_STATUS_META } from '@/lib/services/service-status-meta';
import { Activity } from 'lucide-react';

export function ServiceStatusHistory({
  items,
}: {
  items: ServiceStatus[];
}) {
  if (items.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Activity className="h-6 w-6" />}
          title="아직 변경 이력이 없습니다"
          description="상태 변경 시 자동으로 이력이 추가됩니다."
        />
      </div>
    );
  }

  return (
    <>
      {/* 모바일 카드뷰 */}
      <ul className="flex flex-col gap-2 p-4 sm:hidden">
        {items.map((s) => {
          const meta = SERVICE_STATUS_META[s.status];
          return (
            <li
              key={s.id}
              className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <Badge tone={meta.tone}>
                  {meta.emoji} {meta.label}
                </Badge>
                <span className="text-xs text-slate-500">
                  {!s.isActive && s.endedAt
                    ? '종료'
                    : s.isActive
                      ? '활성'
                      : '-'}
                </span>
              </div>
              {s.message && (
                <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                  {s.message}
                </p>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                <span>시작 {formatDateTime(s.startedAt)}</span>
                {s.endedAt && <span>종료 {formatDateTime(s.endedAt)}</span>}
              </div>
            </li>
          );
        })}
      </ul>

      {/* 데스크탑 테이블 */}
      <div className="hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                <th className="px-4 py-2.5">상태</th>
                <th className="px-4 py-2.5">메시지</th>
                <th className="px-4 py-2.5">시작</th>
                <th className="px-4 py-2.5">종료</th>
                <th className="px-4 py-2.5">활성</th>
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
                      {s.message || (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(s.startedAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {s.endedAt ? formatDateTime(s.endedAt) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {s.isActive ? (
                        <Badge tone="success">활성</Badge>
                      ) : (
                        <Badge tone="slate">종료</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function formatDateTime(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
