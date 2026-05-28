/**
 * articles / article_feedback 데이터 액세스 (Server 전용).
 *
 * Phase 3 (셀프 서치):
 *   - getArticleBySlug, listArticlesByProduct, listPopularArticles
 *   - searchArticles (ILIKE 기반 — Phase 5에서 tsvector 고도화 예정)
 *   - incrementViewCount (fire-and-forget)
 *   - recordFeedback (upsert + 카운터 트랜잭션)
 *
 * 미발행 아티클(`published_at IS NULL`)은 published 변형 함수에서 제외.
 */

import 'server-only';
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

import { db } from '@/db';
import {
  articleFeedback,
  articles,
  users,
  type Article,
  type NewArticle,
  type TocEntry,
} from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────

export type ArticleListItem = Pick<
  Article,
  | 'id'
  | 'slug'
  | 'title'
  | 'summary30s'
  | 'productCode'
  | 'categoryPath'
  | 'publishedAt'
  | 'viewCount'
  | 'helpfulYes'
  | 'helpfulNo'
  | 'isActive'
  | 'updatedAt'
  | 'createdAt'
  | 'authorId'
>;

export type ListArticlesParams = {
  productCode?: string;
  q?: string;
  isActive?: boolean | 'all';
  /** true: 발행만, false: draft만, undefined: 모두 */
  publishedOnly?: boolean;
  sortBy?: 'published_at' | 'view_count' | 'helpful' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
};

export type ListArticlesResult = {
  items: ArticleListItem[];
  total: number;
  page: number;
  pageSize: number;
};

// ─────────────────────────────────────────────────────────────────────
// 조회
// ─────────────────────────────────────────────────────────────────────

export async function listArticles(
  params: ListArticlesParams = {},
): Promise<ListArticlesResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 10));
  const offset = (page - 1) * pageSize;

  if (!db) {
    return { items: [], total: 0, page, pageSize };
  }

  const conditions: SQL[] = [];
  if (params.isActive !== 'all') {
    conditions.push(eq(articles.isActive, params.isActive ?? true));
  }
  if (params.productCode) {
    conditions.push(eq(articles.productCode, params.productCode));
  }
  if (params.publishedOnly === true) {
    conditions.push(isNotNull(articles.publishedAt));
  } else if (params.publishedOnly === false) {
    conditions.push(sql`${articles.publishedAt} IS NULL`);
  }
  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    const search = or(
      ilike(articles.title, pattern),
      ilike(articles.summary30s, pattern),
      ilike(articles.bodyMarkdown, pattern),
    );
    if (search) conditions.push(search);
  }

  const whereExpr =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

  const sortColumn =
    params.sortBy === 'view_count'
      ? articles.viewCount
      : params.sortBy === 'helpful'
        ? articles.helpfulYes
        : params.sortBy === 'updated_at'
          ? articles.updatedAt
          : articles.publishedAt;
  const orderExpr =
    (params.sortOrder ?? 'desc') === 'asc'
      ? asc(sortColumn)
      : desc(sortColumn);

  try {
    const items = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        summary30s: articles.summary30s,
        productCode: articles.productCode,
        categoryPath: articles.categoryPath,
        publishedAt: articles.publishedAt,
        viewCount: articles.viewCount,
        helpfulYes: articles.helpfulYes,
        helpfulNo: articles.helpfulNo,
        isActive: articles.isActive,
        updatedAt: articles.updatedAt,
        createdAt: articles.createdAt,
        authorId: articles.authorId,
      })
      .from(articles)
      .where(whereExpr)
      .orderBy(orderExpr, desc(articles.createdAt))
      .limit(pageSize)
      .offset(offset);

    const totalRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(articles)
      .where(whereExpr);
    const total = Number(totalRows[0]?.count ?? 0);

    return { items, total, page, pageSize };
  } catch (err) {
    console.error('[articles.listArticles] 실패:', err);
    return { items: [], total: 0, page, pageSize };
  }
}

/** 제품별 발행 아티클 카운트 (help 인덱스 카드용). */
export async function getArticleCountsByProduct(): Promise<
  Record<string, number>
