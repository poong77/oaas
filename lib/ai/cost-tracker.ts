/**
 * AI 호출 비용 추적 — 비용 계산 + DB 적재(append-only) + dev console 로깅.
 *
 * 단가는 lib/ai/pricing.ts(모델별)에서 조회한다.
 * 사용량은 ai_usage_logs에 fire-and-forget으로 적재되며, 적재 실패가 메인 AI
 * 로직을 막지 않는다(try/catch + void).
 *
 * @see lib/ai/pricing.ts · db/schema/ai-usage-logs.ts · lib/services/paid-usage.ts
 */

import 'server-only';

import { computeAiCostUsd } from './pricing';

export type CostUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  /** 호출 식별 (예: 'ai-assist', 'ai-rewrite-tone'). 누적 분류용. */
  bucket?: string;
  /** 'anthropic' | 'openai'. 미지정 시 'unknown'으로 적재. */
  provider?: string;
  /** 실제 API 모델 ID. 단가 조회 키. 미지정 시 폴백 단가 적용. */
  model?: string;
};

/**
 * 비용 계산 + 사용량 적재. 비용(USD)을 반환한다.
 * model 미지정 시 폴백 단가(Sonnet 수준)로 계산한다.
 */
export function trackCost(usage: CostUsage): { costUsd: number } {
  const model = usage.model ?? '';
  const cost = computeAiCostUsd(model, usage);

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[AI cost${usage.bucket ? ` ${usage.bucket}` : ''}] $${cost.toFixed(5)} ` +
        `(${usage.provider ?? '?'}/${model || '?'} · in=${usage.inputTokens}, ` +
        `out=${usage.outputTokens}, cache=${usage.cacheReadTokens})`,
    );
  }

  // fire-and-forget 적재 — 실패해도 메인 로직 영향 없음.
  void persistUsage(usage, cost);

  return { costUsd: cost };
}

async function persistUsage(usage: CostUsage, costUsd: number): Promise<void> {
  try {
    // 동적 import: AI 호출 경로에 db 의존성을 정적으로 끌어들이지 않는다.
    const { db } = await import('@/db');
    if (!db) return;
    const { aiUsageLogs } = await import('@/db/schema/ai-usage-logs');
    await db.insert(aiUsageLogs).values({
      provider: usage.provider ?? 'unknown',
      model: usage.model ?? 'unknown',
      bucket: usage.bucket ?? null,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      costUsd: costUsd.toFixed(8),
    });
  } catch (err) {
    console.warn(
      '[cost-tracker] ai_usage_logs 적재 실패(무시):',
      err instanceof Error ? err.message : err,
    );
  }
}
