'use server';

/**
 * Server Actions — 운영시간 마스터 (business_hours_default + business_holidays).
 *
 * 권한: 어드민만.
 * 캐시: 모든 쓰기에서 revalidateTag('business-hours') (호텔리어 패널이 구독 예정).
 * Audit log: lib/services/business-hours.ts 내부에서 fire-and-forget 호출.
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@/lib/permissions';
import {
  cancelBusinessHoursOverride,
  createBusinessHoliday,
  createBusinessHoursOverride,
  deactivateBusinessHoliday,
  replicateRecurringHolidaysForYear,
  shortenActiveOverride,
  upsertBusinessHoursDefault,
} from '@/lib/services/business-hours';
import {
  DEFAULT_STATE_ICONS,
  STATE_ICON_MAP,
  type StateIcons,
} from '@/lib/business-hours/state-icons';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-(0\d|1[0-2])-(0\d|[12]\d|3[01])$/;

// ─────────────────────────────────────────────────────────────────
// business_hours_default
// ─────────────────────────────────────────────────────────────────

const ArsItemSchema = z.object({
  num: z.string().min(1).max(4),
  label: z.string().min(1).max(60),
});

/** 화이트리스트에 있는 아이콘 이름만 허용 */
const IconNameSchema = z
  .string()
  .refine((v) => Object.prototype.hasOwnProperty.call(STATE_ICON_MAP, v), {
    message: '허용되지 않은 아이콘',
  });

const StateIconsSchema = z.object({
  open: IconNameSchema,
  lunch: IconNameSchema,
  intake_closed: IconNameSchema,
  closed: IconNameSchema,
});

const DefaultSchema = z
  .object({
    weekdayOpen: z.string().regex(TIME_REGEX, 'HH:MM 형식'),
    weekdayClose: z.string().regex(TIME_REGEX, 'HH:MM 형식'),
    lunchStart: z
      .string()
      .regex(TIME_REGEX, 'HH:MM 형식')
      .or(z.literal(''))
      .nullable(),
    lunchEnd: z
      .string()
      .regex(TIME_REGEX, 'HH:MM 형식')
      .or(z.literal(''))
      .nullable(),
    intakeDeadline: z
      .string()
      .regex(TIME_REGEX, 'HH:MM 형식')
      .or(z.literal(''))
      .nullable(),
    saturdayClosed: z.boolean(),
    sundayClosed: z.boolean(),
    holidaysClosed: z.boolean(),
    emergencyPhone: z.string().max(40).nullable(),
    emergencyNote: z.string().max(200).nullable(),
    // 연락처 5필드 (P3 정리)
    mainPhone: z.string().max(40).nullable(),
    mainEmail: z.string().max(100).nullable(),
    arsItems: z.array(ArsItemSchema).max(10),
    faxNumber: z.string().max(40).nullable(),
    websiteUrl: z.string().max(200).nullable(),
    // 운영 상태 아이콘 4종
    stateIcons: StateIconsSchema,
  })
  .refine((d) => d.weekdayClose > d.weekdayOpen, {
    message: '운영 종료 시각은 시작보다 늦어야 합니다',
    path: ['weekdayClose'],
  })
  .refine(
    (d) => {
      const hasStart = !!d.lunchStart;
      const hasEnd = !!d.lunchEnd;
      return hasStart === hasEnd;
    },
    {
      message: '점심 시작·종료는 모두 입력하거나 모두 비워야 합니다',
      path: ['lunchEnd'],
    },
  )
  .refine(
    (d) =>
      !d.lunchStart || !d.lunchEnd || (d.lunchEnd as string) > (d.lunchStart as string),
    {
      message: '점심 종료는 시작보다 늦어야 합니다',
      path: ['lunchEnd'],
    },
  )
  .refine(
    (d) => !d.intakeDeadline || (d.intakeDeadline as string) <= d.weekdayClose,
    {
      message: '접수 마감은 운영 종료 이전이어야 합니다',
      path: ['intakeDeadline'],
    },
  );

export type BusinessHoursDefaultState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

function shapeFieldErrors(err: z.ZodError<unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.') || '_';
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}

