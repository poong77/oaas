/**
 * Vercel Cron — 운영시간 예약 변경(business_hours_overrides) 상태 자동 전환.
 *
 * 스케줄: 매일 00:01 KST (vercel.json crons: `1 15 * * *` UTC)
 * 인증: `Authorization: Bearer ${CRON_SECRET}` 검증
 *
 * 동작:
 *   1. effective_from <= today 인 scheduled 행 → status='active'  (applyScheduledOverrides)
 *   2. effective_until < today 인 active 행 → status='expired'   (expireFinishedOverrides)
 *   3. effective_from == today+1 인 scheduled 행 → 슬랙 알림 (notifyUpcomingOverrides, P3)
 *   4. revalidateTag('business-hours') — 호텔리어 컨택 패널 즉시 반영
 *
 * 모든 전환은 activity_logs에 기록 (action='business_hours.override.applied|expired').
 *
 * 실패해도 다음 cron에서 재시도 가능 (idempotent — 이미 active인 행은 다시 전환 안 됨).
 */

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

import { env } from '@/lib/env';
import {
  applyScheduledOverrides,
  expireFinishedOverrides,
  notifyUpcomingOverrides,
} from '@/lib/services/business-hours';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // 인증 (cleanup-drafts와 동일 패턴)
  const expected = env.CRON_SECRET;
  if (process.env.NODE_ENV === 'production' || expected) {
    const authHeader = request.headers.get('authorization');
    if (!expected || authHeader !== `Bearer ${expected}`) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401 },
      );
    }
  }

  try {
    // KST 오늘 (Vercel은 UTC지만 정책 기준은 KST)
    const today = new Date()
      .toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
      .slice(0, 10);

    const [applied, expired, reminded] = await Promise.all([
      applyScheduledOverrides(today),
      expireFinishedOverrides(today),
      notifyUpcomingOverrides(today),
    ]);

    if (applied.applied > 0 || expired.expired > 0) {
      revalidateTag('business-hours', 'default');
    }

    return NextResponse.json({
      ok: true,
      today,
      applied: applied.applied,
      expired: expired.expired,
      reminded: reminded.notified,
    });
  } catch (err) {
    console.error('[cron.business-hours-overrides] 실패:', err);
    return NextResponse.json(
      { ok: false, message: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
