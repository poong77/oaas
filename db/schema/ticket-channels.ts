/**
 * `ticket_channels` — 티켓 유입 채널 마스터 (post-MVP).
 *
 * 어드민이 채널 추가/수정/숨김 가능. tickets.channel은 이 테이블의 code 문자열을
 * 참조하지만 FK는 걸지 않는다 (마스터 비활성화돼도 과거 티켓 라벨 보존).
 *
 * 시드(db/seed.ts): web, phone, chatbot, kakao, email, walk_in
 * 시스템 채널('web', 'chatbot')은 비활성화 불가 (lib/services/master-ticket-channels.ts §9.1).
 */

import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';

export const ticketChannels = pgTable(
  'ticket_channels',
  {
    ...commonColumns(),
    /** 'web' | 'phone' | 'chatbot' | 'kakao' | 'email' | 'walk_in' ... (snake_case) */
    code: text('code').notNull(),
    /** 사용자 표시 라벨 ('웹', '전화', '챗봇', '카카오톡', '이메일', '방문') */
    label: text('label').notNull(),
    description: text('description'),
    /** lib/ticket-channel-label.ts CHANNEL_ICON_MAP의 키 ('Globe' | 'Phone' | 'Bot' ...) */
    icon: text('icon'),
    /** 매니저 대리 접수 폼 드롭다운 노출 여부 (web/chatbot은 false) */
    selectableInAgentForm: boolean('selectable_in_agent_form')
      .notNull()
      .default(true),
    /** 매니저 대리 접수 폼 기본 선택값 (정책상 true는 1개. UI 가드, DB 제약 X) */
    isAgentDefault: boolean('is_agent_default').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    uniqueIndex('ticket_channels_code_uniq').on(table.code),
    index('ticket_channels_sort_idx').on(table.sortOrder),
  ],
);

export type TicketChannelRow = typeof ticketChannels.$inferSelect;
export type NewTicketChannel = typeof ticketChannels.$inferInsert;

/**
 * 시스템 채널 — 비활성화/code 변경 금지.
 * 'web' = 호텔리어 셀프 접수 자동 태깅
 * 'chatbot' = 챗봇 fallback 접수 자동 태깅
 */
export const SYSTEM_TICKET_CHANNEL_CODES = ['web', 'chatbot'] as const;
export type SystemTicketChannelCode =
  (typeof SYSTEM_TICKET_CHANNEL_CODES)[number];
