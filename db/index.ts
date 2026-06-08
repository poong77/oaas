/**
 * Drizzle DB 클라이언트 (node-postgres / 표준 PostgreSQL).
 *
 * 자체 호스팅 EC2 + PostgreSQL 16 환경에 맞춰 `pg` Pool 사용.
 * 기존 Neon HTTP 드라이버에서 이관 (참고 가이드: docs/CICD_PIPELINE.md).
 *
 * 정책:
 *   - DATABASE_URL이 비어있어도 모듈 로드는 실패하지 않게 한다 (graceful degrade).
 *   - 실제 쿼리 시점에 연결 시도하며, 실패하면 호출부에서 처리.
 *   - PgPool은 프로세스 전역에서 단일 인스턴스로 재사용 (HMR 안전).
 *
 * SSL:
 *   - DATABASE_URL에 `sslmode=require`가 포함되거나 NODE_ENV=production일 때 SSL ON.
 *   - 자체 서명 인증서 대응을 위해 `rejectUnauthorized: false` (사내망 RDS/EC2 가정).
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env, isDbConfigured } from '@/lib/env';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function shouldUseSsl(url: string): boolean {
  if (/sslmode=require/i.test(url)) return true;
  if (/sslmode=disable/i.test(url)) return false;
  return env.NODE_ENV === 'production';
}

function getPool(): Pool | null {
  if (!isDbConfigured()) return null;
  if (globalThis.__pgPool) return globalThis.__pgPool;
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ...(shouldUseSsl(env.DATABASE_URL)
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
    max: 10,
  });
  globalThis.__pgPool = pool;
  return pool;
}

function createDb() {
  const pool = getPool();
  if (!pool) return null;
  return drizzle(pool, { schema });
}

export const db = createDb();

export { isDbConfigured };

export async function pingDb(): Promise<{ ok: boolean; message: string }> {
  const pool = getPool();
  if (!pool) {
    return {
      ok: false,
      message: 'DATABASE_URL not configured (Phase 0 graceful degrade)',
    };
  }
  try {
    const result = await pool.query<{ ok: number }>('select 1 as ok');
    return {
      ok: result.rows[0]?.ok === 1,
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
