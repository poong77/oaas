/**
 * 운영시간 마스터 도메인 서비스 (P1).
 *
 * - `business_hours_default` 단일 행 조회/수정
 * - `business_holidays` CRUD (soft delete)
 * - 호텔리어 컨택 패널을 위한 통합 상태 계산 (`getCurrentBusinessStatus`)
 *
 * 모든 mutate 액션은 `activity_logs`에 fire-and-forget 기록 (lib/audit.ts).
 *
 * P2 추가 예정:
 *   - business_hours_overrides CRUD
 *   - cron 활성화/만료 핸들러
 *   - 변경 이력 리스트 (activity_logs 필터 뷰)
 */

import 'server-only';

import { and, asc, desc, eq, gte, lte, ne, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  activityLogs,
  businessHolidays,
  businessHoursDefault,
  businessHoursOverrides,
  users,
  type BusinessHoliday,
  type BusinessHoursDefault,
  type BusinessHoursOverride,
  type BusinessHoursOverrideKind,
  type BusinessHoursOverrideStatus,
  type NewBusinessHoliday,
  type NewBusinessHoursOverride,
} from '@/db/schema';
import { logActivity } from '@/lib/audit';
import {
  calculateBusinessStatus,
  type ArsItem,
  type BusinessHoursInput,
  type BusinessStatusResult,
  type HolidayInfo,
  type StateIcons,
} from '@/lib/business-hours/calculate';
import { todayKst, toHHMM } from '@/lib/business-hours/format';
import {
  DEFAULT_STATE_ICONS,
  normalizeStateIcons,
} from '@/lib/business-hours/state-icons';
import { sendSlack, type SlackBlock } from '@/lib/notifications/slack';

// ─────────────────────────────────────────────────────────────────
// business_hours_default
// ─────────────────────────────────────────────────────────────────

export type BusinessHoursDefaultWriteInput = {
  weekdayOpen: string; // 'HH:MM'
  weekdayClose: string;
  lunchStart?: string | null;
  lunchEnd?: string | null;
  intakeDeadline?: string | null;
  saturdayClosed: boolean;
  sundayClosed: boolean;
  holidaysClosed: boolean;
  emergencyPhone?: string | null;
  emergencyNote?: string | null;
  // P3 정리(2026-05-30): 연락처도 같이 한 화면에서 편집
  mainPhone?: string | null;
  mainEmail?: string | null;
  arsItems?: ArsItem[];
  faxNumber?: string | null;
  websiteUrl?: string | null;
  stateIcons?: StateIcons;
  timezone?: string;
};

export async function getBusinessHoursDefault(): Promise<BusinessHoursDefault | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(businessHoursDefault)
      .where(eq(businessHoursDefault.isActive, true))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[business-hours.getBusinessHoursDefault] 실패:', err);
    return null;
  }
}

/**
 * 단일 행 upsert.
 * - 기존 활성 행이 있으면 UPDATE
 * - 없으면 INSERT (시드 실행 전이거나 누군가 직접 삭제한 케이스)
 *
 * 동시성: 단일 어드민 편집 가정. 다중 동시 편집 시 lost update 가능 (수용 가능 — 마지막 쓴 사람이 승리).
 */
