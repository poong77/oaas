/**
 * 매니저/어드민용 서비스 상태 변경 페이지.
 *
 * - 현재 상태 카드
 * - 상태 변경 폼 (라디오 + 메시지)
 * - 변경 이력 (최근 20건)
 *
 * 권한: manager + admin (admin layout이 이미 둘 다 허용).
 * activity_logs는 service-status-actions.ts에서 fire-and-forget 기록.
 */

import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getLatestServiceStatus,
  listServiceStatusHistory,
  SERVICE_STATUS_META,
} from '@/lib/services/service-status';
import { requireRole } from '@/lib/permissions';
import { ServiceStatusForm } from './_components/service-status-form';
import { ServiceStatusHistory } from './_components/service-status-history';

export const dynamic = 'force-dynamic';
export const metadata = { title: '서비스 상태 — OA 통합 AS 어드민' };

export default async function AdminServiceStatusPage() {
  await requireRole(['manager', 'admin']);
  const [latest, history] = await Promise.all([
    getLatestServiceStatus(),
    listServiceStatusHistory(20),
  ]);

  const meta = SERVICE_STATUS_META[latest.status];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="서비스 상태 관리"
        guideAnchor="master"
        description="홈/긴급 배너에 노출되는 서비스 상태를 관리합니다. 변경 시 모든 사용자에게 즉시 반영됩니다."
      />

      {/* 현재 상태 카드 */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              현재 상태
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={meta.tone}>
                {meta.emoji} {meta.label}
              </Badge>
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {latest.message?.trim() || '메시지 없음'}
              </span>
            </div>
            {latest.startedAt && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                시작 {formatDateTime(latest.startedAt)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 상태 변경 폼 */}
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold">상태 변경</h2>
          <ServiceStatusForm
            current={{
              status: latest.status,
              message: latest.message ?? '',
            }}
          />
        </CardContent>
      </Card>

      {/* 이력 */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-sm font-semibold">변경 이력</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              최근 {history.length}건 표시. 신규 변경 시 자동 추가됩니다.
            </p>
          </div>
          <ServiceStatusHistory items={history} />
        </CardContent>
      </Card>
    </div>
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
