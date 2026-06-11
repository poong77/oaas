/**
 * 변경이력(감사 로그) 조회 서비스.
 *
 * 마이페이지 '변경이력' 탭: 본인 호텔 구성원이 수행한 데이터 수정 이력 전체.
 * 행위자(userId)가 해당 호텔 소속인 로그를 최신순으로 반환한다.
 */
import { aliasedTable, and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { activityLogs, users } from '@/db/schema';

export type HotelActivityLog = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
  actorId: string | null;
  actorName: string | null;
};

/** 변경이력으로 노출할 데이터 수정 액션 화이트리스트(로그인 등 단순 이벤트 제외). */
const HISTORY_ACTIONS = [
  'user.update',
  'user.create',
  'user.activate',
  'user.deactivate',
  'user.password_change',
  'user.password_reset',
  'solution_link.upsert',
  'solution_link.delete',
] as const;

export async function listActivityLogsByHotel(
  hotelId: string,
  limit = 200,
): Promise<HotelActivityLog[]> {
  if (!db) return [];
  try {
    const actor = aliasedTable(users, 'actor');
    const rows = await db
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        targetType: activityLogs.targetType,
        targetId: activityLogs.targetId,
        payload: activityLogs.payload,
        createdAt: activityLogs.createdAt,
        actorId: actor.id,
        actorName: actor.name,
      })
      .from(activityLogs)
      .innerJoin(actor, eq(activityLogs.userId, actor.id))
      .where(
        and(
          eq(actor.hotelId, hotelId),
          inArray(activityLogs.action, [...HISTORY_ACTIONS]),
        ),
      )
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
    return rows;
  } catch (err) {
    console.error('[activity-logs.listActivityLogsByHotel] 실패:', err);
    return [];
  }
}
