/**
 * 티켓 임베딩 백필 — ai-reply-assist 시맨틱 추천/유사 티켓.
 *
 * 실행: `npm run db:backfill-ticket-embeddings`
 *   - DATABASE_URL + OPENAI_API_KEY 필요 (.env.local / .env).
 *   - embedding이 비어있는 티켓만 대상 (is_active 무관 — 이력 보존 원칙상 전수 추천 대상).
 *   - 멱등: 이미 임베딩 있는 티켓은 건너뜀. 중단 후 재실행해도 안전.
 *   - OpenAI 오류(quota 등) 발생 시 해당 건 skip하고 계속 — 부분 성공 허용.
 *
 * 티켓을 새로 접수/수정하면 자동으로 임베딩이 생성되므로(lib/services/tickets.ts),
 * 이 스크립트는 "기존 데이터 1회 채우기" + "키 활성화 후 일괄 보정" 용도.
 * articles/faqs와 동일 모델(text-embedding-3-small, 1536) — 벡터공간 일치 필수.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, isNull, sql } from 'drizzle-orm';

import { tickets } from './schema';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;

async function embed(text: string): Promise<number[] | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, input: text.slice(0, 8000) }),
    });
    if (!res.ok) {
      console.warn(`  OpenAI ${res.status}: ${(await res.text()).slice(0, 160)}`);
      return null;
    }
    const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    const vec = json.data?.[0]?.embedding;
    return Array.isArray(vec) && vec.length === EMBEDDING_DIM ? vec : null;
  } catch (err) {
    console.warn(`  호출 오류: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/** 임베딩 입력 — title + content (lib/services/embeddings.buildTicketEmbeddingInput과 동일 규칙). */
function buildInput(t: { title: string; content: string }): string {
  return [t.title, t.content]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 8000);
}

async function main() {
  if (!DATABASE_URL.startsWith('postgres')) {
    console.error('❌ DATABASE_URL 미설정. 중단.');
    process.exit(1);
  }
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY 미설정. 중단.');
    process.exit(1);
  }

  const db = drizzle(neon(DATABASE_URL));

  const targets = await db
    .select({ id: tickets.id, title: tickets.title, content: tickets.content })
    .from(tickets)
    .where(isNull(tickets.embedding));

  console.log(`📦 임베딩 대상 티켓: ${targets.length}건`);
  let ok = 0;
  let fail = 0;
  for (const [i, t] of targets.entries()) {
    const vec = await embed(buildInput(t));
    if (!vec) {
      fail++;
      console.log(`  [${i + 1}/${targets.length}] SKIP  ${t.title}`);
      continue;
    }
    await db.update(tickets).set({ embedding: vec }).where(eq(tickets.id, t.id));
    ok++;
    console.log(`  [${i + 1}/${targets.length}] OK    ${t.title}`);
    await new Promise((r) => setTimeout(r, 120)); // 가벼운 rate-limit 완화
  }

  console.log(`\n✅ 완료 — 성공 ${ok} / 실패(skip) ${fail} / 총 ${targets.length}`);
  await db.execute(sql`ANALYZE tickets`);
  process.exit(0);
}

main().catch((err) => {
  console.error('백필 실패:', err);
  process.exit(1);
});
