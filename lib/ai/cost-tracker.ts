/**
 * AI 호출 비용 추적 (개발 환경 console 로깅).
 *
 * Claude Sonnet 4.6 가격 (2026-05 기준 가정):
 *   - Input  $3.0 / 1M tokens
 *   - Output $15.0 / 1M tokens
 *   - Cache read $0.3 / 1M tokens (prompt caching 시)
 *
 * v2에서 누적 메트릭(DB 또는 Vercel Analytics)으로 확장.
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §13-2
 */

import 'server-only';

const PRICING = {
  input: 3.0 / 1_000_000,
  output: 15.0 / 1_000_000,
  cacheRead: 0.3 / 1_000_000,
};

export type CostUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  /** 호출 식별 (예: 'ai-assist', 'ai-rewrite-tone'). 누적 분류용. */
  bucket?: string;
};

export function trackCost(usage: CostUsage): { costUsd: number } {
  const cost =
    usage.inputTokens * PRICING.input +
    usage.outputTokens * PRICING.output +
    usage.cacheReadTokens * PRICING.cacheRead;

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[AI cost${usage.bucket ? ` ${usage.bucket}` : ''}] $${cost.toFixed(5)} ` +
        `(in=${usage.inputTokens}, out=${usage.outputTokens}, cache=${usage.cacheReadTokens})`,
    );
  }

  return { costUsd: cost };
}
