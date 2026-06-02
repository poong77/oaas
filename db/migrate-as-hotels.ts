/**
 * AS 업체 마스터 이관 — as.oapms.com `comp/list.do` → hotels.
 *
 * 출처: as.oapms.com 업체 목록 365건 (업체명 / 연락처 / 팩스 / 사용여부).
 *   - 데이터: db/data/oa-as-companies.json (목록 페이지 스크래핑 산출물).
 *   - 이관 컬럼: name(업체명, 필수), phone(연락처, 원본 형식 유지).
 *   - 사용여부 '미사용' → is_active=false 로 보존 (소프트 삭제 원칙).
 *   - 원본 comp_key 는 note 에 `[AS이관 comp_key=NNN]` 로 기록 (추적/멱등 키).
 *     oa_pms_hotel_id 는 PMS SSO 전용이라 사용하지 않음.
 *
 * 실행: `npm run db:migrate-as-hotels`
 *   - DATABASE_URL 필요 (.env.local / .env).
 *   - 멱등: 동일 comp_key(note 마커)가 이미 있으면 건너뜀. 재실행 안전.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { ilike, sql } from 'drizzle-orm';

import { hotels, type NewHotel } from './schema';

const DATABASE_URL = process.env.DATABASE_URL ?? '';

type AsCompany = {
  name: string;
  phone: string;
  status: string; // '사용' | '미사용'
  compKey: string;
};

const marker = (compKey: string) => `[AS이관 comp_key=${compKey}]`;

async function main() {
  if (!DATABASE_URL.startsWith('postgres')) {
    console.error('❌ DATABASE_URL 미설정. 중단.');
    process.exit(1);
  }

  const rows = JSON.parse(
    readFileSync(join(import.meta.dirname, 'data', 'oa-as-companies.json'), 'utf-8'),
  ) as AsCompany[];

  const db = drizzle(neon(DATABASE_URL));

  const before = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM hotels`);
  console.log(`📊 이관 전 hotels: ${before.rows[0]?.n ?? 0}건`);
  console.log(`📥 AS 업체 ${rows.length}건 이관 시작...`);

  let created = 0;
  let skipped = 0;
  let inactive = 0;

  for (const c of rows) {
    const name = c.name.trim();
    const phone = c.phone.trim();
    const note = marker(c.compKey);

    // 멱등: 동일 comp_key 마커가 note 에 이미 있으면 스킵
    const existing = await db
      .select({ id: hotels.id })
      .from(hotels)
      .where(ilike(hotels.note, `%${note}%`))
      .limit(1);
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const isActive = c.status === '사용';
    if (!isActive) inactive++;

    const row: NewHotel = {
      name,
      phone: phone || null,
      note,
      isActive,
    };
    await db.insert(hotels).values(row);
    created++;
  }

  const after = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM hotels`);
  console.log(
    `\n✅ 이관 완료 — 신규 ${created}건 / 스킵(기존) ${skipped}건 / 비활성 처리 ${inactive}건`,
  );
  console.log(`📊 이관 후 hotels: ${after.rows[0]?.n ?? 0}건`);
  await db.execute(sql`ANALYZE hotels`);
  process.exit(0);
}

main().catch((err) => {
  console.error('마이그레이션 실패:', err);
  process.exit(1);
});
