/**
 * `ai_models` — ai-reply-assist 어드민 모델 마스터.
 *
 * AI 답변 초안 생성에 사용할 모델 목록을 어드민이 편집(목록/기본값/ON·OFF/정렬).
 * 모델을 코드에 하드코딩하지 않음 — 신모델 출시·가격 변동 시 어드민에서 토글·라벨 수정.
 *
 * 운영 패턴:
 *   - `provider`로 SDK 분기 (anthropic → lib/ai/anthropic-client, openai → lib/services/llm).
 *   - `code`는 실제 API 모델 ID (예: 'claude-haiku-4-5', 'gpt-4.1-mini').
 *   - `label`은 모달·리스트 노출 문구(건당 비용 명시), `description`은 1M 단가·특성(툴팁/상세).
 *   - `is_default=true`는 0~1개 (service에서 트랜잭션으로 강제 — 새 default 지정 시 기존 해제).
 *   - 비활성(is_active=false)은 모달 목록에서 제외(리스트 쿼리 is_active=true 조건).
 *
 * @see docs/02-design/features/ai-reply-assist.design.md §2.2 §8
 */

import { boolean, integer, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';

/** 챗 프로바이더 — SDK 라우팅 키. */
export const aiProviderEnum = pgEnum('ai_provider', ['anthropic', 'openai']);

/** 모델 등급 — UI 그룹/배지 + 운영 선택 가이드. */
export const aiTierEnum = pgEnum('ai_tier', ['economy', 'balanced', 'premium']);

export const aiModels = pgTable('ai_models', {
  ...commonColumns(),
  provider: aiProviderEnum('provider').notNull(),
  /** 실제 API 모델 ID (예: 'claude-haiku-4-5', 'gpt-4.1-mini'). */
  code: text('code').notNull(),
  /** 모달·리스트 노출 문구. 건당 비용 명시 (예: 'Claude Haiku 4.5 · 약 7원/건'). */
  label: text('label').notNull(),
  /** 1M 단가·특성. 어드민 상세/툴팁용 (예: '입$1·출$5/1M · 한국어 CS 균형'). */
  description: text('description'),
  tier: aiTierEnum('tier').notNull().default('balanced'),
  /** 기본 모델 (0~1개). 모달 초기 선택값. */
  isDefault: boolean('is_default').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

export type AiModel = typeof aiModels.$inferSelect;
export type NewAiModel = typeof aiModels.$inferInsert;
export type AiProvider = (typeof aiProviderEnum.enumValues)[number];
export type AiTier = (typeof aiTierEnum.enumValues)[number];
