/**
 * Claude article-rewriter 프롬프트 (A6 — 4모드 재편집).
 *
 * 모드:
 *   - reorder    — content_type(의도) 변경 시 기존 본문을 새 골격으로 재정렬
 *   - fill-gaps  — 비어있는 H2 섹션(>로 시작하는 placeholder만)을 본문 컨텍스트로 보완
 *   - tone       — CS 톤 보정 (마케팅톤 제거, 청유형, 자기참조 제거) ← Haiku 사용
 *   - custom     — 사용자 자유 명령 ("더 짧게", "초보 호텔리어 눈높이" 등)
 *
 * 출력:
 *   { revisedBody: string, summaryOfChanges: string[], changedSections: { heading, changeType }[] }
 *
 * 원칙:
 *   - 본문 의미 변경 금지 (표현·구조만)
 *   - H2 라벨(REQUIRED_H2_BY_TYPE 정합)은 모드에 따라 유지 또는 새 골격으로 재정렬
 *   - placeholder(`> ...`)는 빈 섹션 표시. AI가 새로 채울 때는 일반 텍스트로.
 *   - 추측한 사실 추가 금지. 본문에 없는 정보 채우면 안 됨.
 *
 * 모델 분기 (v1.4):
 *   - tone → Haiku (단순 표현 변환, 60% 비용 절감)
 *   - 나머지 → Sonnet (구조 보존 필요)
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §16
 */

import 'server-only';
import { z } from 'zod';
import type { ArticleContentType } from '@/db/schema';
import { DEFAULT_SONNET, DEFAULT_HAIKU } from '@/lib/ai/anthropic-client';
import { REQUIRED_H2_BY_TYPE } from '@/lib/articles/body-validator';

// ─────────────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────────────

export type RewriteMode = 'reorder' | 'fill-gaps' | 'tone' | 'custom';

export const REWRITE_MODES: RewriteMode[] = [
  'reorder',
  'fill-gaps',
  'tone',
  'custom',
];

export const REWRITE_MODE_LABEL: Record<RewriteMode, string> = {
  reorder: '골격 재정렬 (의도 변경)',
  'fill-gaps': '빈 섹션 채우기',
  tone: 'CS 톤 보정',
  custom: '자유 명령',
};

export const REWRITE_MODE_DESCRIPTION: Record<RewriteMode, string> = {
  reorder:
    '기존 본문을 새 의도(content_type)의 골격에 맞춰 재정렬. 정보는 최대한 보존하되 자리 X 정보는 가장 가까운 섹션으로.',
  'fill-gaps':
    '비어있는 H2 섹션(`>` placeholder만 있는 곳)을 본문 다른 섹션의 정보로 보완. 추측 금지.',
  tone:
    '마케팅 톤(엄청난·놀라운·손쉽게) 제거 → 객관·간결. 명령형 → 청유형. 자기참조("위에서 말한") 제거.',
  custom: '사용자 자유 명령. 예: "더 짧게", "단계 자세히", "초보 호텔리어 눈높이".',
};

export type RewriteInput = {
  mode: RewriteMode;
  /** 현재 본문 (5000자 cap 적용 — truncateBody 사용). */
  body: string;
  /** 현재 의도. reorder의 경우 fromType. */
  contentType: ArticleContentType;
  /** 부가 컨텍스트 (선택). */
  title?: string;
  summary?: string;
  productCode?: string;
  /** reorder 전용 — 변경 대상 의도. */
  toType?: ArticleContentType;
  /** custom 전용 — 사용자 명령. */
  command?: string;
};

export type ChangeType = 'added' | 'removed' | 'reordered' | 'modified' | 'unchanged';

export type ChangedSection = {
  heading: string;
  changeType: ChangeType;
};

export type RewriteOutput = {
  revisedBody: string;
  summaryOfChanges: string[];
  changedSections: ChangedSection[];
};

// ─────────────────────────────────────────────────────────────────────────────
// zod 스키마
// ─────────────────────────────────────────────────────────────────────────────

