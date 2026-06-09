/**
 * AC-11 공개 API — 재설정 요청 발급·발송 (3단계).
 * 이메일 = 재설정 링크, 문자 = 6자리 인증코드.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createResetRequest } from '@/lib/services/password-reset';
import { checkRateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request-ip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  userId: z.string().uuid(),
  channel: z.enum(['email', 'sms']),
});

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rlIp = checkRateLimit(`pwreset-request:${ip}`, 5);
  if (!rlIp.ok) {
    return NextResponse.json(
      { ok: false, error: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rlIp.retryAfter) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'INVALID_INPUT' }, { status: 400 });
  }

  // 계정별 발송 폭주 방지 (코드/링크 재발송 남용 차단).
  const rlUser = checkRateLimit(`pwreset-request-user:${parsed.data.userId}`, 3);
  if (!rlUser.ok) {
    return NextResponse.json(
      { ok: false, error: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rlUser.retryAfter) } },
    );
  }

  const result = await createResetRequest(parsed.data.userId, parsed.data.channel, ip);
  if (!result.ok) {
    const status = result.error === 'CHANNEL_UNAVAILABLE' ? 400 : 500;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
