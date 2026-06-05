/**
 * `hotel_managed_links` — 멀티관리 호텔 매핑 (호텔 ↔ 호텔, N:M 자기참조).
 *
 * 한 운영 주체가 여러 호텔을 묶어 관리할 때 사용.
 * 매핑은 **양방향**: A→B를 추가하면 B→A도 함께 생성하여 양쪽 상세에서 모두 노출.
 * (서비스/액션 레벨에서 두 행을 함께 insert/delete 하여 보장.)
 */

import { pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { hotels } from './hotels';

export const hotelManagedLinks = pgTable(
  'hotel_managed_links',
  {
    ...commonColumns(),
    /** 기준 호텔. */
    hotelId: uuid('hotel_id')
      .notNull()
      .references(() => hotels.id, { onDelete: 'cascade' }),
    /** 연결된(멀티관리) 호텔. */
    linkedHotelId: uuid('linked_hotel_id')
      .notNull()
      .references(() => hotels.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('hotel_managed_links_pair_uq').on(
      table.hotelId,
      table.linkedHotelId,
    ),
  ],
);

export type HotelManagedLink = typeof hotelManagedLinks.$inferSelect;
export type NewHotelManagedLink = typeof hotelManagedLinks.$inferInsert;
