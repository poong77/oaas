/**
 * 티켓 채널 시스템 코드 + 검사 함수 — 클라이언트/서버 공통.
 *
 * `lib/services/master-ticket-channels.ts`는 `server-only` 선언이 있어
 * 클라이언트 컴포넌트(`channel-form.tsx`)가 해당 모듈을 직접 import하면
 * 빌드 에러가 발생한다. 시스템 코드 상수와 순수 검사 함수만 본 파일에
 * 분리하여 양쪽에서 안전하게 사용한다.
 *
 * @see docs/02-design/features/ticket-channels-master.design.md §9.1
 */

/** 시스템 채널 코드 (어드민이 비활성/삭제/code 변경 불가). */
export const SYSTEM_TICKET_CHANNEL_CODES = ['web', 'chatbot'] as const;

export type SystemTicketChannelCode =
  (typeof SYSTEM_TICKET_CHANNEL_CODES)[number];

/** 시스템 채널 보호 검사. server/client 양쪽에서 안전. */
export function isSystemChannelCode(code: string): boolean {
  return (SYSTEM_TICKET_CHANNEL_CODES as readonly string[]).includes(code);
}
