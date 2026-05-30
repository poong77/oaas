/**
 * 호텔리어 컨택 패널·헤더 배지가 사용할 정책 데이터 엔드포인트.
 *
 * - GET: 현재 운영시간 정책(hours) + 향후 30일 + 양력 공휴일 리스트(holidays).
 * - 클라이언트는 이 응답을 받고 `calculateBusinessStatus`를 1분마다 재호출.
 * - 인증 불필요 (공개 정책 정보).
 *
 * 캐시: 60초 — 정책 변경은 활동 빈도가 매우 낮으므로 충분.
 * 어드민이 수정하면 `revalidateTag('business-hours')`로 즉시 무효화.
 */

import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { and, eq, gte, lte, sql } from 'drizzle-orm';

import { db } from '@/db';
import { businessHolidays } from '@/db/schema';
import { getActiveOverrideForDate, getBusinessHoursDefault } from '@/lib/services/business-hours';
import type { BusinessHoursInput, HolidayInfo } from '@/lib/business-hours/calculate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ContextResponse = {
  ok: true;
  hours: BusinessHoursInput;
  holidays: HolidayInfo[];
  serverNow: string; // ISO, 클라 clock drift 감지용
} | {
  ok: false;
  message: string;
};

const loadCachedContext = unstable_cache(
  async (): Promise<ContextResponse> => {
    const defaults = await getBusinessHoursDefault();
    if (!defaults) {
      return { ok: false, message: 'BUSINESS_HOURS_NOT_CONFIGURED' };
    }

    const today = new Date()
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

    // Suppress unused warnings for the unused range helpers in this scope
    void gte;
    void lte;

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
      timezone: defaults.timezone,
    };

    if (activeOverride) {
      if (activeOverride.kind === 'closed') {
        hours = {
          ...hours,
          forcedClosure: {
            label: `${activeOverride.reason} (임시 휴무)`,
            reason: activeOverride.reason,
          },
        };
      } else {
        hours = {
          ...hours,
          weekdayOpen: activeOverride.weekdayOpen ?? hours.weekdayOpen,
          weekdayClose: activeOverride.weekdayClose ?? hours.weekdayClose,
          lunchStart: activeOverride.lunchStart ?? hours.lunchStart,
          lunchEnd: activeOverride.lunchEnd ?? hours.lunchEnd,
          intakeDeadline:
            activeOverride.intakeDeadline ?? hours.intakeDeadline,
        };
      }
    }

    return {
      ok: true,
      hours,
      holidays: holidayRows.map((r) => ({
        date: r.date,
        name: r.name,
        isRecurring: r.isRecurring,
      })),
      serverNow: new Date().toISOString(),
    };
  },
  ['business-hours-context'],
  { revalidate: 60, tags: ['business-hours'] },
);

export async function GET() {
  const result = await loadCachedContext();
  if (!result.ok) {
    return NextResponse.json(result, { status: 503 });
  }
  // serverNow는 캐시 키와 무관하게 최신값으로 갱신
  return NextResponse.json({ ...result, serverNow: new Date().toISOString() });
}
