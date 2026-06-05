/**
 * `hotels` — 호텔 마스터.
 *
 * AC-06~10, Phase 7 마스터 데이터 일부 선행.
 * OA PMS와의 연동 키는 `oa_pms_hotel_id` (unique nullable).
 *
 * 정보 보강(호텔 상세):
 *   - 사업자 정보: business_no, representative_name, corporate_name, hotel_type, contract_year/month, address
 *   - 연락처: manager_name, phone, slack_id, extra_contacts(JSONB), extra_emails(JSONB)
 *   - 내부 메모: note
 *   - 솔루션/멀티관리 호텔은 별도 테이블(solution-links, hotel-managed-links)
 */

import { integer, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { commonColumns, hotelTypeEnum } from './_shared';

/** 추가 연락처 한 건 (이름 + 연락처). extra_contacts JSONB 배열 요소. */
export type HotelExtraContact = { name: string; phone: string };

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

    // ── 사업자 정보 ──────────────────────────────────────────────
    businessNo: text('business_no'),
    /** 대표명 */
    representativeName: text('representative_name'),
    /** 법인명 */
    corporateName: text('corporate_name'),
    /** 사업자 구분: 직영/운영사/체인/총판 */
    hotelType: hotelTypeEnum('hotel_type'),
    /** 계약 시점 (연) */
    contractYear: integer('contract_year'),
    /** 계약 시점 (월, 1~12) */
    contractMonth: integer('contract_month'),
    address: text('address'),

    // ── 연락처 ──────────────────────────────────────────────────
    phone: text('phone'),
    /** 호텔 측 주 담당자 (display only). 실제 계정은 users 테이블. */
    managerName: text('manager_name'),
    /**
     * 이 호텔 접수건 관련 알림을 바로 보낼 Slack 멤버 ID (예: `U01ABC23`).
     */
    slackId: text('slack_id'),
    /** 추가 연락처 목록 (이름 + 연락처). */
    extraContacts: jsonb('extra_contacts')
      .$type<HotelExtraContact[]>()
      .notNull()
      .default([]),
    /** 추가 이메일 주소 목록. */
    extraEmails: jsonb('extra_emails').$type<string[]>().notNull().default([]),

    /** 어드민 내부 메모 */
    note: text('note'),
  },
  (table) => [
    uniqueIndex('hotels_oa_pms_hotel_id_uq').on(table.oaPmsHotelId),
  ],
);

export type Hotel = typeof hotels.$inferSelect;
export type NewHotel = typeof hotels.$inferInsert;