export async function upsertBusinessHoursDefault(
  input: BusinessHoursDefaultWriteInput,
  userId: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };

  try {
    const before = await getBusinessHoursDefault();

    const values = {
      weekdayOpen: input.weekdayOpen,
      weekdayClose: input.weekdayClose,
      lunchStart: input.lunchStart ?? null,
      lunchEnd: input.lunchEnd ?? null,
      intakeDeadline: input.intakeDeadline ?? null,
      saturdayClosed: input.saturdayClosed,
      sundayClosed: input.sundayClosed,
      holidaysClosed: input.holidaysClosed,
      emergencyPhone: input.emergencyPhone ?? null,
      emergencyNote: input.emergencyNote ?? null,
      mainPhone: input.mainPhone ?? null,
      mainEmail: input.mainEmail ?? null,
      arsItems: input.arsItems ?? [],
      faxNumber: input.faxNumber ?? null,
      websiteUrl: input.websiteUrl ?? null,
      stateIcons: input.stateIcons ?? DEFAULT_STATE_ICONS,
      timezone: input.timezone ?? 'Asia/Seoul',
      updatedBy: userId,
    };

    if (before) {
      await db
        .update(businessHoursDefault)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(businessHoursDefault.id, before.id));
    } else {
      await db.insert(businessHoursDefault).values(values);
    }

    logActivity({
      userId,
      action: before
        ? 'business_hours.default.update'
        : 'business_hours.default.create',
      targetType: 'business_hours_default',
      targetId: before?.id ?? null,
      payload: {
        before: before ? snapshotDefault(before) : null,
        after: values,
      },
    });

    return { ok: true };
  } catch (err) {
    console.error('[business-hours.upsertBusinessHoursDefault] 실패:', err);
    return { ok: false, message: 'UPDATE_FAILED' };
  }
}

function snapshotDefault(row: BusinessHoursDefault) {
  return {
    weekdayOpen: row.weekdayOpen,
    weekdayClose: row.weekdayClose,
    lunchStart: row.lunchStart,
    lunchEnd: row.lunchEnd,
    intakeDeadline: row.intakeDeadline,
    saturdayClosed: row.saturdayClosed,
    sundayClosed: row.sundayClosed,
    holidaysClosed: row.holidaysClosed,
    emergencyPhone: row.emergencyPhone,
    emergencyNote: row.emergencyNote,
    mainPhone: row.mainPhone,
    mainEmail: row.mainEmail,
    arsItems: row.arsItems,
    faxNumber: row.faxNumber,
    websiteUrl: row.websiteUrl,
    stateIcons: row.stateIcons,
    timezone: row.timezone,
  };
}

// ─────────────────────────────────────────────────────────────────
// business_holidays
// ─────────────────────────────────────────────────────────────────

export type ListBusinessHolidaysOptions = {
  /** 'YYYY' — 해당 연도 공휴일만. 미지정이면 활성 전체. */
  year?: number;
  /** 비활성 포함 여부 (어드민 이력 보기용) */
  includeInactive?: boolean;
};

export async function listBusinessHolidays(
  options: ListBusinessHolidaysOptions = {},
): Promise<BusinessHoliday[]> {
  if (!db) return [];
  try {
    const conditions = [];
    if (!options.includeInactive)
      conditions.push(eq(businessHolidays.isActive, true));
    if (options.year !== undefined) {
      const from = `${options.year}-01-01`;
      const to = `${options.year}-12-31`;
      conditions.push(gte(businessHolidays.date, from));
      conditions.push(lte(businessHolidays.date, to));
    }
    const where = conditions.length === 0 ? undefined : and(...conditions);
    return await db
      .select()
      .from(businessHolidays)
      .where(where)
      .orderBy(asc(businessHolidays.date));
  } catch (err) {
    console.error('[business-hours.listBusinessHolidays] 실패:', err);
    return [];
  }
}

export type BusinessHolidayWriteInput = {
  date: string; // 'YYYY-MM-DD'
  name: string;
  isRecurring: boolean;
};

export async function createBusinessHoliday(
  input: BusinessHolidayWriteInput,
  userId: string,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const row: NewBusinessHoliday = {
      date: input.date,
      name: input.name,
      isRecurring: input.isRecurring,
      createdBy: userId,
    };
    const [created] = await db
      .insert(businessHolidays)
      .values(row)
      .returning({ id: businessHolidays.id });

    logActivity({
      userId,
      action: 'business_hours.holiday.create',
      targetType: 'business_holiday',
      targetId: created?.id ?? null,
      payload: { date: input.date, name: input.name, isRecurring: input.isRecurring },
    });

    return { ok: true, id: created?.id };
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { ok: false, message: 'DUPLICATE_DATE' };
    }
    console.error('[business-hours.createBusinessHoliday] 실패:', err);
    return { ok: false, message: 'INSERT_FAILED' };
  }
}

