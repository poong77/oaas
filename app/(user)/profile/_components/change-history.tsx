'use client';

/**
 * 변경이력 탭 (2026-06-11).
 *
 * 리스트는 간단하게(일자 · 담당자 · 변경항목), 행 클릭 시 팝업으로 상세 표시.
 * 데이터는 본인 호텔 구성원이 수행한 데이터 수정 이력(activity_logs).
 */
import { useState } from 'react';
import { History, X } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { HotelActivityLog } from '@/lib/services/activity-logs';

const ACTION_LABEL: Record<string, string> = {
  'user.update': '직원/계정 정보 수정',
  'user.create': '직원 추가',
  'user.activate': '계정 활성화',
  'user.deactivate': '계정 비활성화',
  'user.password_change': '비밀번호 변경',
  'user.password_reset': '비밀번호 초기화',
  'solution_link.upsert': '솔루션 링크 등록/수정',
  'solution_link.delete': '솔루션 링크 삭제',
};

function actionLabel(log: HotelActivityLog): string {
  const base = ACTION_LABEL[log.action] ?? log.action;
  // 본인 정보 수정과 직원 수정 구분
  if (log.action === 'user.update') {
    const mode = (log.payload?.mode as string) ?? '';
    if (mode === 'staff_edit') return '직원 정보 수정';
    return '내 정보 수정';
  }
  return base;
}

function fmt(d: Date): string {
  const dt = new Date(d);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

export function ChangeHistory({ logs }: { logs: HotelActivityLog[] }) {
  const [selected, setSelected] = useState<HotelActivityLog | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>변경이력</CardTitle>
        <CardDescription>
          우리 호텔 계정·솔루션 링크 등 데이터 수정 이력입니다. 행을 누르면 상세를 볼 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title="변경이력이 없습니다"
            description="데이터 수정이 발생하면 이곳에 기록됩니다."
          />
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-800">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
                <tr>
                  <th className="w-[140px] px-3 py-2 text-left font-medium">일자</th>
                  <th className="w-[110px] px-3 py-2 text-left font-medium">담당자</th>
                  <th className="px-3 py-2 text-left font-medium">변경항목</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelected(log)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="truncate px-3 py-2.5 text-slate-500 dark:text-slate-400">
                      {fmt(log.createdAt)}
                    </td>
                    <td className="truncate px-3 py-2.5">{log.actorName ?? '-'}</td>
                    <td className="truncate px-3 py-2.5">{actionLabel(log)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* 상세 팝업 */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                변경 상세
              </h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="flex flex-col gap-2.5 text-sm">
              <Detail label="일자" value={fmt(selected.createdAt)} />
              <Detail label="담당자" value={selected.actorName ?? '-'} />
              <Detail label="변경항목" value={actionLabel(selected)} />
              <Detail label="대상" value={selected.targetType ?? '-'} />
              <div className="flex flex-col gap-1">
                <dt className="text-slate-500 dark:text-slate-400">상세 데이터</dt>
                <dd>
                  <pre className="overflow-x-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {JSON.stringify(selected.payload ?? {}, null, 2)}
                  </pre>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-2">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="break-words text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}
