/**
 * `/api/quick-replies` — RichEditor의 빠른답변 패널용 GET endpoint.
 *
 * - 매니저·어드민 only
 * - 활성(is_active=true) 템플릿만 반환
 * - 정렬: sortOrder asc, title asc (master 서비스 기본)
 *
 * 응답:
 *   { ok: true, items: Array<{ id, title, content, category, sortOrder }> }
 */

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { listQuickReplies } from '@/lib/services/master-quick-replies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let user;
  try {
    user = await requireRole(['manager', 'admin']);
  } catch {
    return NextResponse.json(
      { ok: false, message: '권한이 없습니다' },
      { status: 403 },
    );
  }

  const rl = checkRateLimit(`quick-replies:${user.id}`, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, message: `요청 빈도 초과 (${rl.retryAfter}초 후)` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  try {
    const items = await listQuickReplies(false);
    return NextResponse.json({
      ok: true,
      items: items.map((it) => ({
        id: it.id,
        title: it.title,
        content: it.content,
        category: it.category,
        sortOrder: it.sortOrder,
      })),
    });
  } catch (err) {
    console.error('[api/quick-replies][GET]', err);
    return NextResponse.json(
      { ok: false, message: '빠른답변 조회 중 오류' },
      { status: 500 },
    );
  }
}
