/**
 * Drizzle DB 클라이언트 (Neon serverless).
 *
 * Phase 0 정책:
 *   - DATABASE_URL이 비어있어도 모듈 로드는 실패하지 않게 한다 (graceful degrade).
 *   - 실제 쿼리 시점에 연결 시도하며, 실패하면 호출부에서 처리.
 *
 * Phase 1 진입 시:
 *   - 실제 스키마를 `db/schema/`에 작성하고 `drizzle-kit push`로 반영.
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env, isDbConfigured } from '@/lib/env';
import * as schema from './schema';

// Neon HTTP 드라이버는 fetch 기반이라 Vercel Edge에서도 동작

/**
 * `db`는 lazy proxy로 노출되어, DATABASE_URL이 비어있는 Phase 0 상태에서도
 * 모듈 import는 성공하고 실제 호출 시에만 에러를 던지도록 한다.
 */
function createDb() {
  if (!isDbConfigured()) {
    return null;
  }
  const sql = neon(env.DATABASE_URL);
  return drizzle(sql, { schema });
}

export const db = createDb();

export { isDbConfigured };

export async function pingDb(): Promise<{ ok: boolean; message: string }> {
  if (!db) {
    return {
      ok: false,
      message: 'DATABASE_URL not configured (Phase 0 graceful degrade)',
    };
  }
  try {
    const sql = neon(env.DATABASE_URL);
    const rows = (await sql`select 1 as ok`) as Array<{ ok: number }>;
    return {
      ok: rows[0]?.ok === 1,
      message: 'database reachable',
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'unknown db error',
    };
  }
}

export { schema };
