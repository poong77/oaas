/**
 * AI·문자 단가표 + 비용 계산 (server/client 공용 상수).
 *
 * AI 단가는 1M 토큰당 USD. 모델별로 명시하고, 미등록 모델은 DEFAULT 폴백.
 * 캐시 read는 입력 단가의 10%로 가정(Anthropic prompt caching 일반값).
 * 문자 단가는 솔라피 기준 건당 KRW (운영 단가에 맞게 조정 가능).
 *
 * 단가/환율 변경 시 이 파일만 수정하면 신규 적재분부터 반영된다.
 * (과거 ai_usage_logs.cost_usd는 적재 시점 단가로 동결되어 보존)
 *
 * @see db/schema/ai-usage-logs.ts · lib/services/paid-usage.ts
 */

/** USD → KRW 환산 가정 환율 (대시보드 표기용). */
export const USD_TO_KRW = 1400;

type ModelPrice = {
  /** 입력 1M 토큰당 USD */
  input: number;
  /** 출력 1M 토큰당 USD */
  output: number;
};

/**
 * 모델별 1M 토큰 단가(USD). 키는 ai_models.code(실제 API 모델 ID)와 일치.
 * 미등록 모델은 prefix 매칭 → DEFAULT 순으로 폴백.
 */
export const MODEL_PRICING: Record<string, ModelPrice> = {
  // Anthropic
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-opus-4-8': { input: 15, output: 75 },
  // OpenAI (chat)
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  // OpenAI (embedding)
  'text-embedding-3-small': { input: 0.02, output: 0 },
  'text-embedding-3-large': { input: 0.13, output: 0 },
};

/** 미등록 모델 폴백 단가 (Sonnet 수준 보수적 추정). */
export const DEFAULT_PRICING: ModelPrice = { input: 3, output: 15 };

/** 모델 코드 → 단가. 정확 일치 → prefix 매칭 → DEFAULT. */
export function priceForModel(model: string): ModelPrice {
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  const hit = Object.keys(MODEL_PRICING).find((k) => model.startsWith(k));
  return hit ? MODEL_PRICING[hit] : DEFAULT_PRICING;
}

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
};

/** 토큰 사용량 → 비용(USD). 캐시 read는 입력 단가의 10%. */
export function computeAiCostUsd(model: string, usage: TokenUsage): number {
  const p = priceForModel(model);
  const input = (usage.inputTokens / 1_000_000) * p.input;
  const output = (usage.outputTokens / 1_000_000) * p.output;
  const cache = ((usage.cacheReadTokens ?? 0) / 1_000_000) * p.input * 0.1;
  return input + output + cache;
}

// ─────────────────────────────────────────────────────────────────────
// 문자(솔라피) 단가 — 건당 KRW
// 문자 유형 판정(classifySms)·바이트 계산은 lib/messaging/format.ts 재사용.
// ─────────────────────────────────────────────────────────────────────

import type { SmsKind } from '@/lib/messaging/format';

/** 건당 KRW. 운영 계약 단가에 맞게 조정. (kind는 소문자 — format.ts와 일치) */
export const SMS_PRICING_KRW: Record<SmsKind, number> = {
  sms: 20,
  lms: 50,
  mms: 200,
};
