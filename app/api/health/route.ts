import { NextResponse } from 'next/server';
import { isDbConfigured, pingDb } from '@/db';

// Phase 0 graceful degrade:
//   - DATABASE_URL이 없으면 db.configured=false, db.ok=false, 200으로 응답 (서비스 자체는 살아있음)
//   - DATABASE_URL이 있으면 실제 핑을 시도하여 ok 여부를 추가
export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  const configured = isDbConfigured();
  const db = configured
    ? await pingDb()
    : { ok: false, message: 'DATABASE_URL not configured (Phase 0)' };

  return NextResponse.json(
    {
      ok: true,
      service: 'support.oapms.com',
      phase: 0,
      timestamp: new Date().toISOString(),
      uptimeMs: process.uptime ? Math.floor(process.uptime() * 1000) : null,
      db: {
        configured,
        ok: db.ok,
        message: db.message,
      },
      elapsedMs: Date.now() - startedAt,
    },
    { status: 200 },
  );
}
