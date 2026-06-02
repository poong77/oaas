/**
 * `users` — 호텔리어 / 매니저 / 어드민 계정.
 *
 * PM-01~04, AC-01~AC-10.
 * - 호텔리어: hotel_id 필수 (UI/Service 레벨에서 강제)
 * - 매니저/어드민: hotel_id null 가능
 * - SSO 전용 사용자는 password_hash null 가능
 */

import {
  type AnyPgColumn,
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { commonColumns, userRoleEnum } from './_shared';
import { hotels } from './hotels';

export const users = pgTable(
  'users',
  {
    ...commonColumns(),
    hotelId: uuid('hotel_id').references(() => hotels.id, {
      onDelete: 'set null',
    }),
    email: text('email').notNull(),
    /**
     * 로그인 아이디 (이메일과 별개). AS 이관 사용자의 기존 ID 보존.
     * 로그인 시 이메일 또는 아이디로 식별. SSO/신규 가입자는 null 가능.
     */
    username: text('username'),
    name: text('name').notNull(),
    title: text('title'),
    phone: text('phone'),
    /**
     * bcryptjs cost 12 해시. SSO 전용 가입 시 null.
     */
    passwordHash: text('password_hash'),
    role: userRoleEnum('role').notNull().default('hotelier'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    /** OA SSO `sub` claim. SSO 가입자 식별. */
    ssoSubject: text('sso_subject'),
    /** AC-09: 임시 비번 발급 시 true → 첫 로그인 시 변경 강제 */
    mustChangePassword: boolean('must_change_password')
      .notNull()
      .default(false),
    /** AC-04 직원 초대 / AC-07 어드민 생성 시 초대자 추적 */
    invitedBy: uuid('invited_by').references((): AnyPgColumn => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    uniqueIndex('users_email_uq').on(table.email),
    uniqueIndex('users_sso_subject_uq').on(table.ssoSubject),
    uniqueIndex('users_username_uq').on(table.username),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
