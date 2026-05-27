/**
 * 감사 로그 (fire-and-forget).
 *
 * 사용 예:
 *   logActivity({
 *     userId: ctx.user.id,
 *     action: 'user.role_change',
 *     targetType: 'user',
 *     targetId: targetUser.id,
 *     payload: { before: 'manager', after: 'admin' },
 *   });
 *
 * 호출부는 await 하지 않음. 저장 실패가 메인 로직 중단을 일으키면 안 된다 (dev-rules.md §5).
 */

import { db } from '@/db';
import { activityLogs } from '@/db/schema';

export type LogActivityInput = {
  userId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
};

export function logActivity(input: LogActivityInput): void {
  // fire-and-forget: 호출 즉시 반환, 실패는 console.warn으로만
  Promise.resolve()
    .then(async () => {
      if (!db) {
        // DB 미연결 — 임시값 시점에는 콘솔에만 남기고 무시
        return;
      }
      await db.insert(activityLogs).values({
        userId: input.userId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        payload: input.payload ?? {},
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      });
    })
    .catch((err) => {
      console.warn(
        `[audit] action=${input.action} 기록 실패:`,
        err instanceof Error ? err.message : err,
      );
    });
}