export async function updateBusinessHoursDefaultAction(
  _prev: BusinessHoursDefaultState | undefined,
  formData: FormData,
): Promise<BusinessHoursDefaultState> {
  const user = await requireRole(['manager', 'admin']);

  // ARS items: form은 'arsItems' 단일 JSON 문자열로 전달
  let arsItems: { num: string; label: string }[] = [];
  const arsRaw = ((formData.get('arsItems') ?? '') as string).trim();
  if (arsRaw) {
    try {
      const parsed = JSON.parse(arsRaw);
      if (Array.isArray(parsed)) {
        arsItems = parsed.filter(
          (it): it is { num: string; label: string } =>
            it && typeof it.num === 'string' && typeof it.label === 'string',
        );
      }
    } catch {
      // 잘못된 JSON은 빈 배열로 fallback (zod에서 추가 검증)
    }
  }

  // 운영 상태 아이콘 4종 (form은 각 상태별 select)
  const stateIcons: StateIcons = {
    open: (((formData.get('icon_open') ?? '') as string).trim() ||
      DEFAULT_STATE_ICONS.open),
    lunch: (((formData.get('icon_lunch') ?? '') as string).trim() ||
      DEFAULT_STATE_ICONS.lunch),
    intake_closed:
      (((formData.get('icon_intake_closed') ?? '') as string).trim() ||
        DEFAULT_STATE_ICONS.intake_closed),
    closed: (((formData.get('icon_closed') ?? '') as string).trim() ||
      DEFAULT_STATE_ICONS.closed),
  };

  const raw = {
    weekdayOpen: ((formData.get('weekdayOpen') ?? '') as string).trim(),
    weekdayClose: ((formData.get('weekdayClose') ?? '') as string).trim(),
    lunchStart: (((formData.get('lunchStart') ?? '') as string).trim() || null),
    lunchEnd: (((formData.get('lunchEnd') ?? '') as string).trim() || null),
    intakeDeadline: (((formData.get('intakeDeadline') ?? '') as string).trim() || null),
    saturdayClosed: formData.get('saturdayClosed') === 'on',
    sundayClosed: formData.get('sundayClosed') === 'on',
    holidaysClosed: formData.get('holidaysClosed') === 'on',
    emergencyPhone:
      (((formData.get('emergencyPhone') ?? '') as string).trim() || null),
    emergencyNote:
      (((formData.get('emergencyNote') ?? '') as string).trim() || null),
    mainPhone: (((formData.get('mainPhone') ?? '') as string).trim() || null),
    mainEmail: (((formData.get('mainEmail') ?? '') as string).trim() || null),
    arsItems,
    faxNumber: (((formData.get('faxNumber') ?? '') as string).trim() || null),
    websiteUrl: (((formData.get('websiteUrl') ?? '') as string).trim() || null),
    stateIcons,
  };

  const parsed = DefaultSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }

  const result = await upsertBusinessHoursDefault(
    {
      weekdayOpen: parsed.data.weekdayOpen,
      weekdayClose: parsed.data.weekdayClose,
      lunchStart: parsed.data.lunchStart || null,
      lunchEnd: parsed.data.lunchEnd || null,
      intakeDeadline: parsed.data.intakeDeadline || null,
      saturdayClosed: parsed.data.saturdayClosed,
      sundayClosed: parsed.data.sundayClosed,
      holidaysClosed: parsed.data.holidaysClosed,
      emergencyPhone: parsed.data.emergencyPhone,
      emergencyNote: parsed.data.emergencyNote,
      mainPhone: parsed.data.mainPhone,
      mainEmail: parsed.data.mainEmail,
      arsItems: parsed.data.arsItems,
      faxNumber: parsed.data.faxNumber,
      websiteUrl: parsed.data.websiteUrl,
      stateIcons: parsed.data.stateIcons,
    },
    user.id,
  );

  if (!result.ok) {
    return { ok: false, message: '저장 실패 — 다시 시도해주세요' };
  }

  revalidateTag('business-hours', 'default');
  revalidatePath('/admin/master/business-hours');
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────
// business_holidays
// ─────────────────────────────────────────────────────────────────

const HolidaySchema = z.object({
  date: z.string().regex(DATE_REGEX, 'YYYY-MM-DD 형식'),
  name: z.string().min(1, '이름을 입력하세요').max(60, '60자 이내'),
  isRecurring: z.boolean(),
});

