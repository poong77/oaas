/**
 * Vercel Cron — editor_drafts 30일 경과 정리.
 *
 * 스케줄: 매일 03:00 KST (vercel.json crons)
 * 인증: `Authorization: Bearer ${CRON_SECRET}` 검증
 *
 * 동작:
 *   - is_active=true인 draft 중 updated_at < (지금 - 30일) 대상으로 is_active=false 처리
 *   - soft delete (이력 보존)
 *   - 실패 시 500 + 다음 cron에서 재시도
 *
 * 후속: 별도 cleanup-blob-orphans cron 추가 가능 (Vercel Blob 정리)
 */

import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { cleanupOldDrafts } from '@/lib/services/editor-drafts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_RETENTION_DAYS = 30;

export async function GET(request: Request) {
  // Vercel Cron 인증 — CRON_SECRET이 설정되어 있고 Bearer 헤더와 일치해야 함.
  // 로컬/개발 환경에서는 CRON_SECRET 미설정 시 인증 스킵 (단, NODE_ENV=production일 땐 필수).
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
    const cleaned = await cleanupOldDrafts(DEFAULT_RETENTION_DAYS);
    return NextResponse.json({
      ok: true,
      cleaned,
      retentionDays: DEFAULT_RETENTION_DAYS,
      executedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[cron/cleanup-drafts] 실패:', err);
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : 'cleanup 실패',
      },
      { status: 500 },
    );
  }
}
