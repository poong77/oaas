/**
 * 변경 이력 섹션 — activity_logs 중 business_hours.* 액션 필터 뷰.
 *
 * 시간 역순 표시. payload 요약 + 사용자 ID (P3에서 name join 보강).
 * cron 자동 액션(applied/expired)은 시스템 마크.
 */

import {
  Bell,
  CalendarPlus,
  CalendarX,
  Clock,
  Copy,
  History,
  PauseOctagon,
  PlayCircle,
  Scissors,
  Settings2,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import type { BusinessHoursActivityLogRow } from '@/lib/services/business-hours';

type Props = {
  logs: BusinessHoursActivityLogRow[];
};

const ACTION_META: Record<
  string,
  { label: string; icon: LucideIcon; tone: 'brand' | 'success' | 'slate' | 'warn' | 'danger' }
> = {
  'business_hours.default.update': {
    label: '운영시간 수정',
    icon: Settings2,
    tone: 'brand',
  },
  'business_hours.default.create': {
    label: '운영시간 신규 등록',
    icon: Settings2,
    tone: 'brand',
  },
  'business_hours.holiday.create': {
    label: '공휴일 추가',
    icon: CalendarPlus,
    tone: 'slate',
  },
  'business_hours.holiday.delete': {
    label: '공휴일 삭제',
    icon: CalendarX,
    tone: 'warn',
  },
  'business_hours.holiday.replicate': {
    label: '양력 공휴일 일괄 복제',
    icon: Copy,
    tone: 'brand',
  },
  'business_hours.override.create': {
    label: '예약 변경 등록',
    icon: PlayCircle,
    tone: 'brand',
  },
  'business_hours.override.cancel': {
    label: '예약 변경 취소',
    icon: XCircle,
    tone: 'danger',
  },
  'business_hours.override.applied': {
    label: '예약 자동 적용',
    icon: PlayCircle,
    tone: 'success',
  },
  'business_hours.override.expired': {
    label: '예약 자동 만료',
    icon: PauseOctagon,
    tone: 'slate',
  },
  'business_hours.override.shorten': {
    label: '진행 중 예약 단축',
    icon: Scissors,
    tone: 'warn',
  },
  'business_hours.override.reminder_sent': {
    label: '슬랙 사전 알림 (24h 전)',
    icon: Bell,
    tone: 'slate',
  },
};

export function HistorySection({ logs }: Props) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <header className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
            <History className="h-4 w-4" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              변경 이력 (최근 {logs.length}건)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              운영시간·공휴일·예약 변경의 모든 액션 (cron 자동 액션 포함). 최대
              100건까지 표시.
            </p>
          </div>
        </header>

        {logs.length === 0 ? (
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title="이력이 없습니다"
            description="운영시간을 수정하거나 공휴일/예약을 추가하면 여기에 기록됩니다."
          />
        ) : (
          <ol className="relative ml-3 border-l border-slate-200 dark:border-slate-700">
            {logs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function LogRow({ log }: { log: BusinessHoursActivityLogRow }) {
  const meta = ACTION_META[log.action] ?? {
    label: log.action,
    icon: Clock,
    tone: 'slate' as const,
  };
  const Icon = meta.icon;
  const isSystem = log.userId === null;

  return (
    <li className="mb-4 ml-4 last:mb-0">
      <span className="absolute -left-[10px] flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <Icon className="h-3 w-3 text-slate-500" />
      </span>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {meta.label}
          </span>
          <Badge tone={meta.tone}>{log.action.split('.').slice(1).join('.')}</Badge>
          {isSystem && <Badge tone="slate">시스템</Badge>}
          <time className="text-xs text-slate-500">
            {formatLogTime(log.createdAt)}
          </time>
        </div>
        {summarizePayload(log) && (
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {summarizePayload(log)}
          </p>
        )}
        {!isSystem && (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {log.userName ? (
              <>by <strong className="font-medium text-slate-700 dark:text-slate-300">{log.userName}</strong></>
            ) : log.userId ? (
              <code className="font-mono text-slate-400">
                user:{log.userId.slice(0, 8)}…
              </code>
            ) : null}
          </span>
        )}
      </div>
    </li>
  );
}

function formatLogTime(d: Date): string {
  return new Date(d).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function summarizePayload(log: BusinessHoursActivityLogRow): string | null {
  const p = log.payload as Record<string, unknown>;

  if (log.action === 'business_hours.default.update') {
    const before = p.before as Record<string, unknown> | null;
    const after = p.after as Record<string, unknown> | null;
    if (!before || !after) return null;
    const diffs: string[] = [];
    const keys: (keyof typeof after)[] = [
      'weekdayOpen',
      'weekdayClose',
      'lunchStart',
      'lunchEnd',
      'intakeDeadline',
    ];
    for (const k of keys) {
      if (before[k] !== after[k]) {
        diffs.push(`${labelFor(k)}: ${before[k] ?? '—'} → ${after[k] ?? '—'}`);
      }
    }
    return diffs.length > 0 ? diffs.join(' · ') : '변경 사항 없음';
  }

  if (log.action === 'business_hours.holiday.replicate') {
    const yr = p.targetYear as number | undefined;
    const created = p.created as number | undefined;
    const skipped = p.skipped as number | undefined;
    return yr !== undefined
      ? `${yr}년 양력 공휴일 ${created ?? 0}건 신규 / ${skipped ?? 0}건 스킵`
      : null;
  }

  if (log.action.startsWith('business_hours.holiday.')) {
    const date = p.date as string | undefined;
    const name = p.name as string | undefined;
    return date && name ? `${date} ${name}` : null;
  }

  if (log.action === 'business_hours.override.shorten') {
    const prevUntil = p.previousUntil as string | undefined;
    const newUntil = p.newUntil as string | undefined;
    const reason = p.reason as string | undefined;
    const nowExpired = p.nowExpired as boolean | undefined;
    return prevUntil && newUntil
      ? `종료일 ${prevUntil} → ${newUntil}${nowExpired ? ' (즉시 만료)' : ''}${reason ? ` · ${reason}` : ''}`
      : null;
  }

  if (log.action === 'business_hours.override.reminder_sent') {
    const tomorrow = p.tomorrow as string | undefined;
    const slackOk = p.slackOk as boolean | undefined;
    const stub = p.stub as boolean | undefined;
    return tomorrow
      ? `내일(${tomorrow}) 적용 예정 · slack ${slackOk ? (stub ? 'stub' : 'OK') : 'FAIL'}`
      : null;
  }

  if (log.action.startsWith('business_hours.override.')) {
    const from = p.effectiveFrom as string | undefined;
    const until = p.effectiveUntil as string | undefined;
    const reason = p.reason as string | undefined;
    if (log.action === 'business_hours.override.applied' || log.action === 'business_hours.override.expired') {
      const trigger = p.trigger as string | undefined;
      return trigger === 'cron' ? `cron 자동 처리 (${p.today as string})` : null;
    }
    return from && until ? `${from} ~ ${until}${reason ? ` · ${reason}` : ''}` : null;
  }

  return null;
}

function labelFor(key: string): string {
  switch (key) {
    case 'weekdayOpen':
      return '운영 시작';
    case 'weekdayClose':
      return '운영 종료';
    case 'lunchStart':
      return '점심 시작';
    case 'lunchEnd':
      return '점심 종료';
    case 'intakeDeadline':
      return '접수 마감';
    default:
      return key;
  }
}
