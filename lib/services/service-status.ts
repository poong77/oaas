/**
 * service_status 데이터 액세스 (Server 전용).
 *
 * 운영 패턴:
 *   - 상태 변경 = 새 row INSERT + 직전 active row를 is_active=false + ended_at=now()
 *   - 공개 조회 = where is_active=true order by started_at desc limit 1
 *
 * Phase 2 — LP-03, NT-03, /status, /admin/service-status.
 *
 * DB 미연결 (DATABASE_URL placeholder) 상태에서도 빌드/UI가 깨지지 않도록 graceful.
 */

import 'server-only';
import { desc, eq } from 'drizzle-orm';

import { db } from '@/db';
import {
  serviceStatus,
  type ServiceStatus,
  type ServiceStatusValue,
} from '@/db/schema';

// re-export for consumers
export type { ServiceStatus, ServiceStatusValue };

const FALLBACK_NORMAL: ServiceStatus = {
  id: 'fallback-normal',
  status: 'normal',
  message: '모든 서비스 정상',
  startedAt: new Date(0),
  endedAt: null,
  createdBy: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  isActive: true,
};

/**
 * 가장 최신의 활성 서비스 상태 1건.
 *
 * DB 미연결이거나 데이터 없음 → fallback 'normal' 반환 (UI 안정성).
 */
export async function getLatestServiceStatus(): Promise<ServiceStatus> {
  if (!db) return FALLBACK_NORMAL;
  try {
    const rows = await db
      .select()
      .from(serviceStatus)
      .where(eq(serviceStatus.isActive, true))
      .orderBy(desc(serviceStatus.startedAt))
      .limit(1);
    return rows[0] ?? FALLBACK_NORMAL;
  } catch (err) {
    console.error('[service-status.getLatestServiceStatus] 실패:', err);
    return FALLBACK_NORMAL;
  }
}

/**
 * 최근 N건 이력 (관리자 화면 + /status 페이지용).
 */
export async function listServiceStatusHistory(
  limit = 20,
): Promise<ServiceStatus[]> {
  if (!db) return [];
  try {
    return await db
      .select()
      .from(serviceStatus)
      .orderBy(desc(serviceStatus.startedAt))
      .limit(limit);
  } catch (err) {
    console.error('[service-status.listServiceStatusHistory] 실패:', err);
    return [];
  }
}

export type ChangeServiceStatusInput = {
  status: ServiceStatusValue;
  message?: string | null;
  userId: string;
};

export type ChangeServiceStatusResult =
  | { ok: true; id: string }
  | { ok: false; reason: string };

/**
 * 서비스 상태 변경.
 *
 * 1) 직전 active row를 is_active=false, ended_at=now() (있다면)
 * 2) 새 row INSERT
 *
 * Neon HTTP 드라이버는 멀티스테이트먼트 트랜잭션을 지원하지 않으므로
 * 단발 SQL 두 번. 관리자만 호출하므로 동시성 충돌은 매우 낮음.
 */
export async function changeServiceStatus(
  input: ChangeServiceStatusInput,
): Promise<ChangeServiceStatusResult> {
  if (!db) {
    return { ok: false, reason: 'DB 미연결 (DATABASE_URL placeholder)' };
  }
  // incident/degraded는 메시지 필수
  if (
    (input.status === 'incident' || input.status === 'degraded') &&
    (!input.message || input.message.trim().length === 0)
  ) {
    return {
      ok: false,
      reason: '장애 / 일부 제한 상태에서는 안내 메시지가 필수입니다.',
    };
  }

  try {
    // 1) 이전 active row 마감
    const now = new Date();
    await db
      .update(serviceStatus)
      .set({ isActive: false, endedAt: now })
      .where(eq(serviceStatus.isActive, true));

    // 2) 새 row insert
    const [created] = await db
      .insert(serviceStatus)
      .values({
        status: input.status,
        message: input.message?.trim() || null,
        startedAt: now,
        createdBy: input.userId,
        isActive: true,
      })
      .returning({ id: serviceStatus.id });

    if (!created) {
      return { ok: false, reason: '새 상태 row 생성 실패' };
    }
    return { ok: true, id: created.id };
  } catch (err) {
    console.error('[service-status.changeServiceStatus] 실패:', err);
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'unknown error',
    };
  }
}

/**
 * UI 표시용 라벨 / tone 매핑.
 * client/server 양쪽에서 사용 가능한 메타는 `./service-status-meta.ts`에 분리.
 * 이 파일은 server-only이므로 client에서는 `service-status-meta`에서 직접 가져온다.
 */
export { SERVICE_STATUS_META } from './service-status-meta';
