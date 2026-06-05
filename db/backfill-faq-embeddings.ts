/**
 * FAQ 임베딩 백필 — v1.7 시맨틱 검색 (FAQ 확대).
 *
 * 실행: `npm run db:backfill-faq-embeddings`
 *   - DATABASE_URL + OPENAI_API_KEY 필요 (.env.local / .env).
 *   - embedding이 비어있는(is_active=true) FAQ만 대상.
 *   - 멱등: 이미 임베딩 있는 FAQ는 건너뜀. 중단 후 재실행해도 안전.
 *   - OpenAI 오류(quota 등) 발생 시 해당 FAQ는 skip하고 계속 — 부분 성공 허용.
 *
 * FAQ를 새로 생성/수정하면 자동으로 임베딩이 생성되므로(lib/services/faqs.ts),
 * 이 스크립트는 "기존 데이터 1회 채우기" + "키 활성화 후 일괄 보정" 용도.
 * 입력 텍스트는 lib/services/embeddings.ts::buildFaqEmbeddingInput과 동일 구성.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' }); // .env.local에 없는 값만 보충 (override 안 함)

import { connectPg } from './connect';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { faqs } from './schema';

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
      console.warn(
        `  OpenAI ${res.status}: ${(await res.text()).slice(0, 160)}`,
      );
      return null;
    }
    const json = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const vec = json.data?.[0]?.embedding;
    return Array.isArray(vec) && vec.length === EMBEDDING_DIM ? vec : null;
  } catch (err) {
    console.warn(`  호출 오류: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

function buildInput(f: {
  question: string;
  keywords: string[];
  answerMarkdown: string;
}): string {
  return [
    f.question,
    (f.keywords ?? []).join(' '),
    (f.answerMarkdown ?? '').slice(0, 2000),
  ]
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
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

  const { db } = connectPg(DATABASE_URL);

  const targets = await db
    .select({
      id: faqs.id,
      question: faqs.question,
      keywords: faqs.keywords,
      answerMarkdown: faqs.answerMarkdown,
    })
    .from(faqs)
    .where(and(eq(faqs.isActive, true), isNull(faqs.embedding)));

  console.log(`📦 임베딩 대상 FAQ: ${targets.length}건`);
  let ok = 0;
  let fail = 0;
  for (const [i, f] of targets.entries()) {
    const vec = await embed(buildInput(f));
    if (!vec) {
      fail++;
      console.log(`  [${i + 1}/${targets.length}] SKIP  ${f.question}`);
      continue;
    }
    await db.update(faqs).set({ embedding: vec }).where(eq(faqs.id, f.id));
    ok++;
    console.log(`  [${i + 1}/${targets.length}] OK    ${f.question}`);
    // 가벼운 rate-limit 완화
    await new Promise((r) => setTimeout(r, 120));
  }

  console.log(
    `\n✅ 완료 — 성공 ${ok} / 실패(skip) ${fail} / 총 ${targets.length}`,
  );
  await db.execute(sql`ANALYZE faqs`);
  process.exit(0);
}

main().catch((err) => {
  console.error('백필 실패:', err);
  process.exit(1);
});
