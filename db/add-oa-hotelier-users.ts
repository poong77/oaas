/**
 * OA 사내 호텔리어 계정 일괄 생성 — 오아 호텔&리조트.
 *
 * 사용자 요청(2026-06-04): 13개 계정 생성.
 * 정책:
 *   - 전원 role='hotelier', hotel='오아 호텔&리조트', title(직책)='매니저'.
 *   - 기본 비밀번호 '123456' (bcrypt cost 12), must_change_password=true.
 *   - 로그인은 이메일로 (username 미사용 → null).
 *   - 전화번호는 010-XXXX-XXXX 형식으로 정규화(기존 데이터 형식과 통일).
 *   - 이미 존재하는 이메일(carmen.min, joy.sim)은 덮어쓰기:
 *       비번·호텔·역할(hotelier)·이름·직책·연락처·활성 갱신.
 *   - 멱등: 재실행 안전(존재하면 UPDATE, 없으면 INSERT).
 *
 * 실행:
 *   - 미리보기(기본): npm run db:add-oa-hotelier-users
 *   - 실제 반영      : npm run db:add-oa-hotelier-users -- --apply
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

import { connectPg } from './connect';
import { users, hotels } from './schema';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const DEFAULT_PASSWORD = '123456';
const HOTEL_NAME = '오아 호텔&리조트';
const APPLY = process.argv.includes('--apply');

type Entry = { email: string; phoneRaw: string; title: string; name: string };

// 원본(탭 구분) 그대로 옮김. phoneRaw는 앞자리 0 누락된 형태.
const ENTRIES: Entry[] = [
  { email: 'marc.lee@oapms.co', phoneRaw: '1067050120', title: '매니저', name: '이승준' },
  { email: 'paul.kim@oapms.co', phoneRaw: '1086353357', title: '매니저', name: '김호진' },
  { email: 'carmen.min@oapms.com', phoneRaw: '1099738190', title: '매니저', name: '민초롱' },
  { email: 'loki.moon@oapms.com', phoneRaw: '1094740724', title: '매니저', name: '문정길' },
  { email: 'joy.sim@oapms.com', phoneRaw: '1089502726', title: '매니저', name: '심은수' },
  { email: 'lily.lee@oapms.com', phoneRaw: '1034796325', title: '매니저', name: '이소율' },
  { email: 'kyle.shin@oapms.com', phoneRaw: '1042125410', title: '매니저', name: '신창렬' },
  { email: 'dell.han@oapms.com', phoneRaw: '1020605672', title: '매니저', name: '한동현' },
  { email: 'jay.han@oapms.com', phoneRaw: '1089097195', title: '매니저', name: '한재희' },
  { email: 'noah.ha@oapms.com', phoneRaw: '1049443400', title: '매니저', name: '하지웅' },
  { email: 'jane.park@oapms.com', phoneRaw: '1035580757', title: '매니저', name: '박지혜' },
  { email: 'bibi.lee@oapms.com', phoneRaw: '1033482717', title: '매니저', name: '이예림' },
  { email: 'jenna.lee@oapms.com', phoneRaw: '1039550895', title: '매니저', name: '이지현' },
];

/** 숫자만 추출 → 010-XXXX-XXXX. 앞자리 0 누락(10자리, '10'시작)이면 0 보정. */
function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('10')) d = `0${d}`;
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  return d; // 예외 형식은 숫자만 반환(수동 확인)
}

async function main() {
  if (!DATABASE_URL.startsWith('postgres')) {
    console.error('❌ DATABASE_URL 미설정. 중단.');
    process.exit(1);
  }

  const { db } = connectPg(DATABASE_URL);

  // 호텔 ID 조회
  const hotelRows = await db
    .select({ id: hotels.id, name: hotels.name })
    .from(hotels)
    .where(eq(hotels.name, HOTEL_NAME));
  if (hotelRows.length !== 1) {
    console.error(`❌ 호텔 '${HOTEL_NAME}' 매칭 ${hotelRows.length}건. 1건이어야 함. 중단.`);
    process.exit(1);
  }
  const hotelId = hotelRows[0]!.id;
  console.log(`🏨 ${HOTEL_NAME} → ${hotelId}`);

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  let inserted = 0;
  let updated = 0;
  console.log(APPLY ? '➡️  --apply: 실제 반영합니다.\n' : '👀 미리보기 모드 (반영하려면 -- --apply)\n');

  for (const e of ENTRIES) {
    const email = e.email.trim().toLowerCase();
    const phone = normalizePhone(e.phoneRaw);

    const existing = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`);

    if (existing.length > 0) {
      const target = existing[0]!;
      console.log(
        `  [UPDATE] ${e.name} <${email}> ${phone}  (기존 role=${target.role}→hotelier${existing.length > 1 ? `, 매칭 ${existing.length}건 중 첫 건` : ''})`,
      );
      if (APPLY) {
        await db
          .update(users)
          .set({
            hotelId,
            name: e.name,
            title: e.title,
            phone,
            passwordHash,
            role: 'hotelier',
            isActive: true,
            mustChangePassword: true,
          })
          .where(eq(users.id, target.id));
      }
      updated++;
    } else {
      console.log(`  [INSERT] ${e.name} <${email}> ${phone}`);
      if (APPLY) {
        await db.insert(users).values({
          email,
          username: null,
          name: e.name,
          title: e.title,
          phone,
          passwordHash,
          role: 'hotelier',
          hotelId,
          isActive: true,
          mustChangePassword: true,
        });
      }
      inserted++;
    }
  }

  console.log(`\n✅ ${APPLY ? '반영 완료' : '미리보기'} — 신규 ${inserted}건 / 갱신 ${updated}건 (총 ${ENTRIES.length})`);
  if (APPLY) await db.execute(sql`ANALYZE users`);
  process.exit(0);
}

main().catch((err) => {
  console.error('실패:', err);
  process.exit(1);
});
