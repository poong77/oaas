/**
 * `solution_link_presets` (어드민 마스터) + `hotel_solution_links` (호텔별 실 데이터).
 *
 * AC-02: 호텔 프로필에 솔루션 링크 최대 5개 추가.
 * Phase 9에서 presets는 어드민 마스터 메뉴에서 편집 가능.
 */

import {
  integer,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { hotels } from './hotels';

export const solutionLinkPresets = pgTable('solution_link_presets', {
  ...commonColumns(),
  label: text('label').notNull(),
  /** 예: 'https://hotel-${slug}.example.com'. 사용자가 추가할 때 자동 채움. */
  defaultUrlTemplate: text('default_url_template'),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const hotelSolutionLinks = pgTable('hotel_solution_links', {
  ...commonColumns(),
  hotelId: uuid('hotel_id')
    .notNull()
    .references(() => hotels.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  url: text('url').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export type SolutionLinkPreset = typeof solutionLinkPresets.$inferSelect;
export type NewSolutionLinkPreset = typeof solutionLinkPresets.$inferInsert;
export type HotelSolutionLink = typeof hotelSolutionLinks.$inferSelect;
export type NewHotelSolutionLink = typeof hotelSolutionLinks.$inferInsert;
