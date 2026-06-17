/**
 * `ai_usage_logs` — AI(LLM/임베딩) 호출 사용량·비용 이력 (append-only).
 *
 * 모든 유료 AI 호출(Anthropic·OpenAI·임베딩)의 토큰 사용량과 계산된 비용(USD)을
 * fire-and-forget으로 적재한다. '유료 사용현황' 어드민 대시보드의 단일 소스.
 *
 * - is_active 없음 (append-only, activity_logs 패턴).
 * - 적재 실패가 메인 AI 로직을 막으면 안 된다 (lib/ai/cost-tracker.ts에서 try/catch).
 * - cost_usd는 적재 시점 단가(lib/ai/pricing.ts)로 미리 계산해 보존(소급 단가변동 무관).
 *
 * 인덱스:
 *   - (created_at desc) — 기간 집계
 *   - (provider, created_at) — 프로바이더별 집계
 *
 * @see lib/ai/cost-tracker.ts (적재) · lib/services/paid-usage.ts (집계)
 */

import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const aiUsageLogs = pgTable(
  'ai_usage_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** 'anthropic' | 'openai' (텍스트 — 신규 프로바이더 유연 수용). */
    provider: text('provider').notNull(),
    /** 실제 API 모델 ID (예: 'claude-haiku-4-5', 'gpt-4.1-mini', 'text-embedding-3-small'). */
    model: text('model').notNull(),
    /** 호출 분류 (예: 'ai-assist', 'search-eval', 'embeddings'). 용도별 집계용. */
    bucket: text('bucket'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
    /** 적재 시점 단가로 계산한 비용(USD). numeric(14,8)로 미세 비용까지 보존. */
    costUsd: numeric('cost_usd', { precision: 14, scale: 8 })
      .notNull()
      .default('0'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('ai_usage_logs_created_idx').on(table.createdAt),
    index('ai_usage_logs_provider_created_idx').on(
      table.provider,
      table.createdAt,
    ),
  ],
);

export type AiUsageLog = typeof aiUsageLogs.$inferSelect;
export type NewAiUsageLog = typeof aiUsageLogs.$inferInsert;