const CHANGE_TYPE_VALUES = [
  'added',
  'removed',
  'reordered',
  'modified',
  'unchanged',
] as const;

export const RewriteOutputSchema = z.object({
  revisedBody: z.string().min(20).max(20000),
  summaryOfChanges: z.array(z.string().min(1)).max(10).default([]),
  changedSections: z
    .array(
      z.object({
        heading: z.string().min(1),
        changeType: z.enum(CHANGE_TYPE_VALUES),
      }),
    )
    .max(20)
    .default([]),
});

// ─────────────────────────────────────────────────────────────────────────────
// 모드별 system 프롬프트
// ─────────────────────────────────────────────────────────────────────────────

const COMMON_HEADER = `당신은 호텔 OA 솔루션(PMS/CMS/Keyless/키오스크/웹) 도움말 본문 재편집 보조입니다.

공통 원칙:
- 본문의 사실 의미는 변경 금지 (표현·구조만 다듬음)
- 본문에 명시적으로 없는 사실 추측·추가 금지
- 호텔 현장 어휘 보존 — 약어(CI, CO, OTA, PMS 등) 그대로 유지
- "1아티클=1의도" 원칙 위반 시 시도 거부 (summaryOfChanges에 사유 기록)
- H2 라벨(##)은 모드별 정책에 따라 유지/재정렬
- placeholder(>로 시작하는 안내문)는 빈 섹션 표시. 채울 때는 일반 텍스트로 변환.

출력 형식 (JSON만, 마크다운/주석/설명 금지):
{
  "revisedBody": string (재편집된 markdown 본문),
  "summaryOfChanges": string[] (≤5건, 한국어, 사람이 읽는 변경 요약),
  "changedSections": [{ "heading": string, "changeType": "added"|"removed"|"reordered"|"modified"|"unchanged" }]
}

content_type별 본문 골격:
- howto: 목표 → 사전 준비 → 단계 → 다음 단계
- feature: 개요 → 위치(메뉴 경로) → 항목 설명 → 관련 문서
- troubleshoot: 증상 → 원인 → 해결 단계 → 그래도 안 되면
`;

const SYSTEM_REORDER = `${COMMON_HEADER}
=== 모드: reorder (의도 변경) ===
사용자가 fromType으로 작성한 본문을 toType 골격으로 재정렬합니다.

규칙:
1. 기존 본문의 정보를 최대한 보존하면서 새 골격(toType)에 재배치
2. 새 골격의 모든 H2 섹션(4개)을 ## 헤더로 표시
3. 기존 본문에 있던 정보 중 새 골격의 어떤 섹션에도 안 맞는 부분은 가장 의미상 가까운 섹션에 통합
4. 새 골격에 빈 자리가 생기면 placeholder("> ...") 안내 줄로 채우기 (AI가 추측 작성 금지)
5. changedSections에 각 새 헤더별로 added(신규 생성)/reordered(기존 위치 이동)/modified(내용 변경)/unchanged 명시`;

const SYSTEM_FILL_GAPS = `${COMMON_HEADER}
=== 모드: fill-gaps (빈 H2 섹션 채우기) ===
H2 섹션 중 비어있거나 placeholder("> ...")만 있는 곳을 본문의 다른 섹션 정보로 보완합니다.

규칙:
1. 이미 실질 내용(20자+)이 있는 섹션은 절대 수정 금지 → changedSections에 unchanged
2. 빈 섹션만 채움. 본문 다른 섹션의 사실에서만 추론
3. 추측이 필요하면 추측하지 말고 placeholder 유지 + summaryOfChanges에 "X 섹션은 정보 부족으로 보완 불가" 명시
4. H2 라벨(##) 추가/변경/순서 변경 금지 — 빈 섹션 내용만 채움`;