> {
  if (!db) return {};
  try {
    const rows = await db
      .select({
        productCode: articles.productCode,
        count: sql<number>`count(*)::int`,
      })
      .from(articles)
      .where(
        and(eq(articles.isActive, true), isNotNull(articles.publishedAt)),
      )
      .groupBy(articles.productCode);
    const map: Record<string, number> = {};
    for (const r of rows) map[r.productCode] = Number(r.count);
    return map;
  } catch (err) {
    console.error('[articles.getArticleCountsByProduct] 실패:', err);
    return {};
  }
}

/** 인기 아티클 (조회수 상위). */
export async function listPopularArticles(
  limit = 5,
): Promise<ArticleListItem[]> {
  if (!db) return [];
  try {
    return await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        summary30s: articles.summary30s,
        productCode: articles.productCode,
        categoryPath: articles.categoryPath,
        publishedAt: articles.publishedAt,
        viewCount: articles.viewCount,
        helpfulYes: articles.helpfulYes,
        helpfulNo: articles.helpfulNo,
        isActive: articles.isActive,
        updatedAt: articles.updatedAt,
        createdAt: articles.createdAt,
        authorId: articles.authorId,
      })
      .from(articles)
      .where(
        and(eq(articles.isActive, true), isNotNull(articles.publishedAt)),
      )
      .orderBy(desc(articles.viewCount), desc(articles.publishedAt))
      .limit(limit);
  } catch (err) {
    console.error('[articles.listPopularArticles] 실패:', err);
    return [];
  }
}

/** 최근 발행 아티클 (홈 위젯용). */
export async function listRecentPublishedArticles(
  limit = 3,
): Promise<ArticleListItem[]> {
  if (!db) return [];
  try {
    return await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        summary30s: articles.summary30s,
        productCode: articles.productCode,
        categoryPath: articles.categoryPath,
        publishedAt: articles.publishedAt,
        viewCount: articles.viewCount,
        helpfulYes: articles.helpfulYes,
        helpfulNo: articles.helpfulNo,
        isActive: articles.isActive,
        updatedAt: articles.updatedAt,
        createdAt: articles.createdAt,
        authorId: articles.authorId,
      })
      .from(articles)
      .where(
        and(eq(articles.isActive, true), isNotNull(articles.publishedAt)),
      )
      .orderBy(desc(articles.publishedAt))
      .limit(limit);
  } catch (err) {
    console.error('[articles.listRecentPublishedArticles] 실패:', err);
    return [];
  }
}

export type ArticleDetail = Article & {
  authorName: string | null;
  authorEmail: string | null;
};

/**
 * slug 기준 상세 조회.
 * - includeUnpublished: 매니저+어드민 미리보기용. 기본 false.
 */
export async function getArticleBySlug(
  slug: string,
  options: { includeUnpublished?: boolean } = {},
): Promise<ArticleDetail | null> {
  if (!db) return null;
  try {
    const conditions: SQL[] = [
      eq(articles.slug, slug),
      eq(articles.isActive, true),
    ];
    if (!options.includeUnpublished) {
      conditions.push(isNotNull(articles.publishedAt));
    }
    const rows = await db
      .select({
        article: articles,
        authorName: users.name,
        authorEmail: users.email,
      })
      .from(articles)
      .leftJoin(users, eq(articles.authorId, users.id))
      .where(and(...conditions))
      .limit(1);
    const r = rows[0];
    return r
      ? {
          ...r.article,
          authorName: r.authorName,
          authorEmail: r.authorEmail,
        }
      : null;
  } catch (err) {
    console.error('[articles.getArticleBySlug] 실패:', err);
    return null;
  }
}

export async function getArticleById(
  id: string,
): Promise<ArticleDetail | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select({
        article: articles,
        authorName: users.name,
        authorEmail: users.email,
      })
      .from(articles)
      .leftJoin(users, eq(articles.authorId, users.id))
      .where(eq(articles.id, id))
      .limit(1);
    const r = rows[0];
    return r
      ? {
          ...r.article,
          authorName: r.authorName,
          authorEmail: r.authorEmail,
        }
      : null;
  } catch (err) {
    console.error('[articles.getArticleById] 실패:', err);
    return null;
  }
}

