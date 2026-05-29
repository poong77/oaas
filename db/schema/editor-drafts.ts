/**
 * `editor_drafts` — 리치 에디터 자동 저장.
 *
 * 모든 RichEditor 적용 영역(article/notice/faq/checklist-step/quick-reply/ticket-message/system-setting)의
 * 미발행 작업 본문을 보존. 본 DB 컬럼(body_markdown 등) 발행 시 자동 삭제.
 *
 * 정책:
 *   - 소유자(user_id)만 GET/PUT/DELETE 가능
 *   - draft_key = '{scope}:{targetId}' (기존 편집) 또는 '{scope}:new:{nonce}' (신규 작성)
 *   - (user_id, draft_key) 유니크 — upsert 가능
 *   - 30일 경과 시 정리 cron (또는 즉시 is_active = false)
 *   - scope 화이트리스트는 lib/editor/draft-scope.ts 에서 zod 검증
 *
 * 참조: docs/01-plan/features/rich-editor.plan.md §4
 */

import { index, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { users } from './users';

export const editorDrafts = pgTable(
  'editor_drafts',
  {
    ...commonColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 'article' | 'notice' | 'faq' | 'checklist-step' | 'quick-reply' | 'ticket-message' | 'system-setting' */
    scope: varchar('scope', { length: 50 }).notNull(),
    /** 기존 항목 편집 시 PK. 신규 작성은 null. */
    targetId: uuid('target_id'),
    /** '{scope}:{targetId}' 또는 '{scope}:new:{nonce}' — (user_id, draft_key) 유니크 */
    draftKey: varchar('draft_key', { length: 200 }).notNull(),
    contentMarkdown: text('content_markdown').notNull(),
    /** JSON 직렬화된 보조 메타 (title, customFields 등). 작아야 함. */
    metadata: text('metadata'),
  },
  (t) => ({
    /** 사용자별 draft_key 유니크 — upsert 가능 */
    uniqUserDraft: uniqueIndex('editor_drafts_user_draft_key_uniq').on(t.userId, t.draftKey),
    byUser: index('editor_drafts_user_id_idx').on(t.userId),
    byUpdated: index('editor_drafts_updated_at_idx').on(t.updatedAt),
  }),
);

export type EditorDraft = typeof editorDrafts.$inferSelect;
export type NewEditorDraft = typeof editorDrafts.$inferInsert;
