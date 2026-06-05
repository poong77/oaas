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
  /** 어떤 제품 프리셋에서 선택했는지 (드롭다운 출처). 자유 입력 시 null. */
  presetId: uuid('preset_id').references(() => solutionLinkPresets.id, {
    onDelete: 'set null',
  }),
  /** 솔루션명 (프리셋 label 복사 또는 자유 입력). */
  label: text('label').notNull(),
  /** 바로가기(아웃링크) URL. */
  url: text('url').notNull(),
  /** 솔루션 로그인 ID/계정. */
  loginId: text('login_id'),
  /**
   * 솔루션 로그인 비밀번호 — AES-256-GCM 암호화 저장 (lib/crypto/secret).
   * 평문은 DB에 남지 않으며, 어드민이 명시적으로 '보기' 시에만 복호화.
   */
  passwordEnc: text('password_enc'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export type SolutionLinkPreset = typeof solutionLinkPresets.$inferSelect;
export type NewSolutionLinkPreset = typeof solutionLinkPresets.$inferInsert;
export type HotelSolutionLink = typeof hotelSolutionLinks.$inferSelect;
export type NewHotelSolutionLink = typeof hotelSolutionLinks.$inferInsert;
