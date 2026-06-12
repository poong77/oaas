'use client';

/**
 * 공휴일 마스터 섹션 — 리스트 + 인라인 추가 폼 + 개별 삭제.
 *
 * 삭제는 ConfirmDialog로 안전 확인 후 soft delete.
 * 추가는 인라인 폼이 가장 가볍고 사용 흐름이 빠름 (모달 X).
 */

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarOff,
  CalendarPlus,
  Copy,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  createBusinessHolidayAction,
  deactivateBusinessHolidayAction,
  replicateRecurringHolidaysAction,
  type HolidayActionState,
} from '@/app/actions/master-business-hours-actions';
import type { BusinessHoliday } from '@/db/schema';

type Props = {
  holidays: BusinessHoliday[];
  year: number;
};

const INITIAL: HolidayActionState = { ok: false };

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export function HolidaysSection({ holidays, year }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  const recurring = holidays.filter((h) => h.isRecurring);
  const thisYearOnly = holidays.filter((h) => !h.isRecurring && h.date.startsWith(`${year}-`));

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
              <CalendarOff className="h-4 w-4" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                공휴일 ({holidays.length}건)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                양력 매년 반복 {recurring.length}건 · {year}년 한정{' '}
                {thisYearOnly.length}건 (음력·대체공휴일)
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <ReplicateYearButton year={year} recurringCount={recurring.length} />
            <Button
              type="button"
              size="sm"
              variant={showForm ? 'outline' : 'default'}
              onClick={() => setShowForm((v) => !v)}
            >
              <Plus className="h-4 w-4" />
              {showForm ? '취소' : '신규 추가'}
            </Button>
          </div>
        </header>

        {showForm && (
          <AddHolidayForm
            onSuccess={() => {
              setShowForm(false);
              router.refresh();
            }}
          />
        )}

        {holidays.length === 0 ? (
          <EmptyState
            icon={<CalendarOff className="h-6 w-6" />}
            title="등록된 공휴일이 없습니다"
            description="신규 추가 버튼으로 첫 공휴일을 등록하세요. 시드 실행이 누락된 경우 npm run db:seed로 19종을 일괄 등록할 수 있습니다."
          />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {holidays.map((h) => (
              <HolidayRow key={h.id} holiday={h} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// 내년 양력 공휴일 일괄 복제 버튼 (P3)
// ─────────────────────────────────────────────────────────────────

function ReplicateYearButton({
  year,
  recurringCount,
}: {
  year: number;
  recurringCount: number;
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const nextYear = year + 1;

  async function handleClick() {
    if (recurringCount === 0) {
      toast.error('매년 반복 공휴일이 없어 복제할 항목이 없습니다');
      return;
    }
    const ok = await confirm({
      title: `${nextYear}년 양력 공휴일 자동 등록`,
      description: `현재 등록된 양력 공휴일(매년 반복 ${recurringCount}건)을 ${nextYear}년 같은 월·일로 일괄 추가합니다. 이미 같은 날짜가 등록된 경우 건너뜁니다. 음력·대체공휴일은 매년 날짜가 바뀌므로 자동 대상이 아닙니다.`,
      confirmText: `${nextYear}년 등록`,
    });
    if (!ok) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.append('targetYear', String(nextYear));
      const result = await replicateRecurringHolidaysAction(fd);
      if (result.ok) {
        toast.success(
          `${nextYear}년 등록 완료 — 신규 ${result.created ?? 0}건 / 스킵 ${result.skipped ?? 0}건`,
        );
        router.refresh();
      } else {
        toast.error(result.message ?? '복제 실패');
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={pending}
      title={`${nextYear}년 양력 공휴일 자동 등록`}
    >
      <Copy className="h-4 w-4" />
      {pending ? '등록 중…' : `${nextYear}년 자동 등록`}
    </Button>
  );
}

// ─────────────────────────────────────────────────────────────────
// 추가 폼 (인라인)
// ─────────────────────────────────────────────────────────────────

function AddHolidayForm({ onSuccess }: { onSuccess: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    createBusinessHolidayAction,
    INITIAL,
  );

  useEffect(() => {
    if (state.ok) {
      toast.success('공휴일이 추가되었습니다');
      formRef.current?.reset();
      onSuccess();
    } else if (state.message && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state, onSuccess]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/30 sm:grid-cols-12"
    >
      <div className="flex flex-col gap-1 sm:col-span-3">
        <Label htmlFor="date">날짜 *</Label>
        <Input
          id="date"
          name="date"
          type="date"
          required
          aria-invalid={!!state.fieldErrors?.date}
        />
        {state.fieldErrors?.date && (
          <p className="text-xs text-red-500">{state.fieldErrors.date}</p>
        )}
      </div>

      <div className="flex flex-col gap-1 sm:col-span-5">
        <Label htmlFor="name">이름 *</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={60}
          placeholder="신정 / 설날 연휴 / 대체공휴일 등"
          aria-invalid={!!state.fieldErrors?.name}
        />
        {state.fieldErrors?.name && (
          <p className="text-xs text-red-500">{state.fieldErrors.name}</p>
        )}
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2">
        <Label htmlFor="isRecurring">매년 반복</Label>
        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 text-sm dark:border-slate-700">
          <input
            type="checkbox"
            id="isRecurring"
            name="isRecurring"
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
          />
          <RefreshCw className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          <span className="text-xs text-slate-600 dark:text-slate-300">
            양력 공휴일
          </span>
        </label>
      </div>

      <div className="flex items-end sm:col-span-2">
        <Button type="submit" disabled={pending} className="w-full">
          <CalendarPlus className="h-4 w-4" />
          {pending ? '추가 중…' : '추가'}
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────
// 리스트 행
// ─────────────────────────────────────────────────────────────────

function HolidayRow({ holiday }: { holiday: BusinessHoliday }) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();

  const weekday = WEEKDAY_LABELS[new Date(holiday.date).getUTCDay()];

  async function handleDelete() {
    const ok = await confirm({
      title: '공휴일 삭제',
      description: `${holiday.date} (${holiday.name})을(를) 삭제하시겠어요? 비활성 처리되며 같은 날짜에 다시 등록할 수 있습니다.`,
      confirmText: '삭제',
      tone: 'danger',
    });
    if (!ok) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.append('id', holiday.id);
      const result = await deactivateBusinessHolidayAction(fd);
      if (result.ok) {
        toast.success('삭제되었습니다');
        router.refresh();
      } else {
        toast.error(result.message ?? '삭제 실패');
      }
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-900/40">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <code className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
          {holiday.date}
        </code>
        <Badge tone="slate">({weekday})</Badge>
        <span className="truncate text-sm text-slate-700 dark:text-slate-200">
          {holiday.name}
        </span>
        {holiday.isRecurring && (
          <Badge tone="brand">
            <RefreshCw className="mr-1 h-3 w-3" />
            매년 반복
          </Badge>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleDelete}
        disabled={pending}
        aria-label={`${holiday.date} 삭제`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}
