'use client';

/**
 * 현재 운영시간 편집 폼.
 *
 * defaults가 null이면 첫 등록 모드 — 시드 기본값 placeholder로 표시.
 * 저장 성공 시 router.refresh()로 페이지 데이터 + StatusPreview 즉시 갱신.
 *
 * P3 정리(2026-05-30): 연락처 5필드(대표전화·이메일·ARS·Fax·웹) 입력 추가.
 * 호텔리어 ContactPanel과 동일한 단일 소스.
 */

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, X } from 'lucide-react';
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
import type { ArsItem } from '@/lib/business-hours/calculate';
import { toHHMM } from '@/lib/business-hours/format';

type Props = {
  defaults: BusinessHoursDefault | null;
};

const INITIAL: BusinessHoursDefaultState = { ok: false };

export function BusinessHoursForm({ defaults }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateBusinessHoursDefaultAction,
    INITIAL,
  );
  const [arsItems, setArsItems] = useState<ArsItem[]>(
    Array.isArray(defaults?.arsItems) ? (defaults!.arsItems as ArsItem[]) : [],
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
          defaultValue={toHHMM(defaults?.weekdayOpen) || '10:00'}
          type="time"
          error={state.fieldErrors?.weekdayOpen}
          help="평일 영업을 시작하는 시각"
        />
        <Field
          id="weekdayClose"
          label="평일 영업 종료"
          required
          defaultValue={toHHMM(defaults?.weekdayClose) || '18:40'}
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
          defaultValue={toHHMM(defaults?.lunchStart)}
          type="time"
          error={state.fieldErrors?.lunchStart}
          help="점심시간 없으면 비워두세요"
        />
        <Field
          id="lunchEnd"
          label="점심 종료"
          defaultValue={toHHMM(defaults?.lunchEnd)}
          type="time"
          error={state.fieldErrors?.lunchEnd}
          help="점심시간 끝나는 시각"
        />
      </section>

      {/* 접수 마감 */}
      <Field
        id="intakeDeadline"
        label="접수 마감 시각"
        defaultValue={toHHMM(defaults?.intakeDeadline)}
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

      {/* 연락처 (대표전화·이메일·ARS·Fax·웹) — P3 정리 */}
      <fieldset className="rounded-md border border-slate-200 p-4 dark:border-slate-700">
        <legend className="px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
          연락처 정보 (호텔리어 ContactPanel·푸터에 노출)
        </legend>
        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          <Field
            id="mainPhone"
            label="대표전화"
            defaultValue={defaults?.mainPhone ?? ''}
            placeholder="1833-4702"
            error={state.fieldErrors?.mainPhone}
            help="비워두면 패널에서 숨겨집니다"
          />
          <Field
            id="mainEmail"
            label="대표 이메일"
            defaultValue={defaults?.mainEmail ?? ''}
            placeholder="as@oapms.com"
            error={state.fieldErrors?.mainEmail}
          />
          <Field
            id="faxNumber"
            label="Fax"
            defaultValue={defaults?.faxNumber ?? ''}
            placeholder="0505-300-4702"
            error={state.fieldErrors?.faxNumber}
            help="footer에만 표시"
          />
          <Field
            id="websiteUrl"
            label="회사 웹사이트"
            defaultValue={defaults?.websiteUrl ?? ''}
            placeholder="www.oapms.com"
            error={state.fieldErrors?.websiteUrl}
            help="footer에만 표시"
          />
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Label>ARS 메뉴 (대표전화 안내)</Label>
          <input
            type="hidden"
            name="arsItems"
            value={JSON.stringify(arsItems)}
          />
          {arsItems.length === 0 && (
            <p className="text-xs text-slate-500">
              "+ 항목 추가"로 1번·2번·3번 등을 등록하세요. ContactPanel에 자동 노출됩니다.
            </p>
          )}
          {arsItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={item.num}
                onChange={(e) => {
                  const next = [...arsItems];
                  next[idx] = { ...item, num: e.target.value };
                  setArsItems(next);
                }}
                className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="1"
                maxLength={4}
              />
              <input
                type="text"
                value={item.label}
                onChange={(e) => {
                  const next = [...arsItems];
                  next[idx] = { ...item, label: e.target.value };
                  setArsItems(next);
                }}
                className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="시스템 사용 문의"
                maxLength={60}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setArsItems(arsItems.filter((_, i) => i !== idx))
                }
                aria-label={`${item.num}번 삭제`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setArsItems([
                ...arsItems,
                { num: String(arsItems.length + 1), label: '' },
              ])
            }
            disabled={arsItems.length >= 10}
            className="self-start"
          >
            <Plus className="h-3.5 w-3.5" />
            항목 추가
          </Button>
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
