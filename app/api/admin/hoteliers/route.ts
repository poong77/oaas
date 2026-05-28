/**
 * `/api/admin/hoteliers?hotelId=...` — 매니저+어드민 전용.
 *
 * 특정 호텔에 속한 활성 호텔리어 목록 (전화 접수 폼에서 사용).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { getCurrentUser } from '@/lib/permissions';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'manager' && user.role !== 'admin')) {
    return NextResponse.json(
      { ok: false, message: '권한이 없습니다' },
      { status: 403 },
    );
  }
  const { searchParams } = new URL(request.url);
  const hotelId = (searchParams.get('hotelId') ?? '').trim();
  if (!hotelId) {
    return NextResponse.json({ ok: true, items: [] });
  }
  if (!db) {
    return NextResponse.json({ ok: true, items: [] });
  }
  try {
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(
        and(
          eq(users.hotelId, hotelId),
          eq(users.role, 'hotelier'),
          eq(users.isActive, true),
        ),
      )
      .orderBy(asc(users.name));
    return NextResponse.json({ ok: true, items: rows });
  } catch (err) {
    console.error('[api/admin/hoteliers] 실패:', err);
    return NextResponse.json(
      { ok: false, items: [], message: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
