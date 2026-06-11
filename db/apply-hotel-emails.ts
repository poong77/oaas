/**
 * 호텔명 → 대표이메일 매핑을 이관 사용자 email 에 반영 (db/data/hotel-emails.tsv).
 *
 * 정책 (사용자 결정 2026-06-02):
 *   - 호텔당 이메일 1개만 부여(리스트 첫번째). 같은 호텔의 나머지 유저는 더미 유지.
 *   - 이메일 중복 허용 (users.email 유니크 제약 해제됨 — migration 0028).
 *   - 현재 더미(@as.local)인 유저만 갱신. 실이메일 보유자는 보존(덮어쓰지 않음).
 *   - "오아통합테스트"(내부 테스트 호텔)는 제외.
 *   - 호텔당 대상 유저는 username 정렬 후 첫번째(더미 보유자) 1명.
 *   - 멱등: 이미 그 이메일을 가진 유저가 있으면 스킵.
 *
 * 실행: npx tsx db/apply-hotel-emails.ts          (적용)
 *       DRY=1 npx tsx db/apply-hotel-emails.ts    (시뮬레이션)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { connectPg } from './connect';
import { eq, isNotNull } from 'drizzle-orm';
import { users, hotels } from './schema';

const DRY = process.env.DRY === '1';
const EXCLUDE = new Set(['오아통합테스트']);
const norm = (s: string) =>
  s.toLowerCase().replace(/\(구[:\-].*?\)/g, '').replace(/[\s\-_.,·&()\[\]'"]/g, '');

async function main() {
  const { db } = connectPg();

  // 리스트 파싱: 호텔명(정규화) → 이메일[] (distinct, 순서 보존)
  const lines = readFileSync(join(import.meta.dirname, 'data', 'hotel-emails.tsv'), 'utf-8')
    .split('\n').filter((l) => l.trim());
  const listMap = new Map<string, string[]>();
  for (const l of lines) {
    const [name, email] = l.split('\t');
    if (!name || !email) continue;
    const k = norm(name);
    if (!listMap.has(k)) listMap.set(k, []);
    const e = email.trim();
    if (!listMap.get(k)!.includes(e)) listMap.get(k)!.push(e);
  }

  const rows = await db
    .select({ uid: users.id, un: users.username, em: users.email, hn: hotels.name })
    .from(users).leftJoin(hotels, eq(users.hotelId, hotels.id))
    .where(isNotNull(users.username));

  const byHotel = new Map<string, { hn: string; us: typeof rows }>();
  for (const r of rows) {
    const k = r.hn ? norm(r.hn) : '(none)';
    if (!byHotel.has(k)) byHotel.set(k, { hn: r.hn ?? '(없음)', us: [] as any });
    byHotel.get(k)!.us.push(r);
  }

  const applied: { un: string; hn: string; email: string }[] = [];
  let skipExisting = 0;
  let skipNoDummy = 0;

  for (const [k, { hn, us }] of byHotel) {
    if (EXCLUDE.has(hn.trim())) continue;
    const emails = listMap.get(k);
    if (!emails || emails.length === 0) continue; // 미매칭 호텔
    const targetEmail = emails[0]!;
    // 이미 그 이메일을 가진 유저가 호텔에 있으면 완료된 것 → 스킵 (멱등)
    if (us.some((u) => (u.em ?? '').toLowerCase() === targetEmail.toLowerCase())) {
      skipExisting++;
      continue;
    }
    // 더미 보유 유저 중 username 정렬 첫번째 1명에게만 부여
    const dummies = us
      .filter((u) => (u.em ?? '').endsWith('@as.local'))
      .sort((a, b) => (a.un ?? '').localeCompare(b.un ?? ''));
    if (dummies.length === 0) { skipNoDummy++; continue; }
    const u = dummies[0]!;
    applied.push({ un: u.un!, hn, email: targetEmail });
    if (!DRY) {
      await db.update(users).set({ email: targetEmail }).where(eq(users.id, u.uid));
    }
  }

  console.log(`${DRY ? '[DRY] ' : ''}신규 적용: ${applied.length}건 / 기존완료 스킵: ${skipExisting} / 더미없음 스킵: ${skipNoDummy}`);
  applied.forEach((a) => console.log(`  ${a.un}  ←  ${a.email}  (${a.hn})`));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
