/**
 * AC-11 공개 API — 새 비밀번호 설정 완료 (마지막 단계).
 * 토큰(+sms는 코드검증 완료)이 유효해야만 변경.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { completeReset } from '@/lib/services/password-reset';
import { checkRateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request-ip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  token: z.string().min(10).max(200),
  newPassword: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = checkRateLimit(`pwreset-complete:${ip}`, 10);
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

  const result = await completeReset(parsed.data.token, parsed.data.newPassword, ip);
  if (!result.ok) {
    const status = result.error === 'INTERNAL_ERROR' ? 500 : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
