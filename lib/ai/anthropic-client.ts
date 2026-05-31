/**
 * Claude API client (Anthropic SDK wrapper) — A5.
 *
 * 모델: claude-sonnet-4-6 (System knowledge 2026-01 기준 최신 Sonnet)
 *
 * Prompt caching 적용:
 *   - SYSTEM_PROMPT가 ≥ 4000자 (cache_control 'ephemeral' 마킹)
 *   - 동일 system을 5분 이내 재호출 시 토큰 비용 절감
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §5-3
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
 * 모델 ID — 환경변수 override 가능 (Vercel ANTHROPIC_MODEL).
 * Anthropic Console에서 정확한 모델 ID 확인 후 override 권장.
 * 폴백: claude-sonnet-4-5 (안전한 alias).
 */
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';

function getClient(): Anthropic {
  // Vercel 환경별 분리:
  //   - Development(`vercel dev` 또는 Vercel 환경=Development): ANTHROPIC_API_KEY_DEV 우선
  //   - Production / Preview / 로컬 npm run dev (.env.local): ANTHROPIC_API_KEY
  //   - 폴백 순서: _DEV → 일반
  //
  // 의도: dev 환경에서 별도 키로 quota/요금 격리 (Anthropic Console에서 분리).
  const apiKey =
    process.env.ANTHROPIC_API_KEY_DEV ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY missing — .env.local 또는 Vercel 환경변수(ANTHROPIC_API_KEY / ANTHROPIC_API_KEY_DEV) 확인',
    );
  }
  return new Anthropic({ apiKey });
}

/**
 * 아티클 보조 메타데이터 추출 호출.
 *
 * @returns JSON.parse된 결과 (스키마 검증은 호출처에서 zod safeParse).
 * @throws Anthropic SDK 에러 — 에러 메시지에 모델 ID 포함하여 디버깅 용이.
 */
export async function callClaudeAssistant(input: AiAssistInput): Promise<unknown> {
  const client = getClient();
  let message;
  try {
    message = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: buildUserMessage(input) }],
    });
  } catch (err) {
    // 에러 메시지에 모델 ID와 원본 메시지 포함 (Vercel 로그에서 즉시 진단)
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[anthropic-client] 호출 실패 model="${MODEL}":`, err);
    throw new Error(`Anthropic API 호출 실패 (model=${MODEL}): ${msg}`);
  }

  trackCost({
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    bucket: 'ai-assist',
  });

  const block = message.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    throw new Error('AI 응답에 text block이 없습니다.');
  }

  // JSON.parse 실패 시 원문 일부 로깅 (디버깅용)
  try {
    return JSON.parse(block.text);
  } catch (err) {
    console.error(
      `[anthropic-client] JSON.parse 실패 model="${MODEL}". 응답 앞 200자:`,
      block.text.slice(0, 200),
    );
    throw new Error(`AI 응답 JSON 파싱 실패: ${(err as Error).message}`);
  }
}
