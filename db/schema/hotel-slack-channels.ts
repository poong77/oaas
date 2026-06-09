/**
 * `hotel_slack_channels` — 호텔 ↔ Slack 채널 연동 (N:N, 2026-06-09).
 *
 * 어드민 호텔 상세 `슬랙 채널 연동` 섹션의 정본 테이블.
 * 해당 호텔에서 접수 발생 시, 연동된(`bot_joined=true`) 채널 전체로
 * 알림을 추가 발송한다 (기존 `#support_new` 병행).
 *
 * - 한 호텔에 여러 채널, 한 채널을 여러 호텔에 연결 가능 (N:N).
 * - 공개 채널은 `conversations.join`으로 봇 자동입장 → `bot_joined=true`.
 * - 비공개 채널은 봇 self-join 불가 → 저장하되 `bot_joined=false`
 *   ('봇 미초대' 표시). 수동 `/invite @봇` 후 상태 새로고침으로 전환.
 * - 해제는 soft delete(`is_active=false`) — 이력 보존.
 *
 * 기존 `hotels.slack_id`(단일 멤버 ID)는 폐기·미사용. 이 테이블로 일원화.
 */

import { boolean, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { hotels } from './hotels';

export const hotelSlackChannels = pgTable(
  'hotel_slack_channels',
  {
    ...commonColumns(),
    /** 연동 대상 호텔. */
    hotelId: uuid('hotel_id')
      .notNull()
      .references(() => hotels.id, { onDelete: 'cascade' }),
    /** Slack 채널 ID (`C…` 공개 / `G…`·`C…` 비공개). */
    channelId: text('channel_id').notNull(),
    /** 연동 시점 채널명 캐시 (표시용, 상태 새로고침 시 갱신). */
    channelName: text('channel_name'),
    /** 비공개 채널 여부. */
    channelIsPrivate: boolean('channel_is_private').notNull().default(false),
    /** 봇이 채널 멤버인지 = 연동 성공 판정 (로고 회색↔컬러). */
    botJoined: boolean('bot_joined').notNull().default(false),
    /** 연동을 수행한 어드민 (감사). */
    linkedByUserId: uuid('linked_by_user_id'),
  },
  (table) => [
    uniqueIndex('hotel_slack_channels_pair_uq').on(
      table.hotelId,
      table.channelId,
    ),
  ],
);

export type HotelSlackChannel = typeof hotelSlackChannels.$inferSelect;
export type NewHotelSlackChannel = typeof hotelSlackChannels.$inferInsert;
