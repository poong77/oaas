/**
 * ai-reply-assist — 챗 프로바이더 추상화.
 *
 * ai_models.provider에 따라 SDK를 분기한다. 동일 프롬프트(system/user)를 양 프로바이더에
 * 적용하므로 A/B·모델 교체가 코드 변경 없이 가능하다.
 *   - anthropic → lib/ai/anthropic-client.runClaudeText (cost-tracker·rate-limiter·cache 내장)
 *   - openai    → lib/services/llm.runOpenAIText
 *
 * @see docs/02-design/features/ai-reply-assist.design.md §5
 */

import 'server-only';
import { runClaudeText } from './anthropic-client';
import { runOpenAIText } from '@/lib/services/llm';

export type DraftProvider = 'anthropic' | 'openai';

export type GenerateDraftInput = {
  provider: DraftProvider;
  /** ai_models.code (예: 'claude-haiku-4-5', 'gpt-4.1-mini'). */
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
};

/**
 * 단일 텍스트 초안 생성. 실패 시 throw (호출 액션에서 try/catch → 사용자 메시지).
 */
export async function generateDraft(i: GenerateDraftInput): Promise<string> {
  if (i.provider === 'anthropic') {
    return runClaudeText({
      system: i.system,
      user: i.user,
      model: i.model,
      maxTokens: i.maxTokens ?? 1200,
      bucket: 'ticket-draft',
    });
  }
  return runOpenAIText({
    system: i.system,
    user: i.user,
    model: i.model,
    maxTokens: i.maxTokens ?? 1200,
    bucket: 'ticket-draft',
  });
}
