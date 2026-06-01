/**
 * article-rewriter의 client-safe 부분 (타입 + enum + 라벨 + zod 스키마).
 *
 * Pages/Client Router에서 SDK·server-only 모듈 chain을 끌어들이지 않도록
 * 시스템 프롬프트·SDK 호출이 포함된 `article-rewriter.ts`와 분리.
 *
 * client 컴포넌트(예: rewrite-panel.tsx, article-editor.tsx)는 반드시 이 파일에서 import.
 * server 모듈은 `article-rewriter.ts`에서 re-export됩니다.
 *
 * @see lib/ai/prompts/article-rewriter.ts (server-only)
 */

import { z } from 'zod';
import type { ArticleContentType } from '@/db/schema';

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
// zod 스키마 (server action 검증 + client 옵셔널)
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
