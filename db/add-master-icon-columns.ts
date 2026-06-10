/**
 * 마스터 아이콘 이미지 컬럼 추가 (1회성, 멱등).
 *
 * 추가 대상:
 *   - categories.icon_image_url    text
 *   - role_starters.icon_image_url text
 *
 * 운영DB는 drizzle migrate가 깨져 있어(저널 불일치) 직접 멱등 DDL로 적용한다.
 * `ADD COLUMN IF NOT EXISTS` 이므로 여러 번 실행해도 안전.
 *
 * 실행: `npx tsx db/add-master-icon-columns.ts`
 *   - .env.local 의 DATABASE_URL 사용 (현재 운영DB 직결 — envlocal-points-to-prod-db).
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
    await db.execute(
      sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon_image_url text`,
    );
    console.log('✅ categories.icon_image_url 적용');
    await db.execute(
      sql`ALTER TABLE role_starters ADD COLUMN IF NOT EXISTS icon_image_url text`,
    );
    console.log('✅ role_starters.icon_image_url 적용');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('실패:', err);
  process.exit(1);
});
