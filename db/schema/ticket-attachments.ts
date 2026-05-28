/**
 * `ticket_attachments` — 티켓 첨부파일 (Vercel Blob).
 *
 * 운영 패턴:
 *   - 사용자가 접수 폼에서 업로드하면 `/api/upload`가 Vercel Blob에 put().
 *   - 티켓 생성 전엔 `ticketId=null`로 staging 상태일 수 있으나, MVP는 접수 트랜잭션 안에서 매핑.
 *   - blobUrl은 public read. 추후 signed URL 강화 가능.
 *
 * 첨부는 `messageId`가 비어있으면 티켓 본문 첨부, 채워져 있으면 해당 메시지 첨부.
 */

import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { tickets } from './tickets';
import { ticketMessages } from './ticket-messages';
import { users } from './users';

export const ticketAttachments = pgTable(
  'ticket_attachments',
  {
    ...commonColumns(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').references(() => ticketMessages.id, {
      onDelete: 'set null',
    }),
    /** Vercel Blob URL (public read). */
    blobUrl: text('blob_url').notNull(),
    /** Vercel Blob pathname (삭제·이동 시 사용). */
    pathname: text('pathname').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes').notNull().default(0),
    uploaderId: uuid('uploader_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('ticket_attachments_ticket_idx').on(table.ticketId),
    index('ticket_attachments_message_idx').on(table.messageId),
  ],
);

export type TicketAttachment = typeof ticketAttachments.$inferSelect;
export type NewTicketAttachment = typeof ticketAttachments.$inferInsert;
