/**
 * 실시간 영업상태 미리보기 카드.
 *
 * 어드민이 운영시간을 수정한 직후 결과를 즉시 확인할 수 있도록 페이지 상단에 표시.
 * 호텔리어 컨택 패널과 동일한 calculateBusinessStatus 결과를 사용 → preview-truth 1:1 보장.
 */

import { CircleDot, Coffee, Moon, OctagonAlert, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BusinessStatusResult } from '@/lib/business-hours/calculate';
import {
  formatDateTimeKst,
  formatRemaining,
  formatTimeKst,
} from '@/lib/business-hours/format';

type Props = {
  status: BusinessStatusResult | null;
};

const STATUS_META: Record<
  BusinessStatusResult['status'],
  { label: string; icon: typeof CircleDot; tone: 'open' | 'soft' | 'warn' | 'closed' }
> = {
  open: { label: '영업 중', icon: CircleDot, tone: 'open' },
  lunch: { label: '점심시간', icon: Coffee, tone: 'soft' },
  intake_closed: { label: '접수 마감 (영업 중)', icon: OctagonAlert, tone: 'warn' },
  closed: { label: '영업 외', icon: Moon, tone: 'closed' },
};

const TONE_CLASS: Record<'open' | 'soft' | 'warn' | 'closed', string> = {
  open: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  soft: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  warn: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  closed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

export function StatusPreview({ status }: Props) {
  if (!status) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-slate-500">
            운영시간이 아직 설정되지 않았습니다. 아래 폼에서 첫 등록을
            진행하세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  const meta = STATUS_META[status.status];
  const Icon = meta.icon;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${TONE_CLASS[meta.tone]}`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                지금 {status.label}
              </span>
              {status.todayHolidayName && status.status !== 'closed' && (
                <Badge tone="warn">{status.todayHolidayName}</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {describe(status)}
            </p>
          </div>
        </div>

        {status.emergencyPhone && status.status === 'closed' && (
          <a
            href={`tel:${status.emergencyPhone.replace(/-/g, '')}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Phone className="h-3.5 w-3.5" />
            긴급 {status.emergencyPhone}
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function describe(s: BusinessStatusResult): string {
  if (s.status === 'open') {
    const intake = s.msUntilIntakeClose;
    const close = s.msUntilClose;
    if (intake !== null && intake > 0) {
      return `접수 마감까지 ${formatRemaining(intake)} · 영업 종료까지 ${formatRemaining(close ?? 0)}`;
    }
    return `영업 종료까지 ${formatRemaining(close ?? 0)}`;
  }
  if (s.status === 'lunch') {
    const next = s.nextOpenAt;
    return next ? `${formatTimeKst(next)} 응대 재개 예정` : '점심시간 중입니다';
  }
  if (s.status === 'intake_closed') {
    return `당일 접수는 마감되었습니다. 영업 종료까지 ${formatRemaining(s.msUntilClose ?? 0)}`;
  }
  // closed
  if (s.nextOpenAt) {
    return `다음 영업: ${formatDateTimeKst(s.nextOpenAt)}`;
  }
  return '다음 영업일을 결정할 수 없습니다 — 정책 확인이 필요합니다';
}
