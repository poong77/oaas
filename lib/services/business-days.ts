/**
 * 영업일 계산 — DI-01 대시보드 (장기 지연·평균 해결 소요).
 *
 * 영업일 = 주말(토·일) + `business_holidays`(is_active) 제외.
 * KST 달력일 기준. (한국은 DST 없음 — 정오 기준으로 요일 안정 계산)
 */

import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { businessHolidays } from '@/db/schema';
import { kstYmd } from '@/lib/date/kst';

/** 'YYYY-MM-DD'의 KST 요일 (0=일 ~ 6=토). 정오 기준으로 경계 안전. */
function dowKst(ymd: string): number {
  return new Date(`${ymd}T12:00:00+09:00`).getUTCDay();
}

/** 'YYYY-MM-DD'에 n일 더한 KST 날짜 문자열. */
function addDaysYmd(ymd: string, n: number): string {
  const base = new Date(`${ymd}T12:00:00+09:00`);
  base.setUTCDate(base.getUTCDate() + n);
  return kstYmd(base);
}

/** 활성 공휴일 'YYYY-MM-DD' 집합 로드. */
export async function loadHolidaySet(): Promise<Set<string>> {
  if (!db) return new Set();
  try {
    const rows = await db
      .select({ date: businessHolidays.date })
      .from(businessHolidays)
      .where(eq(businessHolidays.isActive, true));
    // date 컬럼은 'YYYY-MM-DD' 문자열로 반환됨.
    return new Set(rows.map((r) => String(r.date).slice(0, 10)));
  } catch (err) {
    console.error('[business-days.loadHolidaySet] 실패:', err);
    return new Set();
  }
}

/**
 * start 다음 날부터 end 당일까지의 영업일 수.
 * 접수 후 경과 영업일(elapsed) 산출에 사용. start>=end면 0.
 */
export function businessDaysBetween(
  start: Date,
  end: Date,
  holidays: Set<string>,
): number {
  if (end.getTime() <= start.getTime()) return 0;
  const endYmd = kstYmd(end);
  let cur = addDaysYmd(kstYmd(start), 1);
  let count = 0;
  let guard = 0;
  while (cur <= endYmd && guard++ < 4000) {
    const dow = dowKst(cur);
    if (dow !== 0 && dow !== 6 && !holidays.has(cur)) count++;
    cur = addDaysYmd(cur, 1);
  }
  return count;
}
