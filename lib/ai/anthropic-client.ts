/**
 * Claude API client (Anthropic SDK wrapper) — A5 + A6.
 *
 * 호출 패턴:
 *   - `runClaudeJson({ system, user, model?, ... })` — 내부 공용 호출 (JSON 응답)
 *   - `callClaudeAssistant(input)` — A5 5종 메타 추출 (Sonnet)
 *   - `callClaudeRewriter(input, mode)` — A6 재편집 4모드 (tone만 Haiku, 나머지 Sonnet)
 *
 * Prompt caching:
 *   - system이 ≥ 4000자일 때 cache_control 'ephemeral' 효과 발생 (5분 TTL)
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §5-3, §16-0
 */

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

import {
  SYSTEM_PROMPT,
  buildUserMessage,
  type AiAssistInput,
} from './prompts/article-assistant';
import { trackCost } from './cost-tracker';

/**
 * 모델 ID 폴백.
 * Sonnet: 환경변수 ANTHROPIC_MODEL > 'claude-sonnet-4-5'
 * Haiku:  환경변수 ANTHROPIC_MODEL_HAIKU > 'claude-haiku-4-5'
 */
export const DEFAULT_SONNET =
  process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';
export const DEFAULT_HAIKU =
  process.env.ANTHROPIC_MODEL_HAIKU ?? 'claude-haiku-4-5';

function getClient(): Anthropic {
  // Vercel 환경별 분리:
  //   - Development(`vercel dev` 또는 Vercel 환경=Development): ANTHROPIC_API_KEY_DEV 우선
  //   - Production / Preview / 로컬 npm run dev (.env.local): ANTHROPIC_API_KEY
  //   - 폴백 순서: _DEV → 일반
  const apiKey =
    process.env.ANTHROPIC_API_KEY_DEV ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY missing — .env.local 또는 Vercel 환경변수(ANTHROPIC_API_KEY / ANTHROPIC_API_KEY_DEV) 확인',
    );
  }
  return new Anthropic({ apiKey });
}

// ─────────────────────────────────────────────────────────────────────────────
// 공용 호출 (JSON 응답)
// ─────────────────────────────────────────────────────────────────────────────

export type RunClaudeOptions = {
  /** system 프롬프트 (cache_control 자동 적용). */
  system: string;
  /** user 메시지. */
  user: string;
  /** 모델 ID. 미지정 시 DEFAULT_SONNET. */
  model?: string;
  /** 최대 출력 토큰. 기본 1500. */
  maxTokens?: number;
  /** cost-tracker에 기록될 bucket 라벨 (예: 'ai-assist', 'ai-rewrite-tone'). */
  bucket: string;
};

/**
 * Claude 단일 호출 → JSON.parse 결과 반환.
 *
 * - cache_control 'ephemeral' system 자동 적용
 * - 호출 실패 시 model ID를 에러 메시지에 포함
 * - JSON.parse 실패 시 응답 앞 200자 console.error
 *
 * @throws Anthropic SDK 에러 (network/auth/rate-limit) 또는 JSON 파싱 에러.
 */
export async function runClaudeJson(opts: RunClaudeOptions): Promise<unknown> {
  const model = opts.model ?? DEFAULT_SONNET;
  const client = getClient();

  let message;
  try {
    message = await client.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 1500,
      system: [
        {
          type: 'text',
          text: opts.system,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: opts.user }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[anthropic-client] 호출 실패 model="${model}" bucket="${opts.bucket}":`, err);
    throw new Error(`Anthropic API 호출 실패 (model=${model}): ${msg}`);
  }

  trackCost({
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    bucket: opts.bucket,
  });

  const block = message.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    throw new Error('AI 응답에 text block이 없습니다.');
  }

  try {
    return JSON.parse(block.text);
  } catch (err) {
    console.error(
      `[anthropic-client] JSON.parse 실패 model="${model}" bucket="${opts.bucket}". 응답 앞 200자:`,
      block.text.slice(0, 200),
    );
    throw new Error(`AI 응답 JSON 파싱 실패: ${(err as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// A5 — 메타 추출
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A5 — 아티클 메타데이터 5종 추출 (Sonnet).
 *
 * 시그니처는 v1.4와 동일 (외부 호출처 100% 호환). 내부 구현만 runClaudeJson으로 위임.
 *
 * @returns JSON.parse 결과 (zod safeParse는 호출처에서).
 */
export async function callClaudeAssistant(input: AiAssistInput): Promise<unknown> {
  return runClaudeJson({
    system: SYSTEM_PROMPT,
    user: buildUserMessage(input),
    bucket: 'ai-assist',
    // model 미지정 → DEFAULT_SONNET
  });
}
