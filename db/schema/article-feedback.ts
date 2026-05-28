/**
 * `article_feedback` — SS-03 도움됨 위젯.
 *
 * 운영 규칙:
 *   - 로그인 사용자: (article_id, user_id) unique → upsert 패턴
 *   - 비로그인: user_id NULL, 무제한 insert (단순 카운터용)
 *   - helpful 변경 시 articles.helpful_yes/helpful_no 트랜잭션 갱신
 *
 * append-only가 아닌 이유: 로그인 사용자가 본인 피드백 변경 가능해야 함.
 */

import {
  boolean,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { commonColumns } from './_shared';
import { articles } from './articles';
import { users } from './users';

export const articleFeedback = pgTable(
  'article_feedback',
  {
    ...commonColumns(),
    articleId: uuid('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    helpful: boolean('helpful').notNull(),
    comment: text('comment'),
  },
  (table) => [
    // 로그인 사용자 1회 제약 (NULL 비교는 Postgres에서 별개로 취급되어 자동 multi-row 허용)
    uniqueIndex('article_feedback_user_unique_idx')
      .on(table.articleId, table.userId)
      .where(sql`user_id IS NOT NULL`),
  ],
);

export type ArticleFeedback = typeof articleFeedback.$inferSelect;
export type NewArticleFeedback = typeof articleFeedback.$inferInsert;
