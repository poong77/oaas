/**
 * 사용자 비밀번호 일괄 초기화 → 기본값 '123456'.
 *
 * 정책 (사용자 요청 2026-06-02):
 *   - 대상: 기본 호텔리어(이용자) 계정. password_hash='123456' 해시 + must_change_password=true.
 *   - 매니저·어드민(OA 운영진)은 보안상 제외 (ALL=1 로 강제 포함 가능).
 *   - 첫 로그인 시 비번 변경 + 정보 입력 안내가 노출됨.
 *
 * 실행:
 *   npx tsx db/reset-passwords-to-default.ts          (호텔리어만)
 *   DRY=1 npx tsx db/reset-passwords-to-default.ts     (시뮬레이션)
 *   ALL=1 npx tsx db/reset-passwords-to-default.ts      (매니저·어드민 포함)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { connectPg } from './connect';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

import { users } from './schema';

const DEFAULT_PASSWORD = '123456';
const DRY = process.env.DRY === '1';
const ALL = process.env.ALL === '1';

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.startsWith('postgres')) {
    console.error('❌ DATABASE_URL 미설정. 중단.');
    process.exit(1);
  }
  const { db } = connectPg(url);

  // 대상 집계
  const counts = await db.execute<{ role: string; n: number }>(
    sql`SELECT role, count(*)::int AS n FROM users GROUP BY role ORDER BY role`,
  );
  console.log('현재 역할별 사용자:', JSON.stringify(counts.rows));

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  const target = ALL
    ? '전체 사용자'
    : "호텔리어(role='hotelier')";
  console.log(
    `${DRY ? '[DRY] ' : ''}대상: ${target} → 비밀번호 '${DEFAULT_PASSWORD}', must_change_password=true`,
  );

  if (DRY) {
    const c = ALL
      ? await db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM users`)
      : await db.execute<{ n: number }>(
          sql`SELECT count(*)::int n FROM users WHERE role='hotelier'`,
        );
    console.log(`[DRY] 변경 예정: ${c.rows[0]?.n ?? 0}건`);
    process.exit(0);
  }

  let updated: number;
  if (ALL) {
    const r = await db
      .update(users)
      .set({ passwordHash, mustChangePassword: true })
      .returning({ id: users.id });
    updated = r.length;
  } else {
    const r = await db
      .update(users)
      .set({ passwordHash, mustChangePassword: true })
      .where(eq(users.role, 'hotelier'))
      .returning({ id: users.id });
    updated = r.length;
  }

  console.log(`✅ 비밀번호 일괄 변경 완료: ${updated}건 → '${DEFAULT_PASSWORD}'`);
  process.exit(0);
}

main().catch((e) => {
  console.error('실패:', e);
  process.exit(1);
});
