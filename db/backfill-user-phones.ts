/**
 * 사용자 연락처 백필 — 호텔 마스터(hotels.phone) → users.phone.
 *
 * 호텔에 연결된 사용자(hotel_id) 중 연락처가 비어 있는 사람을
 * 소속 호텔의 연락처로 채운다.
 *   - 이미 연락처가 있는 사용자는 덮어쓰지 않음 (개인 연락처 보존).
 *   - 호텔 연락처가 없는(null) 경우는 채울 값이 없어 건너뜀.
 *
 * 실행:
 *   - 미리보기(기본): `npm run db:backfill-user-phones`
 *   - 실제 반영      : `npm run db:backfill-user-phones -- --apply`
 *   - 기존값도 통일  : `npm run db:backfill-user-phones -- --apply --overwrite`
 *     (--overwrite 시 이미 연락처가 있는 사용자도 호텔 연락처로 덮어씀)
 *   - 멱등: 재실행해도 호텔 연락처와 동일한 값은 변경 없음.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { connectPg } from './connect';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const APPLY = process.argv.includes('--apply');
const OVERWRITE = process.argv.includes('--overwrite');

/** 대상 조건: 기본은 빈 연락처만, --overwrite 시 호텔 연락처와 다른 전체. */
const targetFilter = OVERWRITE
  ? sql`u.phone IS DISTINCT FROM h.phone`
  : sql`(u.phone IS NULL OR u.phone = '')`;

async function main() {
  if (!DATABASE_URL.startsWith('postgres')) {
    console.error('❌ DATABASE_URL 미설정. 중단.');
    process.exit(1);
  }

  const { db } = connectPg(DATABASE_URL);

  // 채워질 대상 미리보기
  const targets = await db.execute<{
    name: string;
    hotel: string;
    hotel_phone: string;
  }>(sql`
    SELECT u.name, h.name AS hotel, h.phone AS hotel_phone
    FROM users u
    JOIN hotels h ON u.hotel_id = h.id
    WHERE ${targetFilter}
      AND h.phone IS NOT NULL AND h.phone <> ''
    ORDER BY u.name COLLATE "ko-KR-x-icu"
  `);

  console.log(`📞 ${OVERWRITE ? '통일(덮어쓰기)' : '채울'} 대상 ${targets.rows.length}명`);
  console.log(APPLY ? '➡️  --apply: 실제 반영합니다.\n' : '👀 미리보기 모드 (반영하려면 -- --apply)\n');

  for (const r of targets.rows.slice(0, 20)) {
    console.log(`  ${r.name}  ←  ${r.hotel_phone}  (${r.hotel})`);
  }
  if (targets.rows.length > 20) console.log(`  ... 외 ${targets.rows.length - 20}명`);

  if (APPLY) {
    const res = await db.execute(sql`
      UPDATE users u
      SET phone = h.phone, updated_at = now()
      FROM hotels h
      WHERE u.hotel_id = h.id
        AND ${targetFilter}
        AND h.phone IS NOT NULL AND h.phone <> ''
    `);
    console.log(`\n✅ 반영 완료 — ${res.rowCount ?? targets.rows.length}명 연락처 입력`);
  } else {
    console.log(`\n📝 미리보기 — ${targets.rows.length}명 채울 예정`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('백필 실패:', err);
  process.exit(1);
});
