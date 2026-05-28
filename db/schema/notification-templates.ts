/**
 * `notification_templates` — Phase 9 마스터 데이터.
 *
 * 이벤트(event_key)별 + 채널(sms/email)별 알림 템플릿. 어드민이 편집.
 * Phase 5에서 정의된 `notification_channel` enum 재사용 (slack 포함되지만 master 용도는 sms/email만 사용).
 *
 * 운영 패턴:
 *   - (channel, event_key) unique. 중복 시 DB row가 빌더 fallback을 덮어씀.
 *   - body에 `{{변수}}` 형태 치환자 사용. 렌더는 `lib/notifications/templates.ts`.
 *   - DB에 row 없으면 기존 하드코딩 빌더로 자동 fallback (Phase 1~5 호환).
 *
 * 인덱스:
 *   - (channel, event_key) unique
 */

import {
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { notificationChannelEnum } from './notification-logs';

export const notificationTemplates = pgTable(
  'notification_templates',
  {
    ...commonColumns(),
    channel: notificationChannelEnum('channel').notNull(),
    eventKey: text('event_key').notNull(),
    /** email 전용. sms는 null. */
    subject: text('subject'),
    bodyTemplate: text('body_template').notNull(),
    description: text('description'),
  },
  (table) => [
    uniqueIndex('notification_templates_channel_event_uq').on(
      table.channel,
      table.eventKey,
    ),
  ],
);

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type NewNotificationTemplate = typeof notificationTemplates.$inferInsert;
