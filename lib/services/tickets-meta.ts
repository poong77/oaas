/**
 * Client-safe constants for tickets domain.
 *
 * Server-only DB logic은 lib/services/tickets.ts에 있고
 * 거기서 외부 SDK (solapi/slack/blob)를 transitive하게 끌어오므로
 * Client Component는 이 파일만 import해야 한다.
 *
 * Phase 6 추가:
 *   - KANBAN_COLUMN_ORDER / KANBAN_COLUMN_TONE (IS-04 칸반뷰)
 *   - RATING_LABEL / RATING_TONE (⑦ 피드백 위젯)
 *   - URGENCY_TONE / URGENCY_LABEL (카드 배지 공용)
 */

import type { TicketStatus, TicketFeedbackRating } from '@/db/schema';

export const STATUS_LABEL: Record<TicketStatus, string> = {
  received: '접수',
  in_progress: '처리중',
  on_hold: '보류',
  completed: '완료',
};

/** 칸반 컬럼 표시 순서. */
export const KANBAN_COLUMN_ORDER: TicketStatus[] = [
  'received',
  'in_progress',
  'on_hold',
  'completed',
];

/** 컬럼 헤더 톤 (Badge tone과 동일 어휘). */
export const KANBAN_COLUMN_TONE: Record<
  TicketStatus,
  'brand' | 'warn' | 'slate' | 'success'
> = {
  received: 'brand',
  in_progress: 'warn',
  on_hold: 'slate',
  completed: 'success',
};

/** 피드백 평가 라벨. */
export const RATING_LABEL: Record<TicketFeedbackRating, string> = {
  resolved: '해결됨',
  partial: '일부 해결',
  unresolved: '미해결',
};

/** 피드백 평가 톤 (Badge tone). */
export const RATING_TONE: Record<
  TicketFeedbackRating,
  'success' | 'warn' | 'danger'
> = {
  resolved: 'success',
  partial: 'warn',
  unresolved: 'danger',
};

/** 긴급도 라벨 (categories 마스터가 없어도 fallback). */
export const URGENCY_LABEL: Record<string, string> = {
  p1: 'P1',
  p2: 'P2',
  p3: 'P3',
};

/** 긴급도 톤. */
export const URGENCY_TONE: Record<string, 'danger' | 'warn' | 'slate'> = {
  p1: 'danger',
  p2: 'warn',
  p3: 'slate',
};
