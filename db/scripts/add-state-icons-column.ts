/**
 * business_hours_default에 state_icons jsonb 컬럼 추가 (2026-05-30).
 * 어드민이 운영 상태별 아이콘을 마스터에서 편집할 수 있도록.
 *
 * 실행: npx tsx db/scripts/add-state-icons-column.ts
 * 재실행 안전 (IF NOT EXISTS + 누락된 행만 backfill).
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
if (!DATABASE_URL || DATABASE_URL.includes('placeholder')) {
  console.error('DATABASE_URL 미설정');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log('Adding state_icons column to business_hours_default...');
  // 1) 컬럼 추가 (nullable 임시)
  await sql`ALTER TABLE business_hours_default ADD COLUMN IF NOT EXISTS state_icons jsonb`;
  // 2) DEFAULT 설정
  await sql`ALTER TABLE business_hours_default ALTER COLUMN state_icons SET DEFAULT '{"open":"Headset","lunch":"Coffee","intake_closed":"CircleAlert","closed":"DoorClosed"}'::jsonb`;
  // 3) NULL 행 backfill
  const r = await sql`UPDATE business_hours_default SET state_icons = '{"open":"Headset","lunch":"Coffee","intake_closed":"CircleAlert","closed":"DoorClosed"}'::jsonb WHERE state_icons IS NULL RETURNING id`;
  console.log(`  backfilled ${r.length} rows.`);
  // 4) NOT NULL 적용
  await sql`ALTER TABLE business_hours_default ALTER COLUMN state_icons SET NOT NULL`;
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