export type HolidayActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function createBusinessHolidayAction(
  _prev: HolidayActionState | undefined,
  formData: FormData,
): Promise<HolidayActionState> {
  const user = await requireRole(['manager', 'admin']);

  const raw = {
    date: ((formData.get('date') ?? '') as string).trim(),
    name: ((formData.get('name') ?? '') as string).trim(),
    isRecurring: formData.get('isRecurring') === 'on',
  };

  const parsed = HolidaySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }

  const result = await createBusinessHoliday(parsed.data, user.id);
  if (!result.ok) {
    if (result.message === 'DUPLICATE_DATE') {
      return {
        ok: false,
        message: '이미 등록된 날짜입니다',
        fieldErrors: { date: '이미 등록된 날짜' },
      };
    }
    return { ok: false, message: '추가 실패' };
  }

  revalidateTag('business-hours', 'default');
  revalidatePath('/admin/master/business-hours');
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────
// business_hours_overrides (P2 예약 변경)
// ─────────────────────────────────────────────────────────────────

const OverrideSchema = z
  .object({
    kind: z.enum(['short_hours', 'closed', 'custom']),
    effectiveFrom: z.string().regex(DATE_REGEX, 'YYYY-MM-DD 형식'),
    effectiveUntil: z.string().regex(DATE_REGEX, 'YYYY-MM-DD 형식'),
    weekdayOpen: z.string().regex(TIME_REGEX).or(z.literal('')).nullable(),
    weekdayClose: z.string().regex(TIME_REGEX).or(z.literal('')).nullable(),
    lunchStart: z.string().regex(TIME_REGEX).or(z.literal('')).nullable(),
    lunchEnd: z.string().regex(TIME_REGEX).or(z.literal('')).nullable(),
    intakeDeadline: z.string().regex(TIME_REGEX).or(z.literal('')).nullable(),
    reason: z.string().min(1, '사유를 입력하세요').max(200, '200자 이내'),
  })
  .refine((d) => d.effectiveUntil >= d.effectiveFrom, {
    message: '종료일은 시작일과 같거나 늦어야 합니다',
    path: ['effectiveUntil'],
  })
  .refine(
    (d) => {
      if (d.kind === 'closed') return true; // 시간 무시
      // short_hours/custom: 최소 하나의 시간 필드 필요
      return !!(
        d.weekdayOpen ||
        d.weekdayClose ||
        d.lunchStart ||
        d.lunchEnd ||
        d.intakeDeadline
      );
    },
    {
      message: '단축운영/자유 설정은 최소 한 개의 시간을 입력하세요',
      path: ['weekdayOpen'],
    },
  )
  .refine(
    (d) =>
      !d.weekdayOpen ||
      !d.weekdayClose ||
      (d.weekdayClose as string) > (d.weekdayOpen as string),
    {
      message: '운영 종료는 시작보다 늦어야 합니다',
      path: ['weekdayClose'],
    },
  );

export type OverrideActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function createBusinessHoursOverrideAction(
  _prev: OverrideActionState | undefined,
  formData: FormData,
): Promise<OverrideActionState> {
  const user = await requireRole(['manager', 'admin']);

  const raw = {
    kind: ((formData.get('kind') ?? '') as string).trim(),
    effectiveFrom: ((formData.get('effectiveFrom') ?? '') as string).trim(),
    effectiveUntil: ((formData.get('effectiveUntil') ?? '') as string).trim(),
    weekdayOpen: (((formData.get('weekdayOpen') ?? '') as string).trim() || null),
    weekdayClose: (((formData.get('weekdayClose') ?? '') as string).trim() || null),
    lunchStart: (((formData.get('lunchStart') ?? '') as string).trim() || null),
    lunchEnd: (((formData.get('lunchEnd') ?? '') as string).trim() || null),
    intakeDeadline:
      (((formData.get('intakeDeadline') ?? '') as string).trim() || null),
    reason: ((formData.get('reason') ?? '') as string).trim(),
  };

  const parsed = OverrideSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }

  const result = await createBusinessHoursOverride(
    {
      kind: parsed.data.kind,
      effectiveFrom: parsed.data.effectiveFrom,
      effectiveUntil: parsed.data.effectiveUntil,
      weekdayOpen: parsed.data.weekdayOpen || null,
      weekdayClose: parsed.data.weekdayClose || null,
      lunchStart: parsed.data.lunchStart || null,
      lunchEnd: parsed.data.lunchEnd || null,
      intakeDeadline: parsed.data.intakeDeadline || null,
      reason: parsed.data.reason,
    },
    user.id,
  );

  if (!result.ok) {
    if (result.message === 'PERIOD_COLLISION') {
      return {
        ok: false,
        message: '같은 기간에 활성/예약 상태인 변경이 이미 있습니다',
        fieldErrors: { effectiveFrom: '기간 충돌' },
      };
    }
    if (result.message === 'INVALID_PERIOD') {
      return {
        ok: false,
        message: '종료일은 시작일과 같거나 늦어야 합니다',
        fieldErrors: { effectiveUntil: '잘못된 기간' },
      };
    }
    return { ok: false, message: '예약 실패' };
  }

  revalidateTag('business-hours', 'default');
  revalidatePath('/admin/master/business-hours');
  return { ok: true };
}

