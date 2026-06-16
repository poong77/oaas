/**
 * `manual_message_templates` — MSG-16.
 *
 * 어드민 메일&문자 발송 화면(`/admin/insights/messaging`)의 "템플릿" 탭에서
 * 매니저/어드민이 자주 쓰는 발송 템플릿을 등록 → 발송 시 수신정보·변수값만 교체.
 *
 * - 자동 알림용 `notification_templates`(이벤트키 기반)와 별개 — 이쪽은 수동 일괄 발송 전용.
 * - channel: 'email' | 'sms'. 메일 본문은 markdown, 문자 본문은 plain.
 * - variables: 커스텀 변수 정의(변수명1~7). [{ name, source }].
 * - sortOrder: 드래그앤드롭 정렬.
 */

import { integer, pgTable, text, jsonb } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';

/** 템플릿에 등록하는 커스텀 변수 1건. */
export type ManualTemplateVar = {
  /** 변수명 (토큰은 `#{name}`). 예: '객실수' */
  name: string;
  /** 기본 값 소스. auto=연락처자동, manual=직접입력, excel=엑셀열 */
  source: 'auto' | 'manual' | 'excel';
};

export const manualMessageTemplates = pgTable('manual_message_templates', {
  ...commonColumns(),
  /** 'email' | 'sms' */
  channel: text('channel').notNull(),
  title: text('title').notNull(),
  memo: text('memo'),
  subject: text('subject'),
  body: text('body').notNull(),
  /** 메일 발신자 표시명 (MSG-20). */
  fromName: text('from_name'),
  /** 메일 발신자 local part (@oapms.com 앞부분). */
  fromLocal: text('from_local'),
  variables: jsonb('variables')
    .notNull()
    .default([])
    .$type<ManualTemplateVar[]>(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export type ManualMessageTemplate = typeof manualMessageTemplates.$inferSelect;
export type NewManualMessageTemplate = typeof manualMessageTemplates.$inferInsert;
