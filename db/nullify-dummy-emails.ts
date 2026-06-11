/**
 * 자동 생성(더미) 이메일을 NULL로 변환 + email 컬럼 NOT NULL 해제.
 *
 * 배경: 계정 생성 시 이메일 미입력이면 코드가 더미 이메일을 자동 주입했음.
 *   - 직원 초대:  {username}@noemail.oapms.local
 *   - 어드민 생성: {username}@as.local
 *   - AS 이관:    {username}[+n]@as.local
 * 더미는 발송 불가·검색 노이즈이므로 NULL로 환원한다.
 *
 * 멱등: ALTER ... DROP NOT NULL 은 반복 실행 무해. UPDATE 도 재실행 시 0건.
 * 보존: @oa.local(시드/시스템 계정), example.com 등은 건드리지 않는다.
 *
 * 실행:  npx tsx db/nullify-dummy-emails.ts            (현황만 출력, DRY RUN)
 *        npx tsx db/nullify-dummy-emails.ts --apply     (실제 변환)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { connectPg } from './connect';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const APPLY = process.argv.includes('--apply');

const DUMMY_WHERE = sql`(email LIKE '%@noemail.oapms.local' OR email LIKE '%@as.local')`;

async function main() {
  if (!DATABASE_URL.startsWith('postgres')) {
    console.error('❌ DATABASE_URL 미설정. 중단.');
    process.exit(1);
  }
  const { db } = connectPg(DATABASE_URL);

  const before = (
    await db.execute(sql`
      SELECT
        CASE
          WHEN email LIKE '%@noemail.oapms.local' THEN '@noemail.oapms.local'
          WHEN email LIKE '%@as.local'            THEN '@as.local'
        END AS pattern,
        count(*)::int AS n
      FROM users
      WHERE ${DUMMY_WHERE}
      GROUP BY 1
      ORDER BY 1
    `)
  ).rows as { pattern: string; n: number }[];

  console.log('▶ 변환 대상 더미 이메일 현황:');
  console.table(before);
  const total = before.reduce((a, r) => a + Number(r.n), 0);
  console.log(`   합계: ${total}건`);

  if (!APPLY) {
    console.log('\n(DRY RUN) 실제 변환하려면 --apply 플래그로 재실행하세요.');
    process.exit(0);
  }

  // 1) 컬럼 NOT NULL 해제 (멱등)
  await db.execute(sql`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`);
  console.log('✓ users.email NOT NULL 해제 완료');

  // 2) 더미 → NULL
  await db.execute(sql`UPDATE users SET email = NULL WHERE ${DUMMY_WHERE}`);
  console.log(`✓ 더미 이메일 ${total}건 → NULL 변환 완료`);

  const remain = (
    await db.execute(
      sql`SELECT count(*)::int AS n FROM users WHERE ${DUMMY_WHERE}`,
    )
  ).rows as { n: number }[];
  console.log(`   잔여 더미: ${remain[0]?.n ?? 0}건`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
