/**
 * AC-11 공개 API — 이메일로 재설정 가능 계정 조회 (마스킹, 1단계).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { lookupAccountsByEmail } from '@/lib/services/password-reset';
import { checkRateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request-ip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({ email: z.string().email().max(255) });

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = checkRateLimit(`pwreset-lookup:${ip}`, 20);
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

  const accounts = await lookupAccountsByEmail(parsed.data.email);
  return NextResponse.json({ ok: true, accounts });
}