/** 관련 문서 ID 배열 → 발행 활성만 필터. */
export async function getRelatedArticles(
  ids: string[] | null | undefined,
  fallbackProduct?: string,
  limit = 4,
): Promise<ArticleListItem[]> {
  if (!db) return [];
  try {
    if (ids && ids.length > 0) {
      const rows = await db
        .select({
          id: articles.id,
          slug: articles.slug,
          title: articles.title,
          summary30s: articles.summary30s,
          productCode: articles.productCode,
          categoryPath: articles.categoryPath,
          publishedAt: articles.publishedAt,
          viewCount: articles.viewCount,
          helpfulYes: articles.helpfulYes,
          helpfulNo: articles.helpfulNo,
          isActive: articles.isActive,
          updatedAt: articles.updatedAt,
          createdAt: articles.createdAt,
          authorId: articles.authorId,
        })
        .from(articles)
        .where(
          and(
            inArray(articles.id, ids),
            eq(articles.isActive, true),
            isNotNull(articles.publishedAt),
          ),
        )
        .limit(limit);
      if (rows.length > 0) return rows;
    }
    if (!fallbackProduct) return [];
    return await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        summary30s: articles.summary30s,
        productCode: articles.productCode,
        categoryPath: articles.categoryPath,
        publishedAt: articles.publishedAt,
        viewCount: articles.viewCount,
        helpfulYes: articles.helpfulYes,
        helpfulNo: articles.helpfulNo,
        isActive: articles.isActive,
        updatedAt: articles.updatedAt,
        createdAt: articles.createdAt,
        authorId: articles.authorId,
      })
      .from(articles)
      .where(
        and(
          eq(articles.productCode, fallbackProduct),
          eq(articles.isActive, true),
          isNotNull(articles.publishedAt),
        ),
      )
      .orderBy(desc(articles.publishedAt))
      .limit(limit);
  } catch (err) {
    console.error('[articles.getRelatedArticles] 실패:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// 검색 (SS-01)
// ─────────────────────────────────────────────────────────────────────

export type SearchArticleHit = ArticleListItem & {
  /** 단순 점수 — title 일치(2) > summary(1) > body(0.5). Phase 5에서 tsvector. */
  score: number;
};

export async function searchArticles(
  q: string,
  options: { productCode?: string; limit?: number } = {},
): Promise<SearchArticleHit[]> {
  if (!db) return [];
  const query = q.trim();
  if (!query) return [];
  const pattern = `%${query}%`;
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  try {
    const conditions: SQL[] = [
      eq(articles.isActive, true),
      isNotNull(articles.publishedAt),
    ];
    if (options.productCode) {
      conditions.push(eq(articles.productCode, options.productCode));
    }
    const searchCond = or(
      ilike(articles.title, pattern),
      ilike(articles.summary30s, pattern),
      ilike(articles.bodyMarkdown, pattern),
    );
    if (searchCond) conditions.push(searchCond);

    const rows = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        summary30s: articles.summary30s,
        productCode: articles.productCode,
        categoryPath: articles.categoryPath,
        publishedAt: articles.publishedAt,
        viewCount: articles.viewCount,
        helpfulYes: articles.helpfulYes,
        helpfulNo: articles.helpfulNo,
        isActive: articles.isActive,
        updatedAt: articles.updatedAt,
        createdAt: articles.createdAt,
        authorId: articles.authorId,
      })
      .from(articles)
      .where(and(...conditions))
      .orderBy(desc(articles.publishedAt))
      .limit(limit);

    // 클라이언트사이드 점수 부여 (Phase 3 단순화)
    const lowered = query.toLowerCase();
    return rows.map((r) => {
      let score = 0;
      if (r.title.toLowerCase().includes(lowered)) score += 2;
      if (r.summary30s?.toLowerCase().includes(lowered)) score += 1;
      return { ...r, score };
    });
  } catch (err) {
    console.error('[articles.searchArticles] 실패:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// 카운터 / 피드백
// ─────────────────────────────────────────────────────────────────────

/** 페이지 진입 시 fire-and-forget 호출. 실패해도 무시. */
export function incrementViewCount(articleId: string): void {
  if (!db) return;
  Promise.resolve()
    .then(async () => {
      await db!
        .update(articles)
        .set({ viewCount: sql`${articles.viewCount} + 1` })
        .where(eq(articles.id, articleId));
    })
    .catch((err) => {
      console.warn(
        `[articles.incrementViewCount] articleId=${articleId} 실패:`,
        err instanceof Error ? err.message : err,
      );
    });
}

export type RecordFeedbackInput = {
  articleId: string;
  helpful: boolean;
  comment?: string | null;
  userId?: string | null;
};

export type RecordFeedbackResult = {
  ok: boolean;
  message?: string;
  helpfulYes?: number;
  helpfulNo?: number;
};

/**
 * 도움됨 위젯 피드백 기록.
 * - 로그인 사용자: (articleId, userId) 이미 있으면 update (이전 helpful 반영해서 카운터 보정)
 * - 비로그인: insert only, 카운터만 +1
 */
export async function recordFeedback(
  input: RecordFeedbackInput,
): Promise<RecordFeedbackResult> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  const target = await db
    .select({ id: articles.id, isActive: articles.isActive })
    .from(articles)
    .where(eq(articles.id, input.articleId))
    .limit(1);
  if (target.length === 0 || target[0]!.isActive === false) {
    return { ok: false, message: 'ARTICLE_NOT_FOUND' };
  }

  try {
    if (input.userId) {
      // 기존 피드백 조회 (upsert 패턴)
      const existing = await db
        .select()
        .from(articleFeedback)
        .where(
          and(
            eq(articleFeedback.articleId, input.articleId),
            eq(articleFeedback.userId, input.userId),
          ),
        )
        .limit(1);
      if (existing.length > 0) {
        const prev = existing[0]!;
        if (prev.helpful === input.helpful) {
          // 같은 값 → 코멘트만 갱신, 카운터 변동 없음
          await db
            .update(articleFeedback)
            .set({ comment: input.comment ?? null })
            .where(eq(articleFeedback.id, prev.id));
        } else {
          // helpful 값 변경 → 카운터 보정
          await db
            .update(articleFeedback)
            .set({ helpful: input.helpful, comment: input.comment ?? null })
            .where(eq(articleFeedback.id, prev.id));
          if (input.helpful) {
            await db
              .update(articles)
              .set({
                helpfulYes: sql`${articles.helpfulYes} + 1`,
                helpfulNo: sql`GREATEST(${articles.helpfulNo} - 1, 0)`,
              })
              .where(eq(articles.id, input.articleId));
          } else {
            await db
              .update(articles)
              .set({
                helpfulNo: sql`${articles.helpfulNo} + 1`,
                helpfulYes: sql`GREATEST(${articles.helpfulYes} - 1, 0)`,
              })
              .where(eq(articles.id, input.articleId));
          }
        }
      } else {
        // 신규 피드백
        await db.insert(articleFeedback).values({
          articleId: input.articleId,
          userId: input.userId,
          helpful: input.helpful,
          comment: input.comment ?? null,
        });
        await incrementHelpfulCounter(input.articleId, input.helpful);
      }
    } else {
      // 비로그인 — insert only
      await db.insert(articleFeedback).values({
        articleId: input.articleId,
        userId: null,
        helpful: input.helpful,
        comment: input.comment ?? null,
      });
      await incrementHelpfulCounter(input.articleId, input.helpful);
    }

    // 최종 카운터 재조회
    const after = await db
      .select({
        helpfulYes: articles.helpfulYes,
        helpfulNo: articles.helpfulNo,
      })
      .from(articles)
      .where(eq(articles.id, input.articleId))
      .limit(1);

    return {
      ok: true,
      helpfulYes: after[0]?.helpfulYes ?? 0,
      helpfulNo: after[0]?.helpfulNo ?? 0,
    };
  } catch (err) {
    console.error('[articles.recordFeedback] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

async function incrementHelpfulCounter(
  articleId: string,
  helpful: boolean,
): Promise<void> {
  if (!db) return;
  if (helpful) {
    await db
      .update(articles)
      .set({ helpfulYes: sql`${articles.helpfulYes} + 1` })
      .where(eq(articles.id, articleId));
  } else {
    await db
      .update(articles)
      .set({ helpfulNo: sql`${articles.helpfulNo} + 1` })
      .where(eq(articles.id, articleId));
  }
}

// ─────────────────────────────────────────────────────────────────────
// 어드민 CRUD (Server Action에서 호출)
// ─────────────────────────────────────────────────────────────────────

export type ArticleWriteInput = {
  productCode: string;
  categoryPath?: string[] | null;
  slug: string;
  title: string;
  summary30s?: string | null;
  bodyMarkdown: string;
  relatedArticleIds?: string[] | null;
  publish?: boolean;
};

export async function slugExists(
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  if (!db) return false;
  try {
    const rows = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.slug, slug))
      .limit(1);
    if (rows.length === 0) return false;
    if (excludeId && rows[0]!.id === excludeId) return false;
    return true;
  } catch (err) {
    console.error('[articles.slugExists] 실패:', err);
    return false;
  }
}

export async function createArticle(
  input: ArticleWriteInput,
  authorId: string,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const toc = extractToc(input.bodyMarkdown);
    const values: NewArticle = {
      productCode: input.productCode,
      categoryPath: input.categoryPath ?? null,
      slug: input.slug,
      title: input.title,
      summary30s: input.summary30s ?? null,
      bodyMarkdown: input.bodyMarkdown,
      toc,
      relatedArticleIds: input.relatedArticleIds ?? null,
      authorId,
      publishedAt: input.publish ? new Date() : null,
    };
    const [row] = await db.insert(articles).values(values).returning({
      id: articles.id,
    });
    return { ok: true, id: row?.id };
  } catch (err) {
    console.error('[articles.createArticle] 실패:', err);
    const msg = err instanceof Error ? err.message : 'INTERNAL_ERROR';
    if (msg.includes('articles_slug_uq')) {
      return { ok: false, message: 'SLUG_DUPLICATE' };
    }
    return { ok: false, message: msg };
  }
}

export async function updateArticleById(
  id: string,
  input: ArticleWriteInput,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const toc = extractToc(input.bodyMarkdown);
    await db
      .update(articles)
      .set({
        productCode: input.productCode,
        categoryPath: input.categoryPath ?? null,
        slug: input.slug,
        title: input.title,
        summary30s: input.summary30s ?? null,
        bodyMarkdown: input.bodyMarkdown,
        toc,
        relatedArticleIds: input.relatedArticleIds ?? null,
      })
      .where(eq(articles.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[articles.updateArticleById] 실패:', err);
    const msg = err instanceof Error ? err.message : 'INTERNAL_ERROR';
    if (msg.includes('articles_slug_uq')) {
      return { ok: false, message: 'SLUG_DUPLICATE' };
    }
    return { ok: false, message: msg };
  }
}

export async function togglePublishArticleById(
  id: string,
  publish: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(articles)
      .set({ publishedAt: publish ? new Date() : null })
      .where(eq(articles.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[articles.togglePublishArticleById] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function archiveArticleById(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(articles)
      .set({ isActive: false })
      .where(eq(articles.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[articles.archiveArticleById] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function restoreArticleById(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(articles)
      .set({ isActive: true })
      .where(eq(articles.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[articles.restoreArticleById] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

/**
 * 본문 마크다운에서 TOC 자동 추출 (#, ##, ### 까지).
 * anchor는 lowercase + 공백 → hyphen + non-word 제거 (rehype-slug 기본 규칙 모방).
 */
export function extractToc(markdown: string): TocEntry[] {
  const lines = markdown.split('\n');
  const entries: TocEntry[] = [];
  // 코드블록 안쪽의 #는 무시
  let inCodeBlock = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    const m = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const level = m[1]!.length as 1 | 2 | 3;
    const text = m[2]!.replace(/[*_`~]/g, '').trim();
    if (!text) continue;
    const anchor = toAnchor(text);
    entries.push({ level, text, anchor });
  }
  return entries;
}

function toAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\wㄱ-힝\s-]/g, '') // 한글 + word + 공백 + 하이픈만
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || `h-${Math.random().toString(36).slice(2, 8)}`;
}
