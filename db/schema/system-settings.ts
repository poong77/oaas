/**
 * `system_settings` — Phase 9. 어드민 전용 key-value 설정.
 *
 * value는 jsonb — 문자열/숫자/객체 자유.
 * description은 어드민 UI에서 도움말로 노출.
 * updated_by는 마지막 수정 어드민 추적용.
 *
 * 현재 사용 중인 키(2026-06 기준):
 *   - master_menu_manager_access: 마스터 메뉴별 매니저 접근 OFF 오버라이드 (메뉴 접근 제어)
 *   - dismissed_keyword_gaps: 동의어 갭 분석에서 무시 처리한 키워드 (동의어 사전)
 *   - mail_footer: { markdown } 발송 메일 하단 자동 첨부 푸터 (메일&문자)
 *
 * 참고: 구 예시 키(max_upload_mb·rate_limit_login_per_min·slack_channels·
 *   business_hours·contact_phone)는 2026-06-09 정리되어 더 이상 사용하지 않는다.
 *   운영시간/연락처는 전용 테이블 business_hours_default로 이전됨.
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
