/**
 * system_settings에 중복으로 남아있던 business_hours·contact_phone 키 제거.
 * 정보가 business_hours_default 테이블로 일원화됨 (P3 정리, 2026-05-30).
 *
 * 실행: npx tsx db/scripts/cleanup-duplicate-settings.ts
 * 재실행 안전 (이미 없으면 0행 영향).
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
  console.log('Cleaning up duplicate system_settings keys...');
  const bh = await sql`DELETE FROM system_settings WHERE key = 'business_hours' RETURNING key`;
  const cp = await sql`DELETE FROM system_settings WHERE key = 'contact_phone' RETURNING key`;
  console.log(`Removed: business_hours=${bh.length}, contact_phone=${cp.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
