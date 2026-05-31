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

const MODEL = 'claude-sonnet-4-6';

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY missing — .env.local 또는 Vercel 환경변수 확인');
  }
  return new Anthropic({ apiKey });
}

/**
 * 아티클 보조 메타데이터 추출 호출.
 *
 * @returns JSON.parse된 결과 (스키마 검증은 호출처에서 zod safeParse).
 * @throws Anthropic SDK 에러 (network, auth, rate limit 등)
 */
export async function callClaudeAssistant(input: AiAssistInput): Promise<unknown> {
  const client = getClient();
  const message = await client.messages.create({
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
  return JSON.parse(block.text);
}
