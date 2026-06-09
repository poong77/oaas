/**
 * AC-11 공개 API — 호텔 검색 (비밀번호 찾기 1단계).
 * 미인증 접근. IP rate limit 적용.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { searchHotelsForReset } from '@/lib/services/password-reset';
import { checkRateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/request-ip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({ q: z.string().min(1).max(100) });

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = checkRateLimit(`pwreset-search:${ip}`, 30);
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

  const hotels = await searchHotelsForReset(parsed.data.q);
  return NextResponse.json({ ok: true, hotels });
}
