'use client';

/**
 * 현재 운영시간 편집 폼.
 *
 * defaults가 null이면 첫 등록 모드 — 시드 기본값 placeholder로 표시.
 * 저장 성공 시 router.refresh()로 페이지 데이터 + StatusPreview 즉시 갱신.
 */

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  updateBusinessHoursDefaultAction,
  type BusinessHoursDefaultState,
} from '@/app/actions/master-business-hours-actions';
import type { BusinessHoursDefault } from '@/db/schema';

type Props = {
  defaults: BusinessHoursDefault | null;
};

const INITIAL: BusinessHoursDefaultState = { ok: false };

// PostgreSQL time 타입은 'HH:MM:SS' 형식으로 오므로 input[type=time]에 맞게 'HH:MM'으로 자른다.
function trim(t: string | null | undefined): string {
  if (!t) return '';
  return t.slice(0, 5);
}

export function BusinessHoursForm({ defaults }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateBusinessHoursDefaultAction,
    INITIAL,
  );

  useEffect(() => {
    if (state.ok) {
      toast.success('운영시간이 저장되었습니다');
      router.refresh();
    } else if (state.message && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* 평일 영업 */}
      <section className="grid gap-3 sm:grid-cols-2">
        <Field
          id="weekdayOpen"
          label="평일 영업 시작"
          required
          defaultValue={trim(defaults?.weekdayOpen) || '10:00'}
          type="time"
          error={state.fieldErrors?.weekdayOpen}
          help="평일 영업을 시작하는 시각"
        />
        <Field
          id="weekdayClose"
          label="평일 영업 종료"
          required
          defaultValue={trim(defaults?.weekdayClose) || '18:40'}
          type="time"
          error={state.fieldErrors?.weekdayClose}
          help="평일 영업이 끝나는 시각"
        />
      </section>

      {/* 점심시간 */}
      <section className="grid gap-3 sm:grid-cols-2">
        <Field
          id="lunchStart"
          label="점심 시작"
          defaultValue={trim(defaults?.lunchStart)}
          type="time"
          error={state.fieldErrors?.lunchStart}
          help="점심시간 없으면 비워두세요"
        />
        <Field
          id="lunchEnd"
          label="점심 종료"
          defaultValue={trim(defaults?.lunchEnd)}
          type="time"
          error={state.fieldErrors?.lunchEnd}
          help="점심시간 끝나는 시각"
        />
      </section>

      {/* 접수 마감 */}
      <Field
        id="intakeDeadline"
        label="접수 마감 시각"
        defaultValue={trim(defaults?.intakeDeadline)}
        type="time"
        error={state.fieldErrors?.intakeDeadline}
        help="영업 종료보다 빠를 수 있습니다 (예: 18:00 마감, 18:40 종료)"
      />

      {/* 휴무 정책 */}
      <fieldset className="rounded-md border border-slate-200 p-4 dark:border-slate-700">
        <legend className="px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
          휴무 정책
        </legend>
        <div className="flex flex-col gap-2 pt-2">
          <Checkbox
            id="saturdayClosed"
            label="토요일 휴무"
            defaultChecked={defaults?.saturdayClosed ?? true}
          />
          <Checkbox
            id="sundayClosed"
            label="일요일 휴무"
            defaultChecked={defaults?.sundayClosed ?? true}
          />
          <Checkbox
            id="holidaysClosed"
            label="공휴일 자동 휴무 (아래 공휴일 목록 기준)"
            defaultChecked={defaults?.holidaysClosed ?? true}
          />
        </div>
      </fieldset>

      {/* 긴급전화 */}
      <fieldset className="rounded-md border border-slate-200 p-4 dark:border-slate-700">
        <legend className="px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
          영업시간 외 긴급전화
        </legend>
        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          <Field
            id="emergencyPhone"
            label="긴급전화 번호"
            defaultValue={defaults?.emergencyPhone ?? ''}
            placeholder="070-8028-0919"
            error={state.fieldErrors?.emergencyPhone}
            help="비워두면 패널에서 숨겨집니다"
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="emergencyNote">안내문구</Label>
            <Textarea
              id="emergencyNote"
              name="emergencyNote"
              defaultValue={defaults?.emergencyNote ?? ''}
              placeholder="단순 금액 정정 불가"
              maxLength={200}
              rows={2}
              aria-invalid={!!state.fieldErrors?.emergencyNote}
            />
            <p className="text-xs text-slate-500">200자 이내</p>
          </div>
        </div>
      </fieldset>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="submit" disabled={pending}>
          <Save className="h-4 w-4" />
          {pending ? '저장 중…' : '저장'}
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────

function Field({
  id,
  label,
  required,
  defaultValue,
  type = 'text',
  placeholder,
  error,
  help,
}: {
  id: string;
  label: string;
  required?: boolean;
  defaultValue: string;
  type?: string;
  placeholder?: string;
  error?: string;
  help?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Input
        id={id}
        name={id}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        aria-invalid={!!error}
      />
      {error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : help ? (
        <p className="text-xs text-slate-500">{help}</p>
      ) : null}
    </div>
  );
}

function Checkbox({
  id,
  label,
  defaultChecked,
}: {
  id: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
      <input
        type="checkbox"
        id={id}
        name={id}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
      />
      <span>{label}</span>
    </label>
  );
}
