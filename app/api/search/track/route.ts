/**
 * POST /api/search/track — 검색 결과 클릭 / 접수 전환 기록 (Layer B).
 *
 * 공개 엔드포인트(비로그인 검색 가능). best-effort, 항상 204.
 * navigator.sendBeacon 으로 호출되며 페이지 이탈에도 안전.
 */

import { NextResponse } from 'next/server';
import { recordClick, recordTicketIntent } from '@/lib/services/search-logs';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      type?: 'click' | 'ticket';
      logId?: string;
      kind?: string;
      ref?: string;
      position?: number;
    };
    if (!body.logId || !UUID_RE.test(body.logId)) {
      return new NextResponse(null, { status: 204 });
    }
    if (body.type === 'ticket') {
      await recordTicketIntent(body.logId);
    } else if (body.type === 'click' && body.kind && body.ref) {
      await recordClick({
        logId: body.logId,
        kind: String(body.kind).slice(0, 20),
        ref: String(body.ref).slice(0, 200),
        position: Number(body.position) || 0,
      });
    }
  } catch {
    // best-effort — 무시
  }
  return new NextResponse(null, { status: 204 });
}
