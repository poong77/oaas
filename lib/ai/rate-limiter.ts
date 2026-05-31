/**
 * AI 호출 rate limiter — sliding window (메모리 기반).
 *
 * Phase 3 (A5): 매니저당 분당 10회 / 일 200회
 * Phase 4 (A6 재편집): 매니저당 분당 5회 / 일 100회
 *
 * 메모리 한정 — Vercel 서버리스에서 인스턴스 분리 시 정확도 낮음.
 * v2에서 Upstash Redis로 교체 검토.
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §5-4
 */

import 'server-only';

const windows = new Map<string, { minute: number[]; day: number[] }>();

export class RateLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitExceededError';
  }
}

export type RateLimitConfig = {
  perMin: number;
  perDay: number;
  /** key prefix — 다른 기능과 카운터 분리 (예: 'ai-assist', 'ai-rewrite'). */
  bucket?: string;
};

/**
 * 호출 카운트 +1 (한도 초과 시 throw).
 *
 * @throws RateLimitExceededError
 */
export async function rateLimitOrThrow(
  userId: string,
  opts: RateLimitConfig,
): Promise<void> {
  const key = `${opts.bucket ?? 'default'}:${userId}`;
  const now = Date.now();
  const w = windows.get(key) ?? { minute: [], day: [] };
  w.minute = w.minute.filter((t) => now - t < 60_000);
  w.day = w.day.filter((t) => now - t < 86_400_000);

  if (w.minute.length >= opts.perMin) {
    throw new RateLimitExceededError(
      `분당 한도 초과 (${opts.perMin}회). 1분 후 다시 시도해주세요.`,
    );
  }
  if (w.day.length >= opts.perDay) {
    throw new RateLimitExceededError(
      `일일 한도 초과 (${opts.perDay}회). 내일 다시 시도해주세요.`,
    );
  }

  w.minute.push(now);
  w.day.push(now);
  windows.set(key, w);
}
