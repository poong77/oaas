/**
 * `/api/admin/hotels?q=...` — 매니저+어드민 전용.
 *
 * 호텔 검색 (대리 접수 폼 / 사용자 호텔 매핑의 검색형 선택기에서 사용).
 * 매칭은 listHotels 의 collapseSpacing 규칙을 그대로 사용 —
 * 띄어쓰기·하이픈·점 무시 + 소문자(영문 대소문자 무시) 매칭.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { listHotels } from '@/lib/services/users';
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
  const q = (searchParams.get('q') ?? '').trim();

  try {
    const { items } = await listHotels({
      q: q || undefined,
      isActive: true,
      pageSize: 20,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    return NextResponse.json({
      ok: true,
      items: items.map((h) => ({
        id: h.id,
        name: h.name,
        oaPmsHotelId: h.oaPmsHotelId,
      })),
    });
  } catch (err) {
    console.error('[api/admin/hotels] 실패:', err);
    return NextResponse.json(
      { ok: false, items: [], message: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
