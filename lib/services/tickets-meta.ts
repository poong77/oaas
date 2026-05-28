/**
 * Client-safe constants for tickets domain.
 *
 * Server-only DB logic은 lib/services/tickets.ts에 있고
 * 거기서 외부 SDK (solapi/slack/blob)를 transitive하게 끌어오므로
 * Client Component는 이 파일만 import해야 한다.
 */

import type { TicketStatus } from '@/db/schema';

export const STATUS_LABEL: Record<TicketStatus, string> = {
  received: '접수',
  in_progress: '처리중',
  on_hold: '보류',
  completed: '완료',
};
