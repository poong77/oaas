/**
 * `password_reset_tokens` — AC-11 셀프 비밀번호 찾기.
 *
 * 보안 설계 (임시비번 방식 대신 OTP/토큰 채택):
 *   - 이메일 = 일회용 재설정 링크 (opaque 토큰, 30분 만료)
 *   - 문자  = 6자리 인증코드 (10분 만료, 5회 시도 제한)
 *   - 토큰/코드는 평문 저장 금지 → sha256 해시만 저장
 *   - 완료/만료/한도초과 시 is_active=false (1회용)
 */

import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { users } from './users';

/** 재설정 채널. */
export const passwordResetChannelEnum = pgEnum('password_reset_channel', [
  'email',
  'sms',
]);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    ...commonColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: passwordResetChannelEnum('channel').notNull(),
    /** sha256(opaque 토큰). 링크 토큰(email) 또는 세션 참조(sms). */
    tokenHash: text('token_hash').notNull(),
    /** sha256(6자리 코드). sms 전용, email은 null. */
    codeHash: text('code_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** 1회용 — 비밀번호 변경 완료 시각. */
    usedAt: timestamp('used_at', { withTimezone: true }),
    /** sms 코드 검증 통과 시각. reset 페이지 접근 게이트. */
    codeVerifiedAt: timestamp('code_verified_at', { withTimezone: true }),
    /** sms 코드 오입력 횟수 (5회 초과 시 무효). */
    attempts: integer('attempts').notNull().default(0),
    ip: text('ip'),
  },
  (table) => [
    // opaque 토큰은 32바이트 난수라 충돌 불가 — UNIQUE로 조회 정합성 보장 + 중복 차단.
    uniqueIndex('password_reset_tokens_token_hash_uq').on(table.tokenHash),
    index('password_reset_tokens_user_id_idx').on(table.userId),
  ],
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