const SYSTEM_TONE = `${COMMON_HEADER}
=== 모드: tone (CS 톤 보정) ===
본문을 CS 톤으로 다듬습니다. **사실/구조 변경 금지, 표현만 수정.**

규칙:
1. 마케팅 톤 제거: 엄청난·놀라운·손쉽게·간편하게 등 형용사 과잉 → 객관·간결 표현
2. 명령형 → 청유형: "~하세요" → "~해주세요" (단, 안전 경고는 명령형 유지)
3. 자기참조 제거: "위에서 말한", "앞서 설명한" 등 → 명시 참조 ("**3단계**에서")
4. 다중의도 표현 분리: "및", "그리고" 등 → 단일 의도로 분리 또는 항목화
5. 호텔리어 약어(CI/CO/OTA) 보존. 첫 등장 시 풀어쓰기 병기 가능 ("체크인(CI)")
6. H2 라벨/구조 변경 금지. 모든 changedSections는 unchanged 또는 modified.
7. 변경된 표현은 summaryOfChanges에 before → after 한 줄씩`;

const SYSTEM_CUSTOM_PREFIX = `${COMMON_HEADER}
=== 모드: custom (사용자 명령) ===
사용자가 직접 지시한 변경을 적용합니다.

규칙:
1. 명령이 모호하면 보수적으로 최소 변경
2. H2 구조 유지가 기본 — 명령이 "재구성" 등 명시할 때만 구조 변경
3. "1아티클=1의도" 원칙 위반 시도 시 거부 → summaryOfChanges에 거부 사유 + revisedBody는 입력 그대로
4. 명령이 사실 추가를 요구하면 거부 (본문에 없으면 새로 만들지 않음)

사용자 명령:
`;

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * mode에 따른 system 프롬프트 빌드.
 *
 * - custom일 때만 command를 system에 직접 박음 (user 메시지로 새는 것 방지).
 */
export function buildRewriterSystem(input: RewriteInput): string {
  switch (input.mode) {
    case 'reorder':
      return SYSTEM_REORDER;
    case 'fill-gaps':
      return SYSTEM_FILL_GAPS;
    case 'tone':
      return SYSTEM_TONE;
    case 'custom':
      return `${SYSTEM_CUSTOM_PREFIX}${(input.command ?? '').slice(0, 500)}`;
  }
}

/**
 * 입력 컨텍스트 직렬화.
 */
export function buildRewriterUserMessage(input: RewriteInput): string {
  const fromRequired = REQUIRED_H2_BY_TYPE[input.contentType].join(' / ');
  const lines = [
    `[mode] ${input.mode}`,
    `[contentType] ${input.contentType} (required H2: ${fromRequired})`,
  ];
  if (input.mode === 'reorder' && input.toType) {
    const toRequired = REQUIRED_H2_BY_TYPE[input.toType].join(' / ');
    lines.push(`[toType] ${input.toType} (required H2: ${toRequired})`);
  }
  if (input.productCode) lines.push(`[productCode] ${input.productCode}`);
  if (input.title) lines.push(`[title] ${input.title}`);
  if (input.summary) lines.push(`[summary] ${input.summary}`);
  lines.push('', `[body]`, input.body);
  return lines.join('\n');
}

/**
 * 모드별 모델 선택 (v1.4 분기).
 *
 * - tone → Haiku (60% 비용 절감)
 * - 나머지 → Sonnet (구조 보존 정확도)
 */
export function modelForMode(mode: RewriteMode): string {
  return mode === 'tone' ? DEFAULT_HAIKU : DEFAULT_SONNET;
}

/**
 * 모드별 rate-limit bucket 분리 (telemetry + 호출 격리).
 *
 * 통합 bucket이 아닌 모드별로 두면, 매니저가 tone 보정만 반복해도
 * reorder 등 다른 모드는 별도 한도 유지.
 */
export function bucketForMode(mode: RewriteMode): string {
  return `ai-rewrite-${mode}`;
}

/**
 * 입력 본문 cap (5000자) + 메타 반환.
 *
 * @see article-assistant.ts truncateBody (동일 패턴, 재사용 가능하나 의미상 분리)
 */
export function truncateRewriteBody(
  body: string,
  cap = 5000,
): { text: string; truncated: boolean; original: number } {
  if (body.length <= cap) {
    return { text: body, truncated: false, original: body.length };
  }
  return { text: body.slice(0, cap), truncated: true, original: body.length };
}
