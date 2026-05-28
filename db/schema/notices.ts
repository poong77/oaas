/**
 * `notices` — NT-01 공지/업데이트 (Phase 7).
 *
 * 운영 패턴:
 *   - draft = `published_at IS NULL`
 *   - 발행 = `published_at = now()`
 *   - 비활성 = `is_active = false` (소프트 삭제)
 *   - banner=true 인 공지는 `emergency-banner.tsx`에서 전역 상단 띠로 노출
 *   - banner_until 이 있으면 그 시각 이후 자동 비표시 (조회 시점 lazy 체크 — 별도 cron 없음)
 *
 * 인덱스:
 *   - (is_active, published_at desc) — 통합 발행 목록 (가장 빈번)
 *   - (product_code, published_at) — 제품 필터 목록
 *   - (banner, is_active) — 긴급 배너 조회
 *
 * 참고:
 *   - product_code는 nullable. null이면 "전체 공지"
 *   - product_code는 categories.code 참조 (FK 미설정 — 카테고리 변경 유연성 확보)
 *   - 테이블명과 enum명을 의도적으로 다르게 유지 (Phase 5/6 학습):
 *     enum 이름 = `notice_kind`, 테이블 이름 = `notices`
 */

import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { users } from './users';

/**
 * 공지 종류 enum.
 *
 * notice    — 일반 공지 (기능 안내, 운영 알림 등)
 * release   — 릴리즈 노트 (버전 업데이트 내역)
 * incident  — 장애 공지 (사후 회고 또는 진행 중 안내)
 */
export const noticeKindEnum = pgEnum('notice_kind', [
  'notice',
  'release',
  'incident',
]);

export type NoticeKind = (typeof noticeKindEnum.enumValues)[number];

export const notices = pgTable(
  'notices',
  {
    ...commonColumns(),
    kind: noticeKindEnum('kind').notNull(),
    /** nullable: null이면 전체 공지. categories.code 참조 (FK 없음) */
    productCode: text('product_code'),
    title: text('title').notNull(),
    bodyMarkdown: text('body_markdown').notNull(),
    /** 목록 상단 고정 */
    pinned: boolean('pinned').notNull().default(false),
    /** 전역 상단 띠 노출 여부 */
    banner: boolean('banner').notNull().default(false),
    /** banner=true일 때 자동 해제 시각. null이면 무기한 */
    bannerUntil: timestamp('banner_until', { withTimezone: true }),
    /** null이면 draft. 발행 시점에 채워짐 */
    publishedAt: timestamp('published_at', { withTimezone: true }),
    viewCount: integer('view_count').notNull().default(0),
    authorId: uuid('author_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('notices_active_published_idx').on(
      table.isActive,
      table.publishedAt,
    ),
    index('notices_product_published_idx').on(
      table.productCode,
      table.publishedAt,
    ),
    index('notices_banner_active_idx').on(table.banner, table.isActive),
  ],
);

export type Notice = typeof notices.$inferSelect;
export type NewNotice = typeof notices.$inferInsert;
