/**
 * 호텔리어 컨택 패널·헤더 배지가 사용할 정책 데이터 엔드포인트.
 *
 * - GET: 현재 운영시간 정책(hours, override 머지 적용) + 향후 30일 + 양력 공휴일.
 * - 클라이언트는 이 응답을 받고 `calculateBusinessStatus`를 1분마다 재호출.
 * - 인증 불필요 (공개 정책 정보).
 *
 * 캐시: 60초. 어드민이 수정하면 `revalidateTag('business-hours', 'default')`로 즉시 무효화.
 *
 * 머지 로직(default → override)은 `loadBusinessHoursContext`에 일원화 (W1 정리).
 */

import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

import { loadBusinessHoursContext } from '@/lib/services/business-hours';
import type { BusinessHoursInput, HolidayInfo } from '@/lib/business-hours/calculate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ContextResponse =
  | { ok: true; hours: BusinessHoursInput; holidays: HolidayInfo[]; serverNow: string }
  | { ok: false; message: string };

const loadCachedContext = unstable_cache(
  async (): Promise<ContextResponse> => {
    const ctx = await loadBusinessHoursContext();
    if (!ctx) {
      return { ok: false, message: 'BUSINESS_HOURS_NOT_CONFIGURED' };
    }
    return {
      ok: true,
      hours: ctx.hours,
      holidays: ctx.holidays,
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
  // serverNow는 캐시 키와 무관하게 최신값으로 갱신 (clock drift 감지용)
  return NextResponse.json({ ...result, serverNow: new Date().toISOString() });
}