/** Soft delete (is_active=false). 이력 보존 + 같은 날짜에 재등록 가능. */
export async function deactivateBusinessHoliday(
  id: string,
  userId: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const [target] = await db
      .select()
      .from(businessHolidays)
      .where(eq(businessHolidays.id, id))
      .limit(1);
    if (!target) return { ok: false, message: 'NOT_FOUND' };

    await db
      .update(businessHolidays)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(businessHolidays.id, id));

    logActivity({
      userId,
      action: 'business_hours.holiday.delete',
      targetType: 'business_holiday',
      targetId: id,
      payload: { date: target.date, name: target.name },
    });

    return { ok: true };
  } catch (err) {
    console.error('[business-hours.deactivateBusinessHoliday] 실패:', err);
    return { ok: false, message: 'UPDATE_FAILED' };
  }
}

/**
 * P3: 양력 공휴일(`is_recurring=true`)을 지정 연도로 일괄 복제.
 *
 * 동작:
 *   - 활성 recurring=true 행을 (month, day)만 추출
 *   - 지정 연도의 같은 (month, day)로 신규 행 INSERT (is_recurring=true 그대로)
 *   - 이미 활성 행이 있으면 skip (idempotent)
 *
 * 사용 시나리오: 매년 1월 어드민이 "내년 공휴일 자동 등록" 버튼 클릭.
 * 음력·대체공휴일은 매년 날짜가 달라지므로 자동 복제 대상 아님 (수동 입력).
 */
