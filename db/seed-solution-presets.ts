/**
 * 솔루션 프리셋 시드 — 호텔 상세 '이용중 솔루션' 드롭다운 출처.
 *
 * 실행: `npm run db:seed:solution-presets`  (DB 연결 필요)
 *   - label 기준 idempotent. 이미 있으면 건너뜀.
 *   - 기본 솔루션: PMS · CMS · Keyless · Kiosk · HP/BE · Chatbot
 */

import 'dotenv/config';

import { connectPg } from './connect';
import { solutionLinkPresets, type NewSolutionLinkPreset } from './schema';

const DEFAULT_PRESETS: NewSolutionLinkPreset[] = [
  { label: 'PMS', icon: 'Building2', sortOrder: 10 },
  { label: 'CMS', icon: 'LayoutGrid', sortOrder: 20 },
  { label: 'Keyless', icon: 'KeyRound', sortOrder: 30 },
  { label: 'Kiosk', icon: 'MonitorSmartphone', sortOrder: 40 },
  { label: 'HP/BE', icon: 'Globe', sortOrder: 50 },
  { label: 'Chatbot', icon: 'Bot', sortOrder: 60 },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith('postgres')) {
    console.error('[seed:solution-presets] DATABASE_URL 미설정. 종료.');
    process.exit(1);
  }
  const { db, pool } = connectPg(url);
  try {
    const existing = await db
      .select({ label: solutionLinkPresets.label })
      .from(solutionLinkPresets);
    const existingSet = new Set(existing.map((r) => r.label));
    const toInsert = DEFAULT_PRESETS.filter((p) => !existingSet.has(p.label));

    if (toInsert.length === 0) {
      console.log('[seed:solution-presets] 모든 기본 프리셋이 이미 존재합니다.');
      return;
    }
    await db.insert(solutionLinkPresets).values(toInsert);
    console.log(
      `[seed:solution-presets] ${toInsert.length}건 삽입: ${toInsert
        .map((p) => p.label)
        .join(', ')}`,
    );
  } finally {
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed:solution-presets] 실패:', err);
    process.exit(1);
  });
