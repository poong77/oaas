/**
 * ai_models 시드 — ai-reply-assist 모델 마스터 초기 4종.
 *
 * 실행: `npm run db:seed:ai-models`
 *   - DATABASE_URL 필요 (.env.local / .env).
 *   - 멱등: code 기준 이미 있으면 건너뜀 (label/description은 어드민이 편집하므로 덮어쓰지 않음).
 *
 * 라벨 정책(Plan §5.2, 결정 B): label=건당 비용만 / description=1M 단가·특성.
 * 단가는 시드 시점(2026-06) 표기. 변동 시 어드민 화면에서 수정.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';

import { aiModels, type NewAiModel } from './schema';

const DATABASE_URL = process.env.DATABASE_URL ?? '';

const SEED: NewAiModel[] = [
  {
    provider: 'openai',
    code: 'gpt-4.1-mini',
    label: 'GPT-4.1 mini · 약 2.6원/건',
    description: '입$0.40·출$1.60/1M · 빠름·저비용 (일반·정형 문의)',
    tier: 'economy',
    isDefault: false,
    sortOrder: 1,
  },
  {
    provider: 'anthropic',
    code: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5 · 약 7원/건',
    description: '입$1·출$5/1M · 한국어 CS 균형 (기본값)',
    tier: 'balanced',
    isDefault: true,
    sortOrder: 2,
  },
  {
    provider: 'openai',
    code: 'gpt-4o',
    label: 'GPT-4o · 약 16원/건',
    description: '입$2.50·출$10/1M · 고품질',
    tier: 'premium',
    isDefault: false,
    sortOrder: 3,
  },
  {
    provider: 'anthropic',
    code: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6 · 약 21원/건',
    description: '입$3·출$15/1M · 복잡 기술이슈·뉘앙스',
    tier: 'premium',
    isDefault: false,
    sortOrder: 4,
  },
];

async function main() {
  if (!DATABASE_URL.startsWith('postgres')) {
    console.error('❌ DATABASE_URL 미설정. 중단.');
    process.exit(1);
  }
  const db = drizzle(neon(DATABASE_URL));

  let inserted = 0;
  let skipped = 0;
  for (const m of SEED) {
    const existing = await db
      .select({ id: aiModels.id })
      .from(aiModels)
      .where(eq(aiModels.code, m.code))
      .limit(1);
    if (existing.length > 0) {
      skipped++;
      console.log(`  SKIP  ${m.code} (이미 존재)`);
      continue;
    }
    await db.insert(aiModels).values(m);
    inserted++;
    console.log(`  OK    ${m.code} — ${m.label}`);
  }

  console.log(`\n✅ ai_models 시드 완료 — 추가 ${inserted} / 건너뜀 ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('ai_models 시드 실패:', err);
  process.exit(1);
});
