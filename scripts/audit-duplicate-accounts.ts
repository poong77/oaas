/**
 * [읽기 전용] 이용자(호텔리어) 계정 중 이메일/전화번호 중복 현황 집계.
 * 실행: npx tsx scripts/audit-duplicate-accounts.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { connectPg } from '../db/connect';

async function main() {
  const { sql, pool } = connectPg();
  try {
    const total = await sql<{ c: number }>`
      SELECT count(*)::int AS c FROM users WHERE role = 'hotelier' AND is_active = true
    `;
    console.log(`\n=== 활성 호텔리어 계정: ${total[0].c}명 ===`);

    // 이메일 중복 (대소문자/공백 정규화)
    const emailDup = await sql<{ key: string; cnt: number }>`
      SELECT lower(trim(email)) AS key, count(*)::int AS cnt
      FROM users
      WHERE role = 'hotelier' AND is_active = true AND email IS NOT NULL AND trim(email) <> ''
      GROUP BY lower(trim(email))
      HAVING count(*) > 1
      ORDER BY cnt DESC
    `;
    const emailAffected = emailDup.reduce((s, r) => s + r.cnt, 0);
    console.log(`\n--- 이메일 중복: ${emailDup.length}개 그룹, ${emailAffected}개 계정 ---`);
    for (const r of emailDup.slice(0, 30)) console.log(`  ${r.cnt}회  ${r.key}`);
    if (emailDup.length > 30) console.log(`  ... 외 ${emailDup.length - 30}개 그룹`);

    // 전화번호 중복 (숫자만 추출)
    const phoneDup = await sql<{ key: string; cnt: number }>`
      SELECT regexp_replace(phone, '[^0-9]', '', 'g') AS key, count(*)::int AS cnt
      FROM users
      WHERE role = 'hotelier' AND is_active = true
        AND phone IS NOT NULL AND regexp_replace(phone, '[^0-9]', '', 'g') <> ''
      GROUP BY regexp_replace(phone, '[^0-9]', '', 'g')
      HAVING count(*) > 1
      ORDER BY cnt DESC
    `;
    const phoneAffected = phoneDup.reduce((s, r) => s + r.cnt, 0);
    console.log(`\n--- 전화번호 중복: ${phoneDup.length}개 그룹, ${phoneAffected}개 계정 ---`);
    for (const r of phoneDup.slice(0, 30)) console.log(`  ${r.cnt}회  ${r.key}`);
    if (phoneDup.length > 30) console.log(`  ... 외 ${phoneDup.length - 30}개 그룹`);

    // 참고: 전체 role 기준(매니저/어드민 포함) 이메일 중복도 같이
    const emailAll = await sql<{ groups: number; accts: number }>`
      SELECT count(*)::int AS groups, coalesce(sum(cnt),0)::int AS accts FROM (
        SELECT lower(trim(email)) k, count(*) cnt FROM users
        WHERE is_active = true AND email IS NOT NULL AND trim(email) <> ''
        GROUP BY lower(trim(email)) HAVING count(*) > 1
      ) t
    `;
    console.log(`\n--- (참고) 전체 활성계정 이메일 중복: ${emailAll[0].groups}그룹 / ${emailAll[0].accts}계정 ---`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
