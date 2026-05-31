/**
 * Claude article-assistant 프롬프트 (A5).
 *
 * 입력: title, body, contentType, productCode, categoryPath, existingKeywords
 * 출력: { slug, summary, keywords, related_search_hints, chatbot_meta }
 *
 * 원칙:
 *   - 1아티클=1의도 (chatbot_meta.intent에 단일 의도)
 *   - 호텔 현장 어휘 보존 (CI/CO/OTA 등)
 *   - CS 톤 (객관·단호·공감), 마케팅 톤 금지
 *   - 자기완결 (summary는 30초 이해 가능)
 *   - 보수성 (본문에 없는 사실 추측 금지)
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §5
 */

import 'server-only';
import { z } from 'zod';
import type { ArticleContentType } from '@/db/schema';

export const SYSTEM_PROMPT = `당신은 호텔 OA 솔루션(PMS/CMS/Keyless/키오스크/웹) 도움말 작성 보조입니다.
역할: 매니저가 작성 중인 아티클을 받아 5종 메타데이터를 제안합니다.

원칙:
1. "1아티클=1의도" — 다중 의도가 보이면 가장 우선되는 하나만 채택, chatbot_meta.intent에 그 의도만 한 문장으로.
2. 호텔 현장 어휘 보존 — 약어(CI, CO, OTA, PMS 등)는 본문 그대로 유지하되, keywords에는 한글 풀어쓴 형태와 함께 포함.
3. CS 톤 — 객관·단호·공감. 마케팅 톤(엄청난·놀라운·손쉽게 등 형용사 과잉) 금지.
4. 자기완결 — summary는 아티클을 읽지 않아도 30초 안에 의미가 통해야 함.
5. 보수성 — 본문에 명시적으로 없는 사실은 추측 금지. 추측한 항목은 빈 배열/null.

출력: 다음 JSON 스키마만 출력. 마크다운/주석/설명 금지.

{
  "slug": string (영문 소문자 + 하이픈, 60자 이내, 핵심 단어 1~3개 결합. 한글은 roman transliteration),
  "summary": string (한국어, 150~200자, 30초 이해 가능),
  "keywords": string[] (7~10개, 호텔리어 현장 어휘 + 공식 어휘 동의어 포함, 약어와 풀이 모두),
  "related_search_hints": string[] (3~5개, 관련 아티클 검색에 쓸 키워드),
  "chatbot_meta": {
    "intent": string (한 문장, "X 작업의 Y 방법" 형식),
    "entities": string[] (이 아티클이 다루는 객체: 예약, 객실, 카드결제 등),
    "steps": string[] | null (howto/troubleshoot 만, 동사구로),
    "expected_time_minutes": number,
    "prerequisites": string[]
  }
}

context: content_type별 본문 골격
- howto: 목표 → 사전 준비 → 단계 → 다음 단계
- feature: 개요 → 위치(메뉴 경로) → 항목 설명 → 관련 문서
- troubleshoot: 증상 → 원인 → 해결 단계 → 그래도 안 되면`;

// ─────────────────────────────────────────────────────────────────────────────
// 입력 타입
// ─────────────────────────────────────────────────────────────────────────────

export type AiAssistInput = {
  title: string;
  body: string;
  contentType: ArticleContentType;
  productCode: string;
  categoryPath: string[];
  existingKeywords: string[];
};

export function buildUserMessage(input: AiAssistInput): string {
  return [
    `[contentType] ${input.contentType}`,
    `[productCode] ${input.productCode}`,
    `[categoryPath] ${input.categoryPath.join(' > ') || '(미정)'}`,
    `[existingKeywords] ${input.existingKeywords.join(', ') || '(없음)'}`,
    `[title]\n${input.title}`,
    `[body]\n${input.body}`,
  ].join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// 출력 스키마 (zod)
// ─────────────────────────────────────────────────────────────────────────────

export const ChatbotMetaSchema = z.object({
  intent: z.string().min(1),
  entities: z.array(z.string()).default([]),
  steps: z.array(z.string()).nullable().optional(),
  expected_time_minutes: z.number().int().min(0).max(720),
  prerequisites: z.array(z.string()).default([]),
});

export const AiAssistOutputSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).max(60),
  summary: z.string().min(20).max(500),
  keywords: z.array(z.string().min(1)).min(3).max(15),
  related_search_hints: z.array(z.string().min(1)).max(10).default([]),
  chatbot_meta: ChatbotMetaSchema,
});

export type AiAssistOutput = z.infer<typeof AiAssistOutputSchema>;

/**
 * 입력 본문이 길면 5000자로 truncation + 알림 메타.
 */
export function truncateBody(
  body: string,
  cap: number,
): { text: string; truncated: boolean; original: number } {
  if (body.length <= cap) {
    return { text: body, truncated: false, original: body.length };
  }
  return {
    text: body.slice(0, cap),
    truncated: true,
    original: body.length,
  };
}
