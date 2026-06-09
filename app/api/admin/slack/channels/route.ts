/**
 * `GET /api/admin/slack/channels?q=...` — 어드민 전용 Slack 채널 검색.
 *
 * 호텔 ↔ Slack 채널 연동 UI(채널 선택 콤보박스)에서 사용.
 * - 채널명(부분일치) 또는 채널 ID(`C…`/`G…`) 직접 입력 모두 지원.
 * - 결과: { id, name, isPrivate, isMember }[]
 *
 * 토큰/스코프 미설정 시 ok:false + reason='slack_not_configured' (UI에서 안내).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/permissions';
import { searchSlackChannels } from '@/lib/notifications/slack-admin';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json(
      { ok: false, items: [], message: '권한이 없습니다' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();

  const result = await searchSlackChannels(q, 20);
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      items: result.items,
      reason: result.error ?? 'slack_error',
    });
  }
  return NextResponse.json({ ok: true, items: result.items });
}
