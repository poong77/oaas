/**
 * AC-11 공개 API — 호텔별 재설정 가능 계정 목록 (마스킹, 2단계).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { listAccountsForReset } from '@/lib/services/password-reset';
import { checkRateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request-ip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({ hotelId: z.string().uuid() });

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = checkRateLimit(`pwreset-accounts:${ip}`, 30);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'INVALID_INPUT' }, { status: 400 });
  }

  const accounts = await listAccountsForReset(parsed.data.hotelId);
  return NextResponse.json({ ok: true, accounts });
}
