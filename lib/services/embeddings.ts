/**
 * OpenAI 임베딩 클라이언트 (Server 전용) — Phase 2 시맨틱 검색.
 *
 * 설계 원칙: **graceful degrade**.
 *   - OPENAI_API_KEY 미설정 / 응답 오류 / quota 초과 시 모두 `null`을 반환한다.
 *   - 호출부(아티클 저장, 검색)는 null이면 임베딩 없이 키워드 검색으로 폴백한다.
 *   - 즉, 키가 살아있지 않아도 서비스는 그대로 동작하며, 키가 활성화되는
 *     순간부터 자동으로 시맨틱 검색이 켜진다.
 *
 * 별도 SDK 의존성 없이 fetch로 직접 호출 (text-embedding-3-small, 1536차원).
 */

import 'server-only';
import { env, isOpenAIConfigured } from '@/lib/env';

const ENDPOINT = 'https://api.openai.com/v1/embeddings';

/** text-embedding-3-small 차원 수. db/schema/articles.ts vector(1536)와 일치. */
export const EMBEDDING_DIM = 1536;

/** 입력 길이 상한 (대략 토큰 폭주 방지). */
const MAX_INPUT_CHARS = 8000;

/**
 * 단일 텍스트 임베딩.
 * @returns 1536차원 벡터, 또는 키 미설정/오류 시 null.
 */
export async function embedText(input: string): Promise<number[] | null> {
  const text = (input ?? '').trim();
  if (!text || !isOpenAIConfigured()) return null;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_EMBEDDING_MODEL,
        input: text.slice(0, MAX_INPUT_CHARS),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(
        `[embeddings.embedText] OpenAI ${res.status}:`,
        body.slice(0, 200),
      );
      return null;
    }
    const json = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const vec = json.data?.[0]?.embedding;
    return Array.isArray(vec) && vec.length === EMBEDDING_DIM ? vec : null;
  } catch (err) {
    console.warn(
      '[embeddings.embedText] 호출 오류:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * 아티클 임베딩 입력 텍스트 구성.
 * title + summary + keywords + 본문 앞부분을 합쳐 의미 표현을 만든다.
 */
export function buildArticleEmbeddingInput(a: {
  title: string;
  summary?: string | null;
  summary30s?: string | null;
  keywords?: string[] | null;
  bodyMarkdown?: string | null;
}): string {
  const parts = [
    a.title,
    a.summary ?? a.summary30s ?? '',
    (a.keywords ?? []).join(' '),
    (a.bodyMarkdown ?? '').slice(0, 4000),
  ];
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

/**
 * v1.7 — FAQ 임베딩 입력 텍스트 구성.
 * question + keywords + answer 앞부분. FAQ는 아티클보다 짧으므로 본문 상한을 줄인다.
 */
export function buildFaqEmbeddingInput(f: {
  question: string;
  keywords?: string[] | null;
  answerMarkdown?: string | null;
}): string {
  const parts = [
    f.question,
    (f.keywords ?? []).join(' '),
    (f.answerMarkdown ?? '').slice(0, 2000),
  ];
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

/**
 * ai-reply-assist — 티켓 임베딩 입력 텍스트 구성.
 * title + content. 추천/유사티켓 검색용. db/backfill-ticket-embeddings.ts와 동일 규칙.
 */
export function buildTicketEmbeddingInput(t: {
  title: string;
  content?: string | null;
}): string {
  return [t.title, t.content ?? '']
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

/** number[] → pgvector 리터럴 문자열 `[0.1,0.2,...]`. */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}
