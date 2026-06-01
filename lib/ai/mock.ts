/**
 * AI mock — e2e 테스트용 결정적 응답 (D5).
 *
 * 활성 조건:
 *   - `process.env.E2E_MOCK_AI === '1'` 일 때만 활성
 *   - production 환경에서는 절대 활성 안 됨 (E2E_MOCK_AI는 dev/local에만)
 *
 * 목적:
 *   - KB-04 (AI 보조 적용) / KB-09b (재편집 적용) 시나리오 회귀 검증
 *   - 실제 Anthropic API 호출 없이 결정적 응답 → 빠르고 비용 0
 *   - server action 흐름(권한·rate-limit·zod 등) 전체 검증
 *
 * 보안:
 *   - mock은 server-only 모듈에서만 import
 *   - 실제 사용자 환경에서는 절대 활성 안 됨 (env 명시적 set 필요)
 *
 * @see docs/02-design/knowledge-base-overhaul/REPORT-v1.6.md D5
 */

import 'server-only';
import type { AiAssistOutput } from './prompts/article-assistant';
import type { RewriteInput, RewriteOutput } from './prompts/article-rewriter';

export const MOCK_ENABLED = process.env.E2E_MOCK_AI === '1';

// ─────────────────────────────────────────────────────────────────────────────
// A5 — Assist mock
// ─────────────────────────────────────────────────────────────────────────────

export type MockAssistInput = {
  title: string;
  body: string;
  contentType: 'howto' | 'feature' | 'troubleshoot';
  productCode: string;
  categoryPath: string[];
  existingKeywords: string[];
};

/**
 * 결정적인 mock 응답 — 입력 title/contentType에 따라 다른 결과를 만들어 다양성 확보.
 */
export function mockAssistOutput(input: MockAssistInput): AiAssistOutput {
  const safeProduct = (input.productCode || 'pms')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  const slug = `${safeProduct}-${input.contentType}-${slugFromTitle(input.title) || '001'}`;
  const summary =
    input.title.trim().length > 0
      ? `[MOCK] ${input.title.trim()}을(를) 호텔리어가 5분 안에 처리할 수 있도록 정리한 가이드입니다.`
      : '[MOCK] 본문을 30초 안에 이해할 수 있는 핵심 요약입니다.';

  const baseKeywords =
    input.contentType === 'howto'
      ? ['체크인', '체크아웃', '예약 등록']
      : input.contentType === 'feature'
        ? ['예약 화면', '항목 설명', '필드']
        : ['결제 오류', '카드 거절', '해결'];

  return {
    slug,
    summary,
    keywords: dedup([...baseKeywords, '프런트', '안내', '호텔리어']),
    related_search_hints: ['관련 가이드', '연관 자료', '체크리스트'],
    chatbot_meta: {
      intent: `[MOCK] ${input.contentType} — ${input.title || '도움말'}`,
      entities: ['예약', '호텔리어'],
      steps:
        input.contentType === 'feature'
          ? null
          : ['예약 조회', '정보 확인', '처리 완료'],
      expected_time_minutes: 5,
      prerequisites: ['로그인', '권한 확인'],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// A6 — Rewrite mock
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 결정적인 rewrite mock — mode별로 다른 결과.
 *
 * - tone: 본문 안 '~하세요' → '~해주세요' 1회 치환 + 변경 요약
 * - fill-gaps: 빈 H2 섹션 1개 다음 줄에 mock 텍스트 1줄 추가
 * - reorder: toType 골격 4개 H2를 새 본문으로 생성 + 기존 body는 첫 섹션에 통합
 * - custom: 본문 + "[MOCK custom: {command}]" 한 줄 추가
 */
export function mockRewriteOutput(input: RewriteInput): RewriteOutput {
  switch (input.mode) {
    case 'tone': {
      const revised = input.body.replace(/하세요/, '해주세요');
      const changed = revised !== input.body;
      return {
        revisedBody: revised,
        summaryOfChanges: changed
          ? ['[MOCK] "하세요" → "해주세요" 1곳 치환']
          : ['[MOCK] 보정할 표현이 없습니다.'],
        changedSections: [{ heading: '## 전체', changeType: changed ? 'modified' : 'unchanged' }],
      };
    }
    case 'fill-gaps': {
      const lines = input.body.split('\n');
      const out: string[] = [];
      let filled = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        out.push(line);
        if (
          !filled &&
          /^##\s+/.test(line) &&
          (i + 1 >= lines.length ||
            lines[i + 1]?.trim().startsWith('>') ||
            lines[i + 1]?.trim() === '')
        ) {
          out.push('[MOCK] 빈 섹션을 본문 컨텍스트로 보완했습니다.');
          filled = true;
        }
      }
      return {
        revisedBody: out.join('\n'),
        summaryOfChanges: filled
          ? ['[MOCK] 빈 섹션 1곳 보완']
          : ['[MOCK] 보완할 빈 섹션이 없습니다.'],
        changedSections: filled
          ? [{ heading: '## 첫 빈 섹션', changeType: 'modified' }]
          : [],
      };
    }
    case 'reorder': {
      const toRequired = {
        howto: ['## 목표', '## 사전 준비', '## 단계', '## 다음 단계'],
        feature: ['## 개요', '## 위치(메뉴 경로)', '## 항목 설명', '## 관련 문서'],
        troubleshoot: ['## 증상', '## 원인', '## 해결 단계', '## 그래도 안 되면'],
      } as const;
      const target = input.toType ?? 'howto';
      const headings = toRequired[target];
      const revised = headings
        .map((h, i) => (i === 0 ? `${h}\n${input.body.slice(0, 200)}` : `${h}\n> ...`))
        .join('\n\n');
      return {
        revisedBody: revised,
        summaryOfChanges: [
          `[MOCK] ${input.contentType} → ${target} 골격으로 재정렬, 첫 섹션에 기존 본문 통합`,
        ],
        changedSections: headings.map((h, i) => {
          const changeType: 'modified' | 'added' = i === 0 ? 'modified' : 'added';
          return { heading: h, changeType };
        }),
      };
    }
    case 'custom': {
      return {
        revisedBody: `${input.body}\n\n[MOCK custom: ${input.command ?? ''}]`,
        summaryOfChanges: [
          `[MOCK] custom 명령 적용: ${(input.command ?? '').slice(0, 100)}`,
        ],
        changedSections: [{ heading: '## 본문 끝', changeType: 'added' }],
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────────────────────────

function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[가-힣]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function dedup<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
