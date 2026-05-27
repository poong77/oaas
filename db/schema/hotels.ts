/**
 * `hotels` — 호텔 마스터.
 *
 * AC-06~10, Phase 7 마스터 데이터 일부 선행.
 * OA PMS와의 연동 키는 `oa_pms_hotel_id` (unique nullable).
 */

import { pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';

export const hotels = pgTable(
  'hotels',
  {
    ...commonColumns(),
    name: text('name').notNull(),
    /**
     * OA PMS 시스템의 호텔 식별자.
     * SSO 클레임/연동 키이며, 매핑되지 않은 호텔(직접 등록)은 null.
     */
    oaPmsHotelId: text('oa_pms_hotel_id'),
    businessNo: text('business_no'),
    address: text('address'),
    phone: text('phone'),
    /** 호텔 측 주 담당자 (display only). 실제 계정은 users 테이블. */
    managerName: text('manager_name'),
    /** 어드민 내부 메모 */
    note: text('note'),
  },
  (table) => [
    uniqueIndex('hotels_oa_pms_hotel_id_uq').on(table.oaPmsHotelId),
  ],
);

export type Hotel = typeof hotels.$inferSelect;
export type NewHotel = typeof hotels.$inferInsert;
