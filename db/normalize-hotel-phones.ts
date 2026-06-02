/**
 * 호텔 연락처(phone) 표기 통일 — `normalizeKoreanPhone` 일괄 적용.
 *
 * 대상: AS 이관 업체(note 에 `[AS이관 comp_key=...]` 마커) 전체.
 *   - `0XX-XXX(X)-XXXX` 하이픈 표기로 통일.
 *   - 전화번호가 아닌 값(이메일 오입력·더미 0000) → null.
 *   - 국제번호(+...) → 숫자/＋만 남겨 보존.
 *
 * 실행:
 *   - 미리보기(기본): `npm run db:normalize-hotel-phones`
 *   - 실제 반영      : `npm run db:normalize-hotel-phones -- --apply`
 *   - 멱등: 이미 통일된 값은 변경 없음. 재실행 안전.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, ilike, sql } from 'drizzle-orm';

import { hotels } from './schema';
import { normalizeKoreanPhone } from '../lib/text/phone';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const APPLY = process.argv.includes('--apply');

async function main() {
  if (!DATABASE_URL.startsWith('postgres')) {
    console.error('❌ DATABASE_URL 미설정. 중단.');
    process.exit(1);
  }

  const db = drizzle(neon(DATABASE_URL));

  const rows = await db
    .select({ id: hotels.id, name: hotels.name, phone: hotels.phone })
    .from(hotels)
    .where(ilike(hotels.note, '%AS이관%'));

  console.log(`📞 대상 ${rows.length}건 (AS 이관 업체)`);
  console.log(APPLY ? '➡️  --apply: 실제 반영합니다.\n' : '👀 미리보기 모드 (반영하려면 -- --apply)\n');

  let changed = 0;
  let nulled = 0;
  let unchanged = 0;
  const changes: { name: string; from: string; to: string | null }[] = [];

  for (const r of rows) {
    const before = r.phone ?? '';
    const after = normalizeKoreanPhone(before);
    if ((after ?? '') === before) {
      unchanged++;
      continue;
    }
    changed++;
    if (after === null) nulled++;
    changes.push({ name: r.name, from: before || '(빈값)', to: after });
    if (APPLY) {
      await db.update(hotels).set({ phone: after }).where(eq(hotels.id, r.id));
    }
  }

  // 변경 내역 출력 (null 처리분은 따로 강조)
  const nullChanges = changes.filter((c) => c.to === null);
  const reformat = changes.filter((c) => c.to !== null);

  if (reformat.length) {
    console.log(`── 양식 통일 ${reformat.length}건 ──`);
    for (const c of reformat) console.log(`  ${c.from}  →  ${c.to}   (${c.name})`);
  }
  if (nullChanges.length) {
    console.log(`\n── 전화번호 아님 → null 처리 ${nullChanges.length}건 ──`);
    for (const c of nullChanges) console.log(`  ${c.from}  →  (null)   (${c.name})`);
  }

  console.log(
    `\n${APPLY ? '✅ 반영 완료' : '📝 미리보기'} — 변경 ${changed}건 (재포맷 ${reformat.length} / null ${nulled}) · 유지 ${unchanged}건`,
  );
  if (APPLY) await db.execute(sql`ANALYZE hotels`);
  process.exit(0);
}

main().catch((err) => {
  console.error('정규화 실패:', err);
  process.exit(1);
});
