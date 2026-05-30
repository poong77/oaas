'use client';

/**
 * 예약 변경 (overrides) 섹션 — 상태별 리스트 + 신규 예약 폼.
 *
 * 리스트는 상태(scheduled/active/expired/canceled)로 분류해 보여준다.
 * scheduled만 취소 가능 (active는 P3에서 종료일 단축으로 대응).
 */

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Plus,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  cancelBusinessHoursOverrideAction,
  createBusinessHoursOverrideAction,
  shortenActiveOverrideAction,
  type OverrideActionState,
} from '@/app/actions/master-business-hours-actions';
import type { BusinessHoursOverride } from '@/db/schema';
import { todayKst, toHHMM } from '@/lib/business-hours/format';

type Props = {
  overrides: BusinessHoursOverride[];
};

const INITIAL: OverrideActionState = { ok: false };

const KIND_LABEL: Record<BusinessHoursOverride['kind'], string> = {
  short_hours: '단축영업',
  closed: '임시휴무',
  custom: '자유 설정',
};

const STATUS_META: Record<
  BusinessHoursOverride['status'],
  { label: string; tone: 'slate' | 'brand' | 'success' | 'warn' | 'danger' }
> = {
  scheduled: { label: '예약됨', tone: 'brand' },
  active: { label: '진행 중', tone: 'success' },
  expired: { label: '만료', tone: 'slate' },
  canceled: { label: '취소', tone: 'slate' },
};

