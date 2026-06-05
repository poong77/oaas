/**
 * 공통 컬럼 헬퍼.
 *
 * 모든 비즈니스 테이블은 아래 4개 컬럼을 공통으로 가진다 (CLAUDE.md, dev-rules.md §5):
 *   id (uuid PK), created_at, updated_at, is_active
 *
 * append-only 테이블(activity_logs 등)은 is_active 없이 created_at만.
 */

import { boolean, pgEnum, timestamp, uuid } from 'drizzle-orm/pg-core';

/** PostgreSQL 13+ `gen_random_uuid()`를 기본값으로 사용. */
export const idColumn = () => uuid('id').primaryKey().defaultRandom();
export const createdAtColumn = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
export const updatedAtColumn = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
export const isActiveColumn = () =>
  boolean('is_active').notNull().default(true);

/** Drizzle 테이블 정의에서 spread하여 공통 컬럼 일괄 주입. */
export const commonColumns = () => ({
  id: idColumn(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
  isActive: isActiveColumn(),
});

/**
 * role enum — users.role.
 * Postgres enum 이름: user_role
 */
export const userRoleEnum = pgEnum('user_role', [
  'hotelier',
  'manager',
  'admin',
]);

/**
 * hotel type enum — hotels.hotel_type (사업자 구분).
 * direct      — 직영
 * operator    — 운영사
 * chain       — 체인
 * distributor — 총판
 */
export const hotelTypeEnum = pgEnum('hotel_type', [
  'direct',
  'operator',
  'chain',
  'distributor',
]);

/** category type enum */
export const categoryTypeEnum = pgEnum('category_type', [
  'product',
  'issue_type',
  'urgency',
  'impact',
]);

/**
 * service status enum (LP-03, NT-03).
 *
 * normal       — 모든 서비스 정상
 * degraded     — 일부 기능 제한 (사용 가능)
 * incident     — 장애 발생 (긴급 배너 자동 노출)
 * maintenance  — 점검 중 (안내 배너)
 */
export const serviceStatusEnum = pgEnum('service_status_kind', [
  'normal',
  'degraded',
  'incident',
  'maintenance',
]);

/**
 * term group category enum — term_groups.category.
 * 동의어 사전 그룹의 도메인 분류 (어드민 필터·관리용).
 */
export const termGroupCategoryEnum = pgEnum('term_group_category', [
  'operation', // 운영: 체크인/체크아웃/예약/객실/요금
  'housekeeping', // 청소: 하우스키핑/턴다운/린넨
  'fnb', // 식음료: 조식/룸서비스/미니바
  'frontdesk', // 프런트: FD/리셉션/컨시어지/벨맨
  'pms', // PMS 운영 용어: 룸 차지/배정/오버부킹/객단가
  'product', // OA 제품: PMS/CMS/Keyless/Kiosk/웹서비스
  'issue', // 장애 유형: 결제 실패/네트워크/카드 미인식
  'role', // 직무: 매니저/총지배인/객실팀장
  'misc', // 기타
]);

/**
 * popular keyword kind enum — popular_keywords.kind.
 * pin   — 어드민이 항상 상단 고정한 인기검색어
 * block — 자동집계(search_logs)에서 제외할 노이즈/금칙 검색어
 */
export const popularKeywordKindEnum = pgEnum('popular_keyword_kind', [
  'pin',
  'block',
]);

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type HotelType = (typeof hotelTypeEnum.enumValues)[number];
export type CategoryType = (typeof categoryTypeEnum.enumValues)[number];
export type ServiceStatusValue = (typeof serviceStatusEnum.enumValues)[number];
export type TermGroupCategory = (typeof termGroupCategoryEnum.enumValues)[number];
export type PopularKeywordKind =
  (typeof popularKeywordKindEnum.enumValues)[number];
