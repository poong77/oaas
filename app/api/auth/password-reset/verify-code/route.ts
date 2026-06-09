/**
 * AC-11 공개 API — 문자 인증코드 검증 (4단계, SMS 채널 전용).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { verifyResetCode } from '@/lib/services/password-reset';
import { checkRateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request-ip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  token: z.string().min(10).max(200),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = checkRateLimit(`pwreset-verify:${ip}`, 10);
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

  const result = await verifyResetCode(parsed.data.token, parsed.data.code);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
