/**
 * business_hours_default에 연락처 5개 컬럼만 안전하게 추가.
 * IF NOT EXISTS — 재실행 안전. 다른 마이그레이션 영향 X.
 *
 * 실행: npx tsx db/scripts/add-contact-columns.ts
 *
 * (drizzle-kit push가 다른 세션의 ALTER/DROP을 끼워넣어 위험할 때 우회.)
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
  console.log('Adding 5 contact columns to business_hours_default...');
  await sql`ALTER TABLE business_hours_default ADD COLUMN IF NOT EXISTS main_phone text`;
  await sql`ALTER TABLE business_hours_default ADD COLUMN IF NOT EXISTS main_email text`;
  await sql`ALTER TABLE business_hours_default ADD COLUMN IF NOT EXISTS ars_items jsonb NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE business_hours_default ADD COLUMN IF NOT EXISTS fax_number text`;
  await sql`ALTER TABLE business_hours_default ADD COLUMN IF NOT EXISTS website_url text`;
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