export async function replicateRecurringHolidaysForYear(
  targetYear: number,
  userId: string,
): Promise<{ created: number; skipped: number }> {
  if (!db) return { created: 0, skipped: 0 };
  try {
    const recurringRows = await db
      .select({
        date: businessHolidays.date,
        name: businessHolidays.name,
      })
      .from(businessHolidays)
      .where(
        and(
          eq(businessHolidays.isActive, true),
          eq(businessHolidays.isRecurring, true),
        ),
      );

    if (recurringRows.length === 0) return { created: 0, skipped: 0 };

    let created = 0;
    let skipped = 0;

    for (const r of recurringRows) {
      // 'YYYY-MM-DD' → 'MM-DD' → targetYear와 결합
      const monthDay = r.date.slice(5);
      const targetDate = `${targetYear}-${monthDay}`;

      // 이미 같은 날짜 활성 행 있으면 skip
      const existing = await db
        .select({ id: businessHolidays.id })
        .from(businessHolidays)
        .where(
          sql`${businessHolidays.date} = ${targetDate} AND ${businessHolidays.isActive} = true`,
        )
        .limit(1);
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await db.insert(businessHolidays).values({
        date: targetDate,
        name: r.name,
        isRecurring: true,
        createdBy: userId,
      });
      created++;
    }

    if (created > 0) {
      logActivity({
        userId,
        action: 'business_hours.holiday.replicate',
        targetType: 'business_holiday',
        targetId: null,
        payload: { targetYear, created, skipped, totalSource: recurringRows.length },
      });
    }

    return { created, skipped };
  } catch (err) {
    console.error('[business-hours.replicateRecurringHolidaysForYear] 실패:', err);
    return { created: 0, skipped: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────
// business_hours_overrides (P2)
// ─────────────────────────────────────────────────────────────────

export type BusinessHoursOverrideWriteInput = {
  kind: BusinessHoursOverrideKind;
  effectiveFrom: string; // 'YYYY-MM-DD'
  effectiveUntil: string;
  weekdayOpen?: string | null;
  weekdayClose?: string | null;
  lunchStart?: string | null;
  lunchEnd?: string | null;
  intakeDeadline?: string | null;
  reason: string;
};

export type ListOverridesOptions = {
  status?: BusinessHoursOverrideStatus[];
  includeInactive?: boolean;
  limit?: number;
};

export async function listBusinessHoursOverrides(
  options: ListOverridesOptions = {},
): Promise<BusinessHoursOverride[]> {
  if (!db) return [];
  try {
    const conditions = [];
    if (!options.includeInactive)
      conditions.push(eq(businessHoursOverrides.isActive, true));
    if (options.status && options.status.length > 0) {
      conditions.push(
        or(
          ...options.status.map((s) =>
            eq(businessHoursOverrides.status, s),
          ),
        )!,
      );
    }
    const where = conditions.length === 0 ? undefined : and(...conditions);

    const q = db
      .select()
      .from(businessHoursOverrides)
      .where(where)
      .orderBy(desc(businessHoursOverrides.effectiveFrom));
    return options.limit ? await q.limit(options.limit) : await q;
  } catch (err) {
    console.error('[business-hours.listBusinessHoursOverrides] 실패:', err);
    return [];
  }
}

/**
 * 'YYYY-MM-DD' 날짜에 적용되어야 하는 active override 1건 조회.
 * 충돌 방지가 되어 있으면 0~1건이 정상. 2건 이상이면 가장 최근 created_at 사용.
 */
export async function getActiveOverrideForDate(
  isoDate: string,
): Promise<BusinessHoursOverride | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(businessHoursOverrides)
      .where(
        and(
          eq(businessHoursOverrides.isActive, true),
          eq(businessHoursOverrides.status, 'active'),
          lte(businessHoursOverrides.effectiveFrom, isoDate),
          gte(businessHoursOverrides.effectiveUntil, isoDate),
        ),
      )
      .orderBy(desc(businessHoursOverrides.createdAt))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[business-hours.getActiveOverrideForDate] 실패:', err);
    return null;
  }
}

/**
 * 같은 기간에 scheduled 또는 active 상태 override가 있으면 충돌.
 * exceptId가 주어지면 그 행은 제외 (편집 시 자기 자신 제외용 — P2 보강).
 */
export async function hasOverrideCollision(
  effectiveFrom: string,
  effectiveUntil: string,
  exceptId?: string,
): Promise<boolean> {
  if (!db) return false;
  try {
    const conditions = [
      eq(businessHoursOverrides.isActive, true),
      or(
        eq(businessHoursOverrides.status, 'scheduled'),
        eq(businessHoursOverrides.status, 'active'),
      )!,
      // 기간 겹침 조건: from <= 상대.until AND until >= 상대.from
      lte(businessHoursOverrides.effectiveFrom, effectiveUntil),
      gte(businessHoursOverrides.effectiveUntil, effectiveFrom),
    ];
    if (exceptId) conditions.push(ne(businessHoursOverrides.id, exceptId));

    const rows = await db
      .select({ id: businessHoursOverrides.id })
      .from(businessHoursOverrides)
      .where(and(...conditions))
      .limit(1);
    return rows.length > 0;
  } catch (err) {
    console.error('[business-hours.hasOverrideCollision] 실패:', err);
    return false;
  }
}

export async function createBusinessHoursOverride(
  input: BusinessHoursOverrideWriteInput,
  userId: string,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    if (input.effectiveUntil < input.effectiveFrom) {
      return { ok: false, message: 'INVALID_PERIOD' };
    }
    const collides = await hasOverrideCollision(
      input.effectiveFrom,
      input.effectiveUntil,
    );
    if (collides) {
      return { ok: false, message: 'PERIOD_COLLISION' };
    }

    const row: NewBusinessHoursOverride = {
      kind: input.kind,
      effectiveFrom: input.effectiveFrom,
      effectiveUntil: input.effectiveUntil,
      weekdayOpen: input.weekdayOpen ?? null,
      weekdayClose: input.weekdayClose ?? null,
      lunchStart: input.lunchStart ?? null,
      lunchEnd: input.lunchEnd ?? null,
      intakeDeadline: input.intakeDeadline ?? null,
      reason: input.reason,
      createdBy: userId,
    };

    const [created] = await db
      .insert(businessHoursOverrides)
      .values(row)
      .returning({ id: businessHoursOverrides.id });

    logActivity({
      userId,
      action: 'business_hours.override.create',
      targetType: 'business_hours_override',
      targetId: created?.id ?? null,
      payload: {
        kind: input.kind,
        effectiveFrom: input.effectiveFrom,
        effectiveUntil: input.effectiveUntil,
        reason: input.reason,
      },
    });

    return { ok: true, id: created?.id };
  } catch (err) {
    console.error('[business-hours.createBusinessHoursOverride] 실패:', err);
    return { ok: false, message: 'INSERT_FAILED' };
  }
}

