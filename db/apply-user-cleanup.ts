/**
 * 일회성 데이터 정리 (변경 발생):
 *  ① 호텔 '오아통합테스트' 소속 활성 호텔리어 → role=manager 승격
 *  ② @as.local 플레이스홀더 이메일 활성 호텔리어 → is_active=false 비활성화
 *     (①에서 매니저로 바뀐 계정은 role=hotelier 조건에서 자동 제외)
 *  + activity_logs 감사 로그 기록 (어드민 'OA 어드민' 귀속)
 *
 * 멱등: 이미 처리된 건은 조건상 재선택되지 않음.
 * 실행: npx tsx db/apply-user-cleanup.ts            (DRY RUN, 미리보기)
 *       npx tsx db/apply-user-cleanup.ts --apply    (실제 반영)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { connectPg } from './connect';
import { sql, inArray } from 'drizzle-orm';
import { users, activityLogs } from './schema';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const APPLY = process.argv.includes('--apply');
const HOTEL_NAME = '오아통합테스트';

async function main() {
  if (!DATABASE_URL.startsWith('postgres')) {
    console.error('❌ DATABASE_URL 미설정. 중단.');
    process.exit(1);
  }
  const { db } = connectPg(DATABASE_URL);

  // 귀속 어드민 (감사 로그 actor)
  const adminRows = (await db.execute(sql`
    SELECT id FROM users WHERE role='admin' AND email='admin@oa.local' LIMIT 1
  `)).rows as any[];
  const actorId = adminRows[0]?.id ?? null;

  // 호텔 id
  const hotelRows = (await db.execute(sql`
    SELECT id FROM hotels WHERE name = ${HOTEL_NAME} LIMIT 1
  `)).rows as any[];
  const hotelId = hotelRows[0]?.id;
  if (!hotelId) {
    console.error(`❌ 호텔 '${HOTEL_NAME}' 미발견. 중단.`);
    process.exit(1);
  }

  // ── ① 승격 대상 미리보기: 활성 호텔리어 @ 오아통합테스트
  const promoteTargets = (await db.execute(sql`
    SELECT id, name, username, email
    FROM users
    WHERE role='hotelier' AND is_active=true AND hotel_id=${hotelId}
    ORDER BY name
  `)).rows as any[];

  // ── ② 비활성화 대상 미리보기: 활성 호텔리어 @as.local, 단 위 호텔 제외
  const deactivateTargets = (await db.execute(sql`
    SELECT id, name, username, email
    FROM users
    WHERE role='hotelier' AND is_active=true
      AND email LIKE '%@as.local'
      AND hotel_id IS DISTINCT FROM ${hotelId}
    ORDER BY name
  `)).rows as any[];

  console.log(`\n${APPLY ? '🟢 APPLY' : '🟡 DRY RUN'} — 변경 미리보기`);
  console.log(`\n① 매니저 승격 대상 (오아통합테스트 활성 호텔리어): ${promoteTargets.length}건`);
  console.table(promoteTargets.map((r) => ({ name: r.name, username: r.username, email: r.email })));
  console.log(`\n② 비활성화 대상 (@as.local 활성 호텔리어, 오아통합테스트 제외): ${deactivateTargets.length}건`);
  console.log(`   (목록 길어 처음 10건만 표시)`);
  console.table(deactivateTargets.slice(0, 10).map((r) => ({ name: r.name, username: r.username, email: r.email })));

  if (!APPLY) {
    console.log('\n👉 실제 반영하려면 --apply 플래그로 재실행하세요.');
    process.exit(0);
  }

  // ── 실행 ① 승격
  const promotedIds = promoteTargets.map((r) => r.id as string);
  if (promotedIds.length > 0) {
    await db.update(users)
      .set({ role: 'manager', updatedAt: new Date() })
      .where(inArray(users.id, promotedIds));
    await db.insert(activityLogs).values(
      promoteTargets.map((t) => ({
        userId: actorId,
        action: 'user.role_change',
        targetType: 'user',
        targetId: t.id as string,
        payload: { before: 'hotelier', after: 'manager', reason: 'bulk: 오아통합테스트 호텔 OA 내부 계정 매니저 전환', via: 'db/apply-user-cleanup.ts' },
      })),
    );
  }
  console.log(`✅ ① 매니저 승격 완료: ${promotedIds.length}건`);

  // ── 실행 ② 비활성화
  const deacIds = deactivateTargets.map((r) => r.id as string);
  if (deacIds.length > 0) {
    await db.update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(inArray(users.id, deacIds));
    // 감사 로그 청크 삽입 (152건)
    const logRows = deactivateTargets.map((t) => ({
      userId: actorId,
      action: 'user.deactivate',
      targetType: 'user',
      targetId: t.id as string,
      payload: { reason: 'bulk: 이메일 미보유(@as.local 플레이스홀더) 호텔리어 비활성화', via: 'db/apply-user-cleanup.ts' },
    }));
    for (let i = 0; i < logRows.length; i += 100) {
      await db.insert(activityLogs).values(logRows.slice(i, i + 100));
    }
  }
  console.log(`✅ ② 비활성화 완료: ${deacIds.length}건`);

  // 최종 분포
  const dist = (await db.execute(sql`
    SELECT role, is_active, count(*)::int cnt FROM users GROUP BY role, is_active ORDER BY role, is_active
  `)).rows as any[];
  console.log('\n=== 처리 후 role/is_active 분포 ===');
  console.table(dist);

  await db.execute(sql`ANALYZE users`);
  process.exit(0);
}

main().catch((err) => { console.error('실패:', err); process.exit(1); });
