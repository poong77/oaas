/**
 * `articles` — SS-02, SS-03, SS-06 (Phase 3 셀프 서치 핸드북).
 *
 * v1.1 스펙 정렬 (Plan + Design 진입):
 *   - content_type (howto/feature/troubleshoot) — 사용자 의도 분류
 *   - status (draft/published) — 명시적 발행 상태
 *   - keywords (text[]) — synonyms-master 결합 검색 보강
 *   - applies_to (JSONB) — feature/models 적용 범위
 *   - last_editor_id — 최종 수정자 (감사)
 *   - summary (text) — summary_30s 리네임 통합 (Q-13)
 *   - related_slugs (text[]) — related_article_ids(uuid[]) 대체 (Q-14)
 *
 * 운영 패턴:
 *   - draft = `status='draft'` (published_at은 발행 시각만 보관)
 *   - 발행 = `status='published'`, `published_at = now()`, TOC 자동 추출
 *   - 비활성 = `is_active = false` (소프트 삭제)
 *   - 조회수 증가는 페이지 진입 시 fire-and-forget
 *   - 도움됨 카운터(`helpful_yes`, `helpful_no`)는 `article_feedback` 변경 시 트랜잭션으로 갱신
 *
 * 인덱스:
 *   - slug unique
 *   - (product_code, content_type, status, published_at) — 매니저 목록 필터
 *   - (status, published_at) — 호텔리어 published 목록
 *   - keywords GIN — synonyms-master 결합 검색
 *   - 풀텍스트 GIN (title + summary + body_markdown) — 표현식 인덱스, 마이그레이션에서 수동 추가
 *
 * @see docs/02-design/features/아티클관리시스템.design.md §3.1
 *
 * 참고: deprecated 컬럼 (summary_30s, related_article_ids)은 마이그레이션에서 데이터 이관 후
 *       본 PR 다음 사이클에 별도 마이그레이션으로 DROP. 그 사이 회귀 발견 시 복구 가능.
 */

import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { commonColumns } from './_shared';
import { users } from './users';

/** content_type — 사용자 의도 분류 (닫힌 3값, Plan Q-3). */
export const articleContentTypeEnum = pgEnum('article_content_type', [
  'howto', // 사용방법 — 따라하기. title 동작형 (예: "예약 1건 등록하기")
  'feature', // 기능설명 — 이해하기. title 명사구 (예: "예약 상태값")
  'troubleshoot', // 문제해결 — 고치기. title 증상형 (예: "예약이 OTA에 안 뜰 때")
]);

/** status — 발행 상태 (draft → published 2단계, Plan Q-4). */
export const articleStatusEnum = pgEnum('article_status', [
  'draft',
  'published',
]);

/**
 * applies_to — 적용 범위. null = 전 고객/전 플랜 적용 (Plan Q-12).
 *
 * - `feature`: feature-registry 키 참조 (별도 마스터, 후속 Plan). 본 Phase는 자유 텍스트.
 * - `models`: 디바이스 모델 id 배열 (devices 마스터, 후속).
 */
export type ArticleAppliesTo = {
  feature?: string;
  models?: string[];
};

/** TOC 엔트리 (발행 시 본문에서 자동 추출). */
export type TocEntry = {
  level: 1 | 2 | 3;
  text: string;
  anchor: string;
};

export type ArticleContentType =
  (typeof articleContentTypeEnum.enumValues)[number];
export type ArticleStatus = (typeof articleStatusEnum.enumValues)[number];

