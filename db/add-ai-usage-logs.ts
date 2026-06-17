/**
 * ai_usage_logs 테이블 생성 (1회성, 멱등).
 *
 * 운영DB는 drizzle migrate가 깨져 있어(저널 불일치) 직접 멱등 DDL로 적용한다.
 * `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` 이므로 여러 번
 * 실행해도 안전하며 기존 데이터에 영향 없음(신규 append-only 테이블).
 *
 * 실행: `npx tsx db/add-ai-usage-logs.ts`
 *   - .env.local 의 DATABASE_URL 사용 (현재 운영DB 직결 — envlocal-points-to-prod-db).
 *
 * @see db/schema/ai-usage-logs.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { sql } from 'drizzle-orm';
import { connectPg } from './connect';

const DATABASE_URL = process.env.DATABASE_URL ?? '';

async function main() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL 미설정');
    process.exit(1);
  }
  const { db, pool } = connectPg(DATABASE_URL);
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_usage_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider text NOT NULL,
        model text NOT NULL,
        bucket text,
        input_tokens integer NOT NULL DEFAULT 0,
        output_tokens integer NOT NULL DEFAULT 0,
        cache_read_tokens integer NOT NULL DEFAULT 0,
        cost_usd numeric(14, 8) NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    console.log('✅ ai_usage_logs 테이블 적용');

    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS ai_usage_logs_created_idx ON ai_usage_logs (created_at)`,
    );
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS ai_usage_logs_provider_created_idx ON ai_usage_logs (provider, created_at)`,
    );
    console.log('✅ 인덱스 적용');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('실패:', err);
  process.exit(1);
});