export function OverridesSection({ overrides }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  const grouped = {
    scheduled: overrides.filter((o) => o.status === 'scheduled'),
    active: overrides.filter((o) => o.status === 'active'),
    expired: overrides.filter((o) => o.status === 'expired'),
    canceled: overrides.filter((o) => o.status === 'canceled'),
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <header className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                <CalendarClock className="h-4 w-4" />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  예약 변경 ({overrides.length}건)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  특정 기간만 단축영업·임시휴무를 적용합니다. 매일 00:01 cron이
                  자동으로 활성화/만료 처리합니다.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant={showForm ? 'outline' : 'default'}
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? '취소' : '신규 예약'}
            </Button>
          </header>

          {showForm && (
            <AddOverrideForm
              onSuccess={() => {
                setShowForm(false);
                router.refresh();
              }}
            />
          )}

          {overrides.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="h-6 w-6" />}
              title="등록된 예약이 없습니다"
              description="설/추석 단축·사옥 점검 임시휴무 등을 미리 예약하면 cron이 자동으로 적용·만료 처리합니다."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {grouped.active.length > 0 && (
                <StatusGroup
                  title="진행 중"
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  rows={grouped.active}
                  shortenable
                />
              )}
              {grouped.scheduled.length > 0 && (
                <StatusGroup
                  title="예약됨"
                  icon={<CalendarClock className="h-3.5 w-3.5" />}
                  rows={grouped.scheduled}
                  cancelable
                />
              )}
              {grouped.expired.length > 0 && (
                <StatusGroup
                  title="만료"
                  icon={<AlertTriangle className="h-3.5 w-3.5" />}
                  rows={grouped.expired}
                  muted
                />
              )}
              {grouped.canceled.length > 0 && (
                <StatusGroup
                  title="취소"
                  icon={<XCircle className="h-3.5 w-3.5" />}
                  rows={grouped.canceled}
                  muted
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 상태 그룹
// ─────────────────────────────────────────────────────────────────

function StatusGroup({
  title,
  icon,
  rows,
  cancelable,
  shortenable,
  muted,
}: {
  title: string;
  icon: React.ReactNode;
  rows: BusinessHoursOverride[];
  cancelable?: boolean;
  shortenable?: boolean;
  muted?: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {icon}
        {title} ({rows.length})
      </h3>
      <ul
        className={
          'divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-700 ' +
          (muted ? 'opacity-60' : '')
        }
      >
        {rows.map((o) => (
          <OverrideRow
            key={o.id}
            override={o}
            cancelable={cancelable}
            shortenable={shortenable}
          />
        ))}
      </ul>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// 행
// ─────────────────────────────────────────────────────────────────

function OverrideRow({
  override,
  cancelable,
  shortenable,
}: {
  override: BusinessHoursOverride;
  cancelable?: boolean;
  shortenable?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [showShorten, setShowShorten] = useState(false);

  const statusMeta = STATUS_META[override.status];

  async function handleCancel() {
    const ok = await confirm({
      title: '예약 변경 취소',
      description: `${override.effectiveFrom} ~ ${override.effectiveUntil} (${override.reason}) 예약을 취소하시겠어요? 적용 전이라 안전하게 되돌릴 수 있습니다.`,
      confirmText: '취소',
      tone: 'danger',
    });
    if (!ok) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.append('id', override.id);
      const result = await cancelBusinessHoursOverrideAction(fd);
      if (result.ok) {
        toast.success('예약이 취소되었습니다');
        router.refresh();
      } else {
        toast.error(result.message ?? '취소 실패');
      }
    });
  }

  async function handleShorten(formData: FormData) {
    const newUntil = ((formData.get('newEffectiveUntil') ?? '') as string).trim();
    if (!newUntil) {
      toast.error('새 종료일을 선택하세요');
      return;
    }
    const ok = await confirm({
      title: '진행 중인 예약 단축',
      description: `종료일을 ${override.effectiveUntil} → ${newUntil}로 단축합니다. 새 종료일이 오늘 이전이면 즉시 만료 처리됩니다.`,
      confirmText: '단축',
      tone: 'danger',
    });
    if (!ok) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.append('id', override.id);
      fd.append('newEffectiveUntil', newUntil);
      const result = await shortenActiveOverrideAction(fd);
      if (result.ok) {
        toast.success(
          result.nowExpired
            ? '예약이 즉시 만료 처리되었습니다'
            : '예약 종료일이 단축되었습니다',
        );
        setShowShorten(false);
        router.refresh();
      } else {
        toast.error(result.message ?? '단축 실패');
      }
    });
  }

  return (
    <li className="flex flex-col gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-900/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
              {override.effectiveFrom} ~ {override.effectiveUntil}
            </code>
            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
            <Badge tone="slate">{KIND_LABEL[override.kind]}</Badge>
            {summarizeTimes(override)}
          </div>
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {override.reason}
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          {shortenable && (
            <Button
              type="button"
              size="sm"
              variant={showShorten ? 'default' : 'outline'}
              onClick={() => setShowShorten((v) => !v)}
              disabled={pending}
            >
              <Clock className="h-4 w-4" />
              {showShorten ? '닫기' : '종료일 단축'}
            </Button>
          )}
          {cancelable && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={pending}
            >
              <X className="h-4 w-4" />
              취소
            </Button>
          )}
        </div>
      </div>
      {shortenable && showShorten && (
        <form
          action={handleShorten}
          className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-900/30"
        >
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-600 dark:text-slate-300">
              새 종료일 (오늘 이전이면 즉시 만료)
            </label>
            <input
              type="date"
              name="newEffectiveUntil"
              max={override.effectiveUntil}
              min={override.effectiveFrom}
              defaultValue={new Date()
                .toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
                .slice(0, 10)}
              required
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            <Clock className="h-4 w-4" />
            {pending ? '적용 중…' : '이 날짜로 단축'}
          </Button>
        </form>
      )}
    </li>
  );
}

function summarizeTimes(o: BusinessHoursOverride): React.ReactNode | null {
  if (o.kind === 'closed') return null;
  const parts: string[] = [];
  if (o.weekdayOpen && o.weekdayClose) {
    parts.push(`${toHHMM(o.weekdayOpen)}~${toHHMM(o.weekdayClose)}`);
  }
  if (o.intakeDeadline) parts.push(`접수${toHHMM(o.intakeDeadline)}`);
  if (parts.length === 0) return null;
  return (
    <span className="font-mono text-[11px] text-slate-500">{parts.join(' · ')}</span>
  );
}


// ─────────────────────────────────────────────────────────────────
// 신규 예약 폼
// ─────────────────────────────────────────────────────────────────

function AddOverrideForm({ onSuccess }: { onSuccess: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    createBusinessHoursOverrideAction,
    INITIAL,
  );
  const [kind, setKind] = useState<BusinessHoursOverride['kind']>('short_hours');

  useEffect(() => {
    if (state.ok) {
      toast.success('예약이 등록되었습니다');
      formRef.current?.reset();
      onSuccess();
    } else if (state.message && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state, onSuccess]);

  const isClosed = kind === 'closed';

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4 rounded-md border border-dashed border-slate-300 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/30"
    >
      <div className="grid gap-3 sm:grid-cols-12">
        <div className="flex flex-col gap-1 sm:col-span-3">
          <Label htmlFor="kind">변경 유형 *</Label>
          <Select
            id="kind"
            name="kind"
            value={kind}
            onChange={(e) =>
              setKind(e.target.value as BusinessHoursOverride['kind'])
            }
          >
            <option value="short_hours">단축영업</option>
            <option value="closed">임시휴무</option>
            <option value="custom">자유 설정</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-3">
          <Label htmlFor="effectiveFrom">시작일 *</Label>
          <Input
            id="effectiveFrom"
            name="effectiveFrom"
            type="date"
            required
            aria-invalid={!!state.fieldErrors?.effectiveFrom}
          />
          {state.fieldErrors?.effectiveFrom && (
            <p className="text-xs text-red-500">
              {state.fieldErrors.effectiveFrom}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1 sm:col-span-3">
          <Label htmlFor="effectiveUntil">종료일 *</Label>
          <Input
            id="effectiveUntil"
            name="effectiveUntil"
            type="date"
            required
            aria-invalid={!!state.fieldErrors?.effectiveUntil}
          />
          {state.fieldErrors?.effectiveUntil && (
            <p className="text-xs text-red-500">
              {state.fieldErrors.effectiveUntil}
            </p>
          )}
        </div>
      </div>

      {!isClosed && (
        <fieldset className="grid gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-5">
          <legend className="px-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            적용 시간 (비워두면 평상시 값 유지)
          </legend>
          <TimeField name="weekdayOpen" label="영업 시작" />
          <TimeField name="weekdayClose" label="영업 종료" />
          <TimeField name="lunchStart" label="점심 시작" />
          <TimeField name="lunchEnd" label="점심 종료" />
          <TimeField name="intakeDeadline" label="접수 마감" />
          {state.fieldErrors?.weekdayOpen && (
            <p className="text-xs text-red-500 sm:col-span-5">
              {state.fieldErrors.weekdayOpen}
            </p>
          )}
          {state.fieldErrors?.weekdayClose && (
            <p className="text-xs text-red-500 sm:col-span-5">
              {state.fieldErrors.weekdayClose}
            </p>
          )}
        </fieldset>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="reason">
          사유 <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="reason"
          name="reason"
          required
          maxLength={200}
          rows={2}
          placeholder="설 연휴 단축영업 / 사옥 점검 임시휴무 등"
          aria-invalid={!!state.fieldErrors?.reason}
        />
        {state.fieldErrors?.reason ? (
          <p className="text-xs text-red-500">{state.fieldErrors.reason}</p>
        ) : (
          <p className="text-xs text-slate-500">200자 이내. 이력에 함께 기록됩니다.</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          <Plus className="h-4 w-4" />
          {pending ? '등록 중…' : '예약 등록'}
        </Button>
      </div>
    </form>
  );
}

function TimeField({ name, label }: { name: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name} className="text-xs">
        {label}
      </Label>
      <Input id={name} name={name} type="time" />
    </div>
  );
}