/**
 * P3: active override의 종료일 단축 (조기 종료 포함).
 *
 * 검증:
 *   - 대상은 status='active'만
 *   - newEffectiveUntil >= effectiveFrom (시작일보다 빠를 수 없음)
 *   - newEffectiveUntil <= 기존 effectiveUntil (단축만 허용)
 *
 * 동작:
 *   - newEffectiveUntil < today(KST) → 즉시 status='expired' + applied_at 유지
 *   - newEffectiveUntil >= today        → status='active' 유지, effectiveUntil만 갱신
 *
 * 모든 케이스에서 activity_logs(business_hours.override.shorten) 기록.
 */
export async function shortenActiveOverride(
  id: string,
  newEffectiveUntil: string, // 'YYYY-MM-DD'
  userId: string,
): Promise<{ ok: boolean; message?: string; nowExpired?: boolean }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const [target] = await db
      .select()
      .from(businessHoursOverrides)
      .where(eq(businessHoursOverrides.id, id))
      .limit(1);
    if (!target) return { ok: false, message: 'NOT_FOUND' };
    if (target.status !== 'active') {
      return { ok: false, message: 'ONLY_ACTIVE_SHORTENABLE' };
    }
    if (newEffectiveUntil < target.effectiveFrom) {
      return { ok: false, message: 'BEFORE_EFFECTIVE_FROM' };
    }
    if (newEffectiveUntil >= target.effectiveUntil) {
      return { ok: false, message: 'NOT_SHORTER' };
    }

    const today = todayKst();
    const nowExpired = newEffectiveUntil < today;

    await db
      .update(businessHoursOverrides)
      .set({
        effectiveUntil: newEffectiveUntil,
        status: nowExpired ? 'expired' : 'active',
        updatedAt: new Date(),
      })
      .where(eq(businessHoursOverrides.id, id));

    logActivity({
      userId,
      action: 'business_hours.override.shorten',
      targetType: 'business_hours_override',
      targetId: id,
      payload: {
        kind: target.kind,
        effectiveFrom: target.effectiveFrom,
        previousUntil: target.effectiveUntil,
        newUntil: newEffectiveUntil,
        reason: target.reason,
        nowExpired,
      },
    });

    return { ok: true, nowExpired };
  } catch (err) {
    console.error('[business-hours.shortenActiveOverride] 실패:', err);
    return { ok: false, message: 'UPDATE_FAILED' };
  }
}

/** scheduled 상태에서만 취소 가능. active는 종료일 단축으로 처리해야 함 (P3). */
export async function cancelBusinessHoursOverride(
  id: string,
  userId: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const [target] = await db
      .select()
      .from(businessHoursOverrides)
      .where(eq(businessHoursOverrides.id, id))
      .limit(1);
    if (!target) return { ok: false, message: 'NOT_FOUND' };
    if (target.status !== 'scheduled') {
      return { ok: false, message: 'ONLY_SCHEDULED_CANCELABLE' };
    }

    await db
      .update(businessHoursOverrides)
      .set({
        status: 'canceled',
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(businessHoursOverrides.id, id));

    logActivity({
      userId,
      action: 'business_hours.override.cancel',
      targetType: 'business_hours_override',
      targetId: id,
      payload: {
        kind: target.kind,
        effectiveFrom: target.effectiveFrom,
        effectiveUntil: target.effectiveUntil,
        reason: target.reason,
      },
    });

    return { ok: true };
  } catch (err) {
    console.error('[business-hours.cancelBusinessHoursOverride] 실패:', err);
    return { ok: false, message: 'UPDATE_FAILED' };
  }
}

