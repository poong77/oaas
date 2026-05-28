/**
 * `system_settings` — Phase 9. 어드민 전용 key-value 설정.
 *
 * value는 jsonb — 문자열/숫자/객체 자유.
 * description은 어드민 UI에서 도움말로 노출.
 * updated_by는 마지막 수정 어드민 추적용.
 *
 * 시드 예:
 *   - max_upload_mb: 50
 *   - rate_limit_login_per_min: 5
 *   - slack_channels: { tickets: '#cs-tickets', dev: '#dev-escalate' }
 *   - business_hours: { start: '09:00', end: '19:00', timezone: 'Asia/Seoul' }
 *   - contact_phone: '02-1234-5678'
 */

import { pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { jsonb } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { users } from './users';

export const systemSettings = pgTable(
  'system_settings',
  {
    ...commonColumns(),
    key: text('key').notNull(),
    value: jsonb('value').notNull().default({}).$type<unknown>(),
    description: text('description'),
    updatedBy: uuid('updated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [uniqueIndex('system_settings_key_uq').on(table.key)],
);

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
