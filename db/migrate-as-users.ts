/**
 * AS 사용자 이관 — db/data/oa-as-users.json → users.
 *
 * 출처: as.oapms.com 사용자 401건 (db/scrape-as-users.ts 산출물).
 * 정책 (사용자 요청):
 *   - 아이디(userId) → users.username 그대로 보존. 로그인 시 이메일/아이디 모두 사용.
 *   - 전원 호텔리어(role=hotelier), 직책(title)='담당자'.
 *   - 업체(compKey) → hotels.note 마커 `[AS이관 comp_key=NNN]` 로 매핑하여 hotel_id 연결.
 *   - 사용여부 '미사용' → is_active=false (소프트 삭제 원칙, 이력 보존).
 *   - 기본 비밀번호 '123456' (bcrypt). must_change_password=true → 첫 로그인 시 변경 안내(강제 아님).
 *   - 이메일:
 *       1) 원본 이메일 있으면 사용
 *       2) 없고 아이디가 이메일형(@포함)이면 아이디 사용
 *       3) 둘 다 아니면 '{아이디}@as.local' 더미 (email NOT NULL·unique 충족. 실제 로그인은 아이디로).
 *     ※ hotels 테이블에는 이메일 컬럼이 없어 '호텔 DB 이메일'은 가져올 수 없음 → 더미로 대체.
 *
 * 실행: npm run db:migrate-as-users
 *   - 멱등: 동일 username 이 이미 있으면 건너뜀. 재실행 안전.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { connectPg } from './connect';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

import { users, hotels, type NewUser } from './schema';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const DEFAULT_PASSWORD = '123456';

type ScrapedUser = {
  userId: string;
  name: string;
  company: string;
  level: string;
  status: string; // '사용' | '미사용'
  email: string;
  phone: string;
  compKey: string;
};

function resolveEmail(u: ScrapedUser): string {
  const raw = u.email.trim();
  if (raw) return raw.toLowerCase();
  if (u.userId.includes('@')) return u.userId.trim().toLowerCase();
  return `${u.userId.trim().toLowerCase()}@as.local`;
}

async function main() {
  if (!DATABASE_URL.startsWith('postgres')) {
    console.error('❌ DATABASE_URL 미설정. 중단.');
    process.exit(1);
  }

  const rows = JSON.parse(
    readFileSync(join(import.meta.dirname, 'data', 'oa-as-users.json'), 'utf-8'),
  ) as ScrapedUser[];

  const { db } = connectPg(DATABASE_URL);

  // 1) compKey → hotelId 매핑 테이블 구축
  const hotelRows = await db
    .select({ id: hotels.id, note: hotels.note })
    .from(hotels);
  const compKeyToHotel = new Map<string, string>();
  for (const h of hotelRows) {
    const m = h.note?.match(/comp_key=(\d+)/);
    if (m) compKeyToHotel.set(m[1]!, h.id);
  }
  console.log(`🏨 hotels comp_key 매핑: ${compKeyToHotel.size}건`);

  // 2) 기존 username / email 수집 (멱등 + 충돌 방지)
  const existing = await db
    .select({ username: users.username, email: users.email })
    .from(users);
  const existingUsernames = new Set(
    existing.map((e) => e.username).filter(Boolean) as string[],
  );
  const usedEmails = new Set(
    existing.map((e) => (e.email ?? '').toLowerCase()).filter(Boolean),
  );

  const before = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM users`,
  );
  console.log(`📊 이관 전 users: ${before.rows[0]?.n ?? 0}건`);
  console.log(`📥 AS 사용자 ${rows.length}건 이관 시작...`);

  // 기본 비밀번호 해시 1회 (전원 동일 기본 비번)
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  let created = 0;
  let skipped = 0;
  let inactive = 0;
  let noHotel = 0;
  let dummyEmail = 0;
  const toInsert: NewUser[] = [];

  for (const u of rows) {
    const username = u.userId.trim();
    if (!username) {
      skipped++;
      continue;
    }
    // 멱등: 이미 이관된 아이디면 스킵
    if (existingUsernames.has(username)) {
      skipped++;
      continue;
    }

    // 이메일 결정 + 충돌 시 유니크 보정 ({username}+{n}@as.local)
    let email = resolveEmail(u);
    if (email.endsWith('@as.local')) dummyEmail++;
    let n = 2;
    while (usedEmails.has(email)) {
      email = `${username.toLowerCase()}+${n}@as.local`;
      n++;
    }
    usedEmails.add(email);
    existingUsernames.add(username);

    const hotelId = u.compKey ? compKeyToHotel.get(u.compKey) ?? null : null;
    if (!hotelId) noHotel++;

    const isActive = u.status === '사용';
    if (!isActive) inactive++;

    toInsert.push({
      username,
      email,
      name: u.name?.trim() || username,
      title: '담당자',
      phone: u.phone?.trim() || null,
      passwordHash,
      role: 'hotelier',
      hotelId,
      isActive,
      mustChangePassword: true,
    });
    created++;
  }

  // 3) 청크 삽입 (Neon HTTP 파라미터 한도 고려)
  const CHUNK = 100;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    await db.insert(users).values(chunk);
    console.log(`  …삽입 ${Math.min(i + CHUNK, toInsert.length)}/${toInsert.length}`);
  }

  const after = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM users`,
  );
  console.log(
    `\n✅ 이관 완료 — 신규 ${created}건 / 스킵(기존) ${skipped}건`,
  );
  console.log(`   - 비활성(미사용) 처리: ${inactive}건`);
  console.log(`   - 호텔 미매핑(hotel_id=null): ${noHotel}건`);
  console.log(`   - 더미 이메일(@as.local): ${dummyEmail}건`);
  console.log(`📊 이관 후 users: ${after.rows[0]?.n ?? 0}건`);
  await db.execute(sql`ANALYZE users`);
  process.exit(0);
}

main().catch((err) => {
  console.error('마이그레이션 실패:', err);
  process.exit(1);
});