// ─────────────────────────────────────────────────────────────────
// Cron 핸들러용 — 상태 전환
// ─────────────────────────────────────────────────────────────────

/**
 * effective_from <= today 인 scheduled 행을 active로 전환.
 * today는 KST 기준.
 */
export async function applyScheduledOverrides(today: string): Promise<{
  applied: number;
}> {
  if (!db) return { applied: 0 };
  try {
    const rows = await db
      .select({ id: businessHoursOverrides.id })
      .from(businessHoursOverrides)
      .where(
        and(
          eq(businessHoursOverrides.isActive, true),
          eq(businessHoursOverrides.status, 'scheduled'),
          lte(businessHoursOverrides.effectiveFrom, today),
        ),
      );

    if (rows.length === 0) return { applied: 0 };

    for (const r of rows) {
      await db
        .update(businessHoursOverrides)
        .set({
          status: 'active',
          appliedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(businessHoursOverrides.id, r.id));

      logActivity({
        userId: null,
        action: 'business_hours.override.applied',
        targetType: 'business_hours_override',
        targetId: r.id,
        payload: { trigger: 'cron', today },
      });
    }
    return { applied: rows.length };
  } catch (err) {
    console.error('[business-hours.applyScheduledOverrides] 실패:', err);
    return { applied: 0 };
  }
}

/**
 * P3: 내일(today+1)에 적용될 scheduled override를 슬랙으로 사전 공지.
 *
 * 매일 cron이 호출하며, effective_from = today+1 정확 매칭이므로
 * 같은 override가 두 번 알림될 일은 없다 (idempotent by design).
 *
 * 채널: 'new' (운영팀 채널 재사용 — 별도 ops 채널이 신설되면 그쪽으로 이동).
 */
const KIND_LABEL_KR: Record<BusinessHoursOverrideKind, string> = {
  short_hours: '단축운영',
  closed: '임시휴무',
  custom: '자유 설정',
};

export async function notifyUpcomingOverrides(today: string): Promise<{
  notified: number;
}> {
  if (!db) return { notified: 0 };
  try {
    // today + 1 일 (KST)
    const [y, m, d] = today.split('-').map(Number);
    const tomorrow = new Date(Date.UTC(y!, m! - 1, d! + 1))
      .toISOString()
      .slice(0, 10);

    const rows = await db
      .select()
      .from(businessHoursOverrides)
      .where(
        and(
          eq(businessHoursOverrides.isActive, true),
          eq(businessHoursOverrides.status, 'scheduled'),
          eq(businessHoursOverrides.effectiveFrom, tomorrow),
        ),
      );

    if (rows.length === 0) return { notified: 0 };

    let notified = 0;
    for (const o of rows) {
      const result = await sendSlack({
        channel: 'new',
        fallbackText: `📅 내일(${tomorrow}) 운영시간 변경 적용 — ${o.reason}`,
        blocks: buildOverrideReminderBlocks(o, tomorrow),
      });

      logActivity({
        userId: null,
        action: 'business_hours.override.reminder_sent',
        targetType: 'business_hours_override',
        targetId: o.id,
        payload: {
          trigger: 'cron',
          today,
          tomorrow,
          effectiveFrom: o.effectiveFrom,
          slackOk: result.ok,
          stub: 'stub' in result ? result.stub : false,
        },
      });

      if (result.ok) notified++;
    }
    return { notified };
  } catch (err) {
    console.error('[business-hours.notifyUpcomingOverrides] 실패:', err);
    return { notified: 0 };
  }
}

function buildOverrideReminderBlocks(
  o: BusinessHoursOverride,
  tomorrow: string,
): SlackBlock[] {
  const lines: string[] = [];
  lines.push(`*유형:* ${KIND_LABEL_KR[o.kind]}`);
  lines.push(`*기간:* ${o.effectiveFrom} ~ ${o.effectiveUntil}`);
  lines.push(`*사유:* ${o.reason}`);

  if (o.kind !== 'closed') {
    const times: string[] = [];
    if (o.weekdayOpen && o.weekdayClose) {
      times.push(`운영 ${toHHMM(o.weekdayOpen)}~${toHHMM(o.weekdayClose)}`);
    }
    if (o.lunchStart && o.lunchEnd) {
      times.push(`점심 ${toHHMM(o.lunchStart)}~${toHHMM(o.lunchEnd)}`);
    }
    if (o.intakeDeadline) {
      times.push(`접수마감 ${toHHMM(o.intakeDeadline)}`);
    }
    if (times.length > 0) {
      lines.push(`*적용 시간:* ${times.join(' · ')}`);
    }
  }

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📅 내일(${tomorrow}) 운영시간 변경 적용`,
      },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: lines.join('\n') },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '자정 직후(00:01 KST) cron이 자동으로 활성화합니다. 변경이 필요하면 어드민 마스터 → 운영시간 탭에서 취소·수정하세요.',
        },
      ],
    },
  ];
}


/**
 * effective_until < today 인 active 행을 expired로 전환.
 */
export async function expireFinishedOverrides(today: string): Promise<{
  expired: number;
}> {
  if (!db) return { expired: 0 };
  try {
    const rows = await db
      .select({ id: businessHoursOverrides.id })
      .from(businessHoursOverrides)
      .where(
        and(
          eq(businessHoursOverrides.isActive, true),
          eq(businessHoursOverrides.status, 'active'),
          sql`${businessHoursOverrides.effectiveUntil} < ${today}`,
        ),
      );

    if (rows.length === 0) return { expired: 0 };

    for (const r of rows) {
      await db
        .update(businessHoursOverrides)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(businessHoursOverrides.id, r.id));

      logActivity({
        userId: null,
        action: 'business_hours.override.expired',
        targetType: 'business_hours_override',
        targetId: r.id,
        payload: { trigger: 'cron', today },
      });
    }
    return { expired: rows.length };
  } catch (err) {
    console.error('[business-hours.expireFinishedOverrides] 실패:', err);
    return { expired: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────
// 변경 이력 (P2)
// ─────────────────────────────────────────────────────────────────

export type BusinessHoursActivityLogRow = {
  id: string;
  userId: string | null;
  /** P3: users.name LEFT JOIN — userId가 null(cron 시스템 액션)이거나 삭제된 사용자면 null */
  userName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
};

/**
 * activity_logs에서 business_hours.* action만 필터링한 이력 조회.
 * 최신순. P3에서 users.name LEFT JOIN으로 사용자 이름 노출.
 */
export async function listBusinessHoursActivityLogs(options: {
  limit?: number;
  offset?: number;
}): Promise<BusinessHoursActivityLogRow[]> {
  if (!db) return [];
  try {
    const rows = await db
      .select({
        id: activityLogs.id,
        userId: activityLogs.userId,
        userName: users.name,
        action: activityLogs.action,
        targetType: activityLogs.targetType,
        targetId: activityLogs.targetId,
        payload: activityLogs.payload,
        createdAt: activityLogs.createdAt,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .where(sql`${activityLogs.action} LIKE 'business_hours.%'`)
      .orderBy(desc(activityLogs.createdAt))
      .limit(options.limit ?? 100)
      .offset(options.offset ?? 0);
    return rows;
  } catch (err) {
    console.error('[business-hours.listBusinessHoursActivityLogs] 실패:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// 호텔리어 컨택 패널 통합 상태 계산
// ─────────────────────────────────────────────────────────────────

/**
 * 호텔리어 클라이언트가 사용할 정책 컨텍스트 로드.
 * default + 공휴일 + active override 머지를 한 번에 처리.
 *
 * `/api/business-hours/context` route와 `getCurrentBusinessStatus`가 공통으로 사용 (W1 정리).
 */
export async function loadBusinessHoursContext(
  now: Date = new Date(),
): Promise<{ hours: BusinessHoursInput; holidays: HolidayInfo[] } | null> {
  const defaults = await getBusinessHoursDefault();
  if (!defaults) return null;

  const today = now
    .toLocaleString('sv-SE', { timeZone: defaults.timezone })
    .slice(0, 10);
  const [y, m, d] = today.split('-').map(Number);
  const thirtyDaysLater = new Date(Date.UTC(y!, m! - 1, d! + 30))
    .toISOString()
    .slice(0, 10);

  const [holidayRows, activeOverride] = await Promise.all([
    db!
      .select({
        date: businessHolidays.date,
        name: businessHolidays.name,
        isRecurring: businessHolidays.isRecurring,
      })
      .from(businessHolidays)
      .where(
        and(
          eq(businessHolidays.isActive, true),
          sql`(${businessHolidays.isRecurring} = true OR (${businessHolidays.date} >= ${today} AND ${businessHolidays.date} <= ${thirtyDaysLater}))`,
        ),
      ),
    getActiveOverrideForDate(today),
  ]);

  const holidays: HolidayInfo[] = holidayRows.map((r) => ({
    date: r.date,
    name: r.name,
    isRecurring: r.isRecurring,
  }));

  let hours: BusinessHoursInput = {
    weekdayOpen: defaults.weekdayOpen,
    weekdayClose: defaults.weekdayClose,
    lunchStart: defaults.lunchStart,
    lunchEnd: defaults.lunchEnd,
    intakeDeadline: defaults.intakeDeadline,
    saturdayClosed: defaults.saturdayClosed,
    sundayClosed: defaults.sundayClosed,
    holidaysClosed: defaults.holidaysClosed,
    emergencyPhone: defaults.emergencyPhone,
    emergencyNote: defaults.emergencyNote,
    mainPhone: defaults.mainPhone,
    mainEmail: defaults.mainEmail,
    arsItems: defaults.arsItems,
    faxNumber: defaults.faxNumber,
    websiteUrl: defaults.websiteUrl,
    stateIcons: normalizeStateIcons(defaults.stateIcons),
    timezone: defaults.timezone,
  };

  if (activeOverride) {
    hours = mergeOverrideIntoHours(hours, activeOverride);
  }

  return { hours, holidays };
}

/**
 * 호텔리어 컨택 패널이 호출. 현재 시각 기준 운영 상태 + 부가 정보 반환.
 *
 * 캐싱 전략: 컨택 패널은 1분마다 클라이언트가 재계산하므로 서버 fetch는
 * 짧은 캐시(예: 60초)면 충분. 향후 unstable_cache + revalidateTag 적용.
 *
 * default 데이터가 없으면 null 반환 — 호출 측에서 fallback UI 처리.
 */
export async function getCurrentBusinessStatus(
  now: Date = new Date(),
): Promise<BusinessStatusResult | null> {
  const ctx = await loadBusinessHoursContext(now);
  if (!ctx) return null;
  return calculateBusinessStatus({ now, hours: ctx.hours, holidays: ctx.holidays });
}

/**
 * active override를 default hours에 머지.
 * - kind='closed' → forcedClosure 설정 (즉시 휴무)
 * - kind='short_hours' | 'custom' → 시간 필드 override 우선 (null이면 default 유지)
 */
function mergeOverrideIntoHours(
  base: BusinessHoursInput,
  ovr: BusinessHoursOverride,
): BusinessHoursInput {
  if (ovr.kind === 'closed') {
    return {
      ...base,
      forcedClosure: {
        label: `${ovr.reason} (임시 휴무)`,
        reason: ovr.reason,
      },
    };
  }

  return {
    ...base,
    weekdayOpen: ovr.weekdayOpen ?? base.weekdayOpen,
    weekdayClose: ovr.weekdayClose ?? base.weekdayClose,
    lunchStart: ovr.lunchStart ?? base.lunchStart,
    lunchEnd: ovr.lunchEnd ?? base.lunchEnd,
    intakeDeadline: ovr.intakeDeadline ?? base.intakeDeadline,
  };
}

// ─────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === '23505'
  );
}
