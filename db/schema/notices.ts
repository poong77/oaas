/**
 * `notices` — NT-01 공지/업데이트 (Phase 7).
 *
 * 운영 패턴:
 *   - draft = `published_at IS NULL`
 *   - 발행 = `published_at = now()`
 *   - 비활성 = `is_active = false` (소프트 삭제)
 *   - banner=true 인 공지는 `emergency-banner.tsx`에서 전역 상단 띠로 노출
 *   - banner_until 이 있으면 그 시각 이후 자동 비표시 (조회 시점 lazy 체크 — 별도 cron 없음)
 *   - popup_enabled=true 인 공지는 `home-popup-banner.tsx`에서 홈 진입 시 모달로 노출 (NT-04)
 *     · popup_image_url 필수, popup_until 경과 시 자동 비표시 (lazy)
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

/**
 * 홈 팝업 배너 크기 프리셋 (NT-04).
 *
 * small    — max-w-sm        (작은 안내/이벤트)
 * medium   — max-w-md        (기본)
 * large    — max-w-2xl       (메인 프로모션)
 * wide     — max-w-[1200px]  (와이드 1200px)
 * original — 이미지 원본 크기 그대로 노출 (뷰포트 한도 내). 프리셋 너비 강제 없음
 *
 * ⚠️ pg enum이 아니라 text 컬럼이다. drizzle-kit push가 enum 값 추가 시
 *    `ALTER COLUMN ... SET DATA TYPE` 를 비멱등으로 생성해 매 배포마다 notices를
 *    파괴한 사고(2026-06-15) 이후, 검증은 앱(zod)에서만 하고 DB는 text로 둔다.
 */
export const NOTICE_POPUP_SIZES = [
  'small',
  'medium',
  'large',
  'wide',
  'original',
] as const;

export type NoticePopupSize = (typeof NOTICE_POPUP_SIZES)[number];

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
    /** NT-04 홈 팝업 배너 노출 여부 (텍스트 띠 banner와 독립) */
    popupEnabled: boolean('popup_enabled').notNull().default(false),
    /** 팝업 배너 이미지 URL (Vercel Blob). popup_enabled=true의 노출 필수 조건 */
    popupImageUrl: text('popup_image_url'),
    /** 팝업 모달 크기 프리셋 (text — enum 아님. 값 검증은 앱 zod에서) */
    popupSize: text('popup_size').notNull().default('medium').$type<NoticePopupSize>(),
    /** 팝업 이미지 원본 px 치수 — CLS 방지용(<img> width/height). 업로드 시 sharp가 측정. nullable(레거시 행) */
    popupImageWidth: integer('popup_image_width'),
    popupImageHeight: integer('popup_image_height'),
    /** 팝업 자동 종료 시각. null이면 무기한 (조회 시점 lazy 체크) */
    popupUntil: timestamp('popup_until', { withTimezone: true }),
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
    index('notices_popup_active_idx').on(table.popupEnabled, table.isActive),
  ],
);

export type Notice = typeof notices.$inferSelect;
export type NewNotice = typeof notices.$inferInsert;
