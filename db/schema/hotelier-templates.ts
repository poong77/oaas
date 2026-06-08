/**
 * `hotelier_templates` — 호텔리어 접수 템플릿 (마스터DB).
 *
 * 호텔리어가 `/tickets/new` 접수폼 '자세한 내용' 위 버튼으로 본문에 끼워넣는
 * 정형 입력 양식. title = 버튼 라벨(예: '계정생성/삭제'), content = 본문 삽입 텍스트.
 * 카테고리는 자유 텍스트 (예: '계정', '매출', '예약').
 */

import { integer, pgTable, text } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';

export const hotelierTemplates = pgTable('hotelier_templates', {
  ...commonColumns(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  category: text('category'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export type HotelierTemplate = typeof hotelierTemplates.$inferSelect;
export type NewHotelierTemplate = typeof hotelierTemplates.$inferInsert;