export async function shortenActiveOverrideAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string; nowExpired?: boolean }> {
  const user = await requireRole(['manager', 'admin']);
  const id = ((formData.get('id') ?? '') as string).trim();
  const newUntil = ((formData.get('newEffectiveUntil') ?? '') as string).trim();
  if (!id) return { ok: false, message: 'ID 누락' };
  if (!DATE_REGEX.test(newUntil)) {
    return { ok: false, message: '날짜 형식이 올바르지 않습니다' };
  }

  const result = await shortenActiveOverride(id, newUntil, user.id);
  if (!result.ok) {
    if (result.message === 'NOT_FOUND') {
      return { ok: false, message: '예약을 찾을 수 없습니다' };
    }
    if (result.message === 'ONLY_ACTIVE_SHORTENABLE') {
      return { ok: false, message: '진행 중(active) 예약만 단축할 수 있습니다' };
    }
    if (result.message === 'BEFORE_EFFECTIVE_FROM') {
      return { ok: false, message: '시작일보다 빠른 종료일은 불가합니다' };
    }
    if (result.message === 'NOT_SHORTER') {
      return { ok: false, message: '기존 종료일보다 빠른 날짜로 단축해야 합니다' };
    }
    return { ok: false, message: '단축 실패' };
  }

  revalidateTag('business-hours', 'default');
  revalidatePath('/admin/master/business-hours');
  return { ok: true, nowExpired: result.nowExpired };
}

export async function cancelBusinessHoursOverrideAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const id = ((formData.get('id') ?? '') as string).trim();
  if (!id) return { ok: false, message: 'ID 누락' };

  const result = await cancelBusinessHoursOverride(id, user.id);
  if (!result.ok) {
    if (result.message === 'NOT_FOUND') {
      return { ok: false, message: '예약을 찾을 수 없습니다' };
    }
    if (result.message === 'ONLY_SCHEDULED_CANCELABLE') {
      return {
        ok: false,
        message: '활성/만료된 예약은 취소할 수 없습니다',
      };
    }
    return { ok: false, message: '취소 실패' };
  }

  revalidateTag('business-hours', 'default');
  revalidatePath('/admin/master/business-hours');
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────
// business_holidays — deactivate (continued)
// ─────────────────────────────────────────────────────────────────

export async function replicateRecurringHolidaysAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string; created?: number; skipped?: number }> {
  const user = await requireRole(['manager', 'admin']);
  const yearRaw = ((formData.get('targetYear') ?? '') as string).trim();
  const targetYear = Number(yearRaw);
  if (!Number.isInteger(targetYear) || targetYear < 2020 || targetYear > 2100) {
    return { ok: false, message: '대상 연도가 올바르지 않습니다' };
  }

  const result = await replicateRecurringHolidaysForYear(targetYear, user.id);
  revalidateTag('business-hours', 'default');
  revalidatePath('/admin/master/business-hours');
  return { ok: true, created: result.created, skipped: result.skipped };
}

export async function deactivateBusinessHolidayAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const id = ((formData.get('id') ?? '') as string).trim();
  if (!id) return { ok: false, message: 'ID 누락' };

  const result = await deactivateBusinessHoliday(id, user.id);
  if (!result.ok) {
    if (result.message === 'NOT_FOUND') {
      return { ok: false, message: '공휴일을 찾을 수 없습니다' };
    }
    return { ok: false, message: '삭제 실패' };
  }

  revalidateTag('business-hours', 'default');
  revalidatePath('/admin/master/business-hours');
  return { ok: true };
}
