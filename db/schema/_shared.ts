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

/** category type enum */
export const categoryTypeEnum = pgEnum('category_type', [
  'product',
  'issue_type',
  'urgency',
  'impact',
]);

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type CategoryType = (typeof categoryTypeEnum.enumValues)[number];