export const articles = pgTable(
  'articles',
  {
    ...commonColumns(),
    productCode: text('product_code').notNull(),
    /** 사용자 의도 분류 (Plan Q-3). UI 표시는 한글 매핑. */
    contentType: articleContentTypeEnum('content_type').notNull(),
    /** 발행 상태 (Plan Q-4). published 전환 시만 published_at set. */
    status: articleStatusEnum('status').notNull().default('draft'),
    /** = menu_path. menu_taxonomies 마스터 라벨 경로와 대조 검증 (Plan Q-11). */
    categoryPath: text('category_path').array(),
    /** 전역 unique. URL의 [slug] 부분. */
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    /**
     * 메타/검색/SS-03 30초 요약 통합 (Q-13). ≤2000자 (Zod 강제),
     * 200자 초과 시 메타 폼에 워닝.
     */
    summary: text('summary'),
    /** deprecated — Q-13에 의해 summary로 통합. 마이그레이션 후 다음 사이클에 DROP. */
    summary30s: text('summary_30s'),
    /** synonyms-master 결합 검색 보강 (Q-3 + Plan §6). */
    keywords: text('keywords')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** 적용 범위. null = 전체 (Plan §2.4 권장). */
    appliesTo: jsonb('applies_to').$type<ArticleAppliesTo>(),
    /** 본문 — markdown + 인라인 HTML hybrid (Tiptap Option A, html:true). */
    bodyMarkdown: text('body_markdown').notNull(),
    toc: jsonb('toc').$type<TocEntry[]>(),
    /** slug 기반 안정 참조 (Q-14). 발행 시 존재 여부 검증 (워닝). */
    relatedSlugs: text('related_slugs')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** deprecated — Q-14에 의해 relatedSlugs로 전환. 다음 사이클에 DROP. */
    relatedArticleIds: uuid('related_article_ids').array(),
    authorId: uuid('author_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /** 최종 수정자 (감사). update 시마다 갱신. */
    lastEditorId: uuid('last_editor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    viewCount: integer('view_count').notNull().default(0),
    helpfulYes: integer('helpful_yes').notNull().default(0),
    helpfulNo: integer('helpful_no').notNull().default(0),
    /**
     * knowledge-base-overhaul v1.5 — 발행 시 validation 워닝 수.
     * 0이면 깨끗, > 0이면 /admin/articles에 ⚠️ "보완 N건" 배지 표시.
     * Hard 검증(productCode/title/slug/body)은 별도, 발행 차단 의미가 아님.
     */
    warningCount: integer('warning_count').notNull().default(0),
    /**
     * Phase 2 — 시맨틱 검색용 임베딩 (OpenAI text-embedding-3-small, 1536차원).
     * 발행/수정 시 title+summary+body로 생성. null = 미생성(키워드 검색만 적용).
     * OPENAI_API_KEY 미설정/오류 시 graceful degrade로 null 유지.
     */
    embedding: vector('embedding', { dimensions: 1536 }),
  },
  (table) => [
    uniqueIndex('articles_slug_uq').on(table.slug),
    // 매니저 목록 필터: product + content_type + status + published_at
    index('articles_product_ct_status_idx').on(
      table.productCode,
      table.contentType,
      table.status,
      table.publishedAt,
    ),
    // 호텔리어 published 목록
    index('articles_status_published_idx').on(table.status, table.publishedAt),
    // keywords 배열 OR 매칭 (synonyms-master expandKeywords 결합)
    index('articles_keywords_gin').using('gin', table.keywords),
    // 기존 인덱스 (호환)
    index('articles_product_published_idx').on(
      table.productCode,
      table.publishedAt,
    ),
    index('articles_active_published_idx').on(
      table.isActive,
      table.publishedAt,
    ),
    // 풀텍스트 GIN (title + summary + body_markdown) — 표현식 인덱스.
    // 0015 마이그레이션 SQL과 정확히 일치하도록 raw SQL 보간 사용.
    // 이렇게 schema에 명시해야 drizzle generate 시 매번 DROP INDEX 시도하지 않음 (D1 부채).
    index('articles_search_tsv').using(
      'gin',
      sql`to_tsvector('simple', coalesce(${table.title}, '') || ' ' || coalesce(${table.summary}, '') || ' ' || coalesce(${table.bodyMarkdown}, ''))`,
    ),
    // Phase 2 — 시맨틱 검색 HNSW 코사인 인덱스 (pgvector).
    // CREATE EXTENSION vector 는 마이그레이션 SQL에서 수동 보강.
    index('articles_embedding_hnsw').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  ],
);

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
