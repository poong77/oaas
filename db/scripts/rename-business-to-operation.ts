/**
 * "영업" → "운영" 도메인 용어 정리 (2026-05-30).
 *
 * 기존 DB 행에 저장된 사용자 표시 텍스트를 갱신.
 * 코드/UI는 별도 sed 일괄 치환 완료, 이 스크립트는 DB 데이터만 처리.
 *
 * 실행: npx tsx db/scripts/rename-business-to-operation.ts
 * 재실행 안전 (이미 "운영"이면 0행 영향).
 */
import 'dotenv/config';
import { connectPg } from '../connect';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
if (!DATABASE_URL || DATABASE_URL.includes('placeholder')) {
  console.error('DATABASE_URL 미설정');
  process.exit(1);
}

async function main() {
  const { sql, pool } = connectPg(DATABASE_URL);
  try {
    console.log('Renaming "영업" → "운영" in DB stored texts...');
    // business_hours_default.emergency_note
    const r1 = await sql`
      UPDATE business_hours_default
      SET emergency_note = REPLACE(emergency_note, '영업', '운영')
      WHERE emergency_note LIKE '%영업%'
      RETURNING id
    `;
    console.log(`  business_hours_default.emergency_note: ${r1.length}행 갱신`);

    // business_hours_overrides.reason (어드민이 입력한 사유에 "영업" 들어있으면)
    const r2 = await sql`
      UPDATE business_hours_overrides
      SET reason = REPLACE(reason, '단축영업', '단축운영')
      WHERE reason LIKE '%단축영업%' AND is_active = true
      RETURNING id
    `;
    console.log(`  business_hours_overrides.reason: ${r2.length}행 갱신`);

    console.log('Done.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
