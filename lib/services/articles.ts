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
  arrayContains,
  arrayOverlaps,
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
  type ArticleContentType,
  type ArticleStatus,
  type ArticleAppliesTo,
  type NewArticle,
  type TocEntry,
} from '@/db/schema';
import { extractToc as extractTocV2 } from '@/lib/articles/toc-extractor';

// ─────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────

export type ArticleListItem = Pick<
  Article,
  | 'id'
  | 'slug'
  | 'title'
  | 'summary'
  | 'summary30s'
  | 'productCode'
  | 'contentType'
  | 'status'
  | 'categoryPath'
  | 'keywords'
  | 'publishedAt'
  | 'viewCount'
  | 'helpfulYes'
  | 'helpfulNo'
  | 'warningCount'
  | 'isActive'
  | 'updatedAt'
  | 'createdAt'
  | 'authorId'
  | 'lastEditorId'
>;

export type ListArticlesParams = {
  productCode?: string;
  q?: string;
  isActive?: boolean | 'all';
  /** true: 발행만, false: draft만, undefined: 모두 */
  publishedOnly?: boolean;
  /** v1.1 — content_type 필터 */
  contentType?: ArticleContentType;
  /** v1.1 — status 필터 (publishedOnly와 중복 시 status 우선) */
  status?: ArticleStatus;
  sortBy?: 'published_at' | 'view_count' | 'helpful' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  /**
   * v1.3 (knowledge-base-overhaul B1) — categoryPath prefix 필터.
   *
   * `articles.categoryPath @> selectedPath` (배열 contains).
   * 예: selectedPath=['예약 관리', '예약 등록'] 이면 그 prefix를 포함하는 아티클만.
   */
  selectedPath?: string[];
};

export type ListArticlesResult = {
  items: ArticleListItem[];
  total: number;
  /** 필터 조건 전체 기준 발행 아티클 수 (현재 페이지 아님). */
  totalPublished: number;
  /** 필터 조건 전체 기준 Draft 아티클 수 (현재 페이지 아님). */
  totalDraft: number;
  page: number;
  pageSize: number;
};

// ─────────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────────

/** ArticleListItem과 매칭되는 select 객체 (5개 list 함수에서 재사용). */
const ARTICLE_LIST_SELECT = {
  id: articles.id,
  slug: articles.slug,
  title: articles.title,
  summary: articles.summary,
  summary30s: articles.summary30s,
  productCode: articles.productCode,
  contentType: articles.contentType,
  status: articles.status,
  categoryPath: articles.categoryPath,
  keywords: articles.keywords,
  publishedAt: articles.publishedAt,
  viewCount: articles.viewCount,
  helpfulYes: articles.helpfulYes,
  helpfulNo: articles.helpfulNo,
  warningCount: articles.warningCount,
  isActive: articles.isActive,
  updatedAt: articles.updatedAt,
  createdAt: articles.createdAt,
  authorId: articles.authorId,
  lastEditorId: articles.lastEditorId,
} as const;

// ─────────────────────────────────────────────────────────────────────
// 조회
// ─────────────────────────────────────────────────────────────────────

/**
 * 검색 조건 빌더 (listArticles / searchArticles 공유).
 *
 * 동의어 확장 결과(expanded)를 받아:
 *   (1) keywords 배열 매칭 (GIN: articles_keywords_gin)
 *   (2) 확장된 각 term을 title/summary/summary30s/bodyMarkdown ILIKE
 * 를 OR로 묶는다.
 *
 * keywords는 작성자가 수동 입력하므로 동의어가 누락될 수 있어,
 * 확장 term을 본문에도 ILIKE 매칭해 "실시간객실 ↔ 실시간 객실"처럼
 * 띄어쓰기/이형어 차이를 흡수한다.
 *
 * 주의: leg (1) arrayOverlaps는 정확 일치(대소문자/공백 민감)라
 * keywords가 확장 term과 형태가 다르면 미스 → leg (2) ILIKE가 보완한다.
 * 즉 (1)은 정확-매칭 GIN 가속 경로, (2)가 의미 매칭의 실질 보장.
 */
function buildArticleSearchCondition(expanded: string[]): SQL | undefined {
  if (expanded.length === 0) return undefined;
  const orParts: SQL[] = [];
  // (1) keywords 배열 매칭 (파라미터 바인딩 — sql.raw 수동 이스케이프 제거)
  orParts.push(arrayOverlaps(articles.keywords, expanded));
  // (2) 확장 term 각각 ILIKE — title/summary/summary30s/body
  for (const term of expanded) {
    const pattern = `%${term}%`;
    const cond = or(
      ilike(articles.title, pattern),
      ilike(articles.summary, pattern),
      ilike(articles.summary30s, pattern),
      ilike(articles.bodyMarkdown, pattern),
    );
    if (cond) orParts.push(cond);
  }
  return orParts.length === 1 ? orParts[0] : or(...orParts);
}

/**
 * 아티클 시맨틱 검색 임베딩 생성 (Phase 2).
 * graceful: OPENAI_API_KEY 미설정/오류 시 null → 임베딩 없이 저장.
 */
async function generateArticleEmbedding(a: {
  title: string;
  summary?: string | null;
  summary30s?: string | null;
  keywords?: string[] | null;
  bodyMarkdown?: string | null;
}): Promise<number[] | null> {
  const { embedText, buildArticleEmbeddingInput } =
    await import('./embeddings');
  return embedText(buildArticleEmbeddingInput(a));
}

export async function listArticles(
  params: ListArticlesParams = {},
): Promise<ListArticlesResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 10));
  const offset = (page - 1) * pageSize;

  if (!db) {
    return {
      items: [],
      total: 0,
      totalPublished: 0,
      totalDraft: 0,
      page,
      pageSize,
    };
  }

  const conditions: SQL[] = [];
  if (params.isActive !== 'all') {
    conditions.push(eq(articles.isActive, params.isActive ?? true));
  }
  if (params.productCode) {
    conditions.push(eq(articles.productCode, params.productCode));
  }
  if (params.status) {
    conditions.push(eq(articles.status, params.status));
  } else if (params.publishedOnly === true) {
    conditions.push(eq(articles.status, 'published'));
  } else if (params.publishedOnly === false) {
    conditions.push(eq(articles.status, 'draft'));
  }
  if (params.contentType) {
    conditions.push(eq(articles.contentType, params.contentType));
  }
  if (params.selectedPath && params.selectedPath.length > 0) {
    // PostgreSQL 배열 contains: categoryPath가 selectedPath의 모든 라벨을 포함하면 매칭.
    // ⚠️ sql`... @> ${배열}::text[]`로 쓰면 Drizzle이 JS 배열을 ($1, $2) record로
    // 전개해 'cannot cast record to text[]' 에러가 난다. arrayContains 헬퍼를 써야
    // 단일 배열 파라미터('{a,b}')로 올바르게 바인딩된다. @see keywords arrayOverlaps
    conditions.push(arrayContains(articles.categoryPath, params.selectedPath));
  }
  if (params.q && params.q.trim()) {
    // v1.2: 제품 가이드/목록 검색도 동의어(synonyms-master) 확장 적용.
    // 예) "실시간객실" → "실시간 객실". searchArticles와 동일 로직 공유.
    const { expandKeywords } = await import('@/lib/services/synonym-expander');
    // maxTokens 16: 목록(SS-02)은 단일 제품 범위라 통합검색(SS-01, 32)보다
    // 좁게 확장 — ILIKE 조건 수 과증가 방지.
    const expanded = await expandKeywords(params.q.trim(), { maxTokens: 16 });
    const search = buildArticleSearchCondition(expanded);
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
    (params.sortOrder ?? 'desc') === 'asc' ? asc(sortColumn) : desc(sortColumn);

  try {
    const items = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        summary: articles.summary,
        summary30s: articles.summary30s,
        productCode: articles.productCode,
        contentType: articles.contentType,
        status: articles.status,
        categoryPath: articles.categoryPath,
        keywords: articles.keywords,
        publishedAt: articles.publishedAt,
        viewCount: articles.viewCount,
        helpfulYes: articles.helpfulYes,
        helpfulNo: articles.helpfulNo,
        warningCount: articles.warningCount,
        isActive: articles.isActive,
        updatedAt: articles.updatedAt,
        createdAt: articles.createdAt,
        authorId: articles.authorId,
        lastEditorId: articles.lastEditorId,
      })
      .from(articles)
      .where(whereExpr)
      .orderBy(orderExpr, desc(articles.createdAt))
      .limit(pageSize)
      .offset(offset);

    const totalRows = await db
      .select({
        count: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${articles.publishedAt} is not null)::int`,
        draft: sql<number>`count(*) filter (where ${articles.publishedAt} is null)::int`,
      })
      .from(articles)
      .where(whereExpr);
    const total = Number(totalRows[0]?.count ?? 0);
    const totalPublished = Number(totalRows[0]?.published ?? 0);
    const totalDraft = Number(totalRows[0]?.draft ?? 0);

    return { items, total, totalPublished, totalDraft, page, pageSize };
  } catch (err) {
    console.error('[articles.listArticles] 실패:', err);
    return {
      items: [],
      total: 0,
      totalPublished: 0,
      totalDraft: 0,
      page,
      pageSize,
    };
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
      .where(and(eq(articles.isActive, true), isNotNull(articles.publishedAt)))
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
        summary: articles.summary,
        summary30s: articles.summary30s,
        productCode: articles.productCode,
        contentType: articles.contentType,
        status: articles.status,
        categoryPath: articles.categoryPath,
        keywords: articles.keywords,
        publishedAt: articles.publishedAt,
        viewCount: articles.viewCount,
        helpfulYes: articles.helpfulYes,
        helpfulNo: articles.helpfulNo,
        warningCount: articles.warningCount,
        isActive: articles.isActive,
        updatedAt: articles.updatedAt,
        createdAt: articles.createdAt,
        authorId: articles.authorId,
        lastEditorId: articles.lastEditorId,
      })
      .from(articles)
      .where(and(eq(articles.isActive, true), isNotNull(articles.publishedAt)))
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
        summary: articles.summary,
        summary30s: articles.summary30s,
        productCode: articles.productCode,
        contentType: articles.contentType,
        status: articles.status,
        categoryPath: articles.categoryPath,
        keywords: articles.keywords,
        publishedAt: articles.publishedAt,
        viewCount: articles.viewCount,
        helpfulYes: articles.helpfulYes,
        helpfulNo: articles.helpfulNo,
        warningCount: articles.warningCount,
        isActive: articles.isActive,
        updatedAt: articles.updatedAt,
        createdAt: articles.createdAt,
        authorId: articles.authorId,
        lastEditorId: articles.lastEditorId,
      })
      .from(articles)
      .where(and(eq(articles.isActive, true), isNotNull(articles.publishedAt)))
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
          summary: articles.summary,
          summary30s: articles.summary30s,
          productCode: articles.productCode,
          contentType: articles.contentType,
          status: articles.status,
          categoryPath: articles.categoryPath,
          keywords: articles.keywords,
          publishedAt: articles.publishedAt,
          viewCount: articles.viewCount,
          helpfulYes: articles.helpfulYes,
          helpfulNo: articles.helpfulNo,
          warningCount: articles.warningCount,
          isActive: articles.isActive,
          updatedAt: articles.updatedAt,
          createdAt: articles.createdAt,
          authorId: articles.authorId,
          lastEditorId: articles.lastEditorId,
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
        summary: articles.summary,
        summary30s: articles.summary30s,
        productCode: articles.productCode,
        contentType: articles.contentType,
        status: articles.status,
        categoryPath: articles.categoryPath,
        keywords: articles.keywords,
        publishedAt: articles.publishedAt,
        viewCount: articles.viewCount,
        helpfulYes: articles.helpfulYes,
        helpfulNo: articles.helpfulNo,
        warningCount: articles.warningCount,
        isActive: articles.isActive,
        updatedAt: articles.updatedAt,
        createdAt: articles.createdAt,
        authorId: articles.authorId,
        lastEditorId: articles.lastEditorId,
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
  /**
   * 관련도 점수 — 동의어 확장 term 기준으로 계산.
   * base(0.5) + title(2.5) + summary(1) + keywords(1) + 원본 검색어 직접 일치(1).
   * Phase 5에서 tsvector/ts_rank로 대체 예정.
   */
  score: number;
  /** 제목이 검색어(동의어 포함)와 일치하는지 — "제목 일치" 뱃지용. */
  titleMatch: boolean;
};

export async function searchArticles(
  q: string,
  options: {
    productCode?: string;
    contentType?: ArticleContentType;
    limit?: number;
  } = {},
): Promise<SearchArticleHit[]> {
  if (!db) return [];
  const query = q.trim();
  if (!query) return [];
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  try {
    // v1.1: synonyms-master로 쿼리 확장 (Plan §6, Design §11.1)
    const { expandKeywords } = await import('@/lib/services/synonym-expander');
    const expanded = await expandKeywords(query, { maxTokens: 32 });

    // 공통 필터 (키워드/벡터 양쪽 동일).
    const baseConds: SQL[] = [
      eq(articles.isActive, true),
      eq(articles.status, 'published'),
    ];
    if (options.productCode) {
      baseConds.push(eq(articles.productCode, options.productCode));
    }
    if (options.contentType) {
      baseConds.push(eq(articles.contentType, options.contentType));
    }

    // (1) 키워드 leg — keywords 배열 OR + 확장 term ILIKE (listArticles와 공유)
    const keywordConds = [...baseConds];
    const searchCond = buildArticleSearchCondition(expanded);
    if (searchCond) keywordConds.push(searchCond);
    const keywordRows = await db
      .select(ARTICLE_LIST_SELECT)
      .from(articles)
      .where(and(...keywordConds))
      .orderBy(desc(articles.publishedAt))
      .limit(limit);

    // (2) 벡터 leg — 쿼리 임베딩이 생성되면 코사인 최근접. graceful: 키 없으면 skip.
    const { embedText, toVectorLiteral } = await import('./embeddings');
    const qVec = await embedText(query);
    const vectorRows: Array<(typeof keywordRows)[number] & { sim: number }> =
      [];
    if (qVec) {
      const lit = toVectorLiteral(qVec);
      // 코사인 유사도 = 1 - 거리(<=>). 거리 오름차순 = 유사도 내림차순.
      const distance = sql<number>`(${articles.embedding} <=> ${lit}::vector)`;
      const rows = await db
        .select({ ...ARTICLE_LIST_SELECT, sim: sql<number>`1 - ${distance}` })
        .from(articles)
        .where(and(...baseConds, isNotNull(articles.embedding)))
        .orderBy(distance)
        .limit(limit);
      for (const r of rows) vectorRows.push({ ...r, sim: Number(r.sim) });
    }

    // (3) 병합 + 점수. 키워드 점수(확장 term 기준)와 벡터 유사도를 합산.
    // 동의어 결과가 0점으로 가라앉지 않도록 base(0.5) 보장.
    const { matchesAnyTerm, keywordsMatchAnyTerm } =
      await import('@/lib/text/search-match');
    const terms = expanded.length > 0 ? expanded : [query];
    const lowered = query.toLowerCase();
    /** 벡터 유사도 가중치 — sim(0~1) × 4 가 제목 일치(2.5)와 견줄 수준. */
    const VEC_WEIGHT = 4;

    function keywordScore(r: ArticleListItem): {
      score: number;
      titleMatch: boolean;
    } {
      let score = 0;
      const titleMatch = matchesAnyTerm(r.title, terms);
      if (titleMatch) score += 2.5;
      if (
        matchesAnyTerm(r.summary, terms) ||
        matchesAnyTerm(r.summary30s, terms)
      )
        score += 1;
      if (keywordsMatchAnyTerm(r.keywords, terms)) score += 1;
      // 동의어가 아닌 원본 검색어가 제목에 그대로 있으면 가산(직접 일치 우대).
      if (r.title.toLowerCase().includes(lowered)) score += 1;
      return { score, titleMatch };
    }

    const byId = new Map<string, SearchArticleHit>();
    for (const r of keywordRows) {
      const { score, titleMatch } = keywordScore(r);
      byId.set(r.id, { ...r, score: 0.5 + score, titleMatch });
    }
    for (const r of vectorRows) {
      const existing = byId.get(r.id);
      if (existing) {
        existing.score += r.sim * VEC_WEIGHT;
      } else {
        // 키워드로는 안 잡혔지만 의미적으로 가까운 글 (시맨틱 전용 hit).
        const { score, titleMatch } = keywordScore(r);
        byId.set(r.id, {
          ...r,
          score: 0.5 + score + r.sim * VEC_WEIGHT,
          titleMatch,
        });
      }
    }

    return Array.from(byId.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
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
        warningCount: articles.warningCount,
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
  /** v1.1 — 사용자 의도. 신규 작성/수정 모두 필수 권장. */
  contentType?: ArticleContentType;
  /** v1.1 — 상태. 미지정 시 draft 유지/신규 draft 생성. */
  status?: ArticleStatus;
  categoryPath?: string[] | null;
  slug: string;
  title: string;
  /** v1.1 — summary (summary30s 대체, Q-13). 둘 다 지정 시 summary 우선. */
  summary?: string | null;
  /** deprecated — Q-13에 의해 summary로 통합. 호환 유지. */
  summary30s?: string | null;
  /** v1.1 — synonyms-master 결합 검색용. */
  keywords?: string[] | null;
  /** v1.1 — 적용 범위 (Plan Q-12). null = 전체. */
  appliesTo?: ArticleAppliesTo | null;
  bodyMarkdown: string;
  /** v1.1 — slug 기반 안정 참조 (Q-14). */
  relatedSlugs?: string[] | null;
  /** deprecated — Q-14에 의해 relatedSlugs로 전환. 호환 유지. */
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
  if (!input.contentType) {
    return { ok: false, message: 'CONTENT_TYPE_REQUIRED' };
  }
  try {
    const toc = extractTocV2(input.bodyMarkdown);
    const willPublish = input.publish === true || input.status === 'published';
    // v1.5 — 발행 시 validation 워닝 수 저장 (드래프트는 0)
    let warningCount = 0;
    if (willPublish) {
      const { validateBody, validateTitle, validateSummary } =
        await import('@/lib/articles/body-validator');
      const bodyWarn = validateBody(
        input.bodyMarkdown,
        input.contentType,
      ).warnings;
      const titleWarn = validateTitle(input.title).warnings;
      const summaryWarn = validateSummary(
        input.summary ?? input.summary30s,
      ).warnings;
      warningCount = bodyWarn.length + titleWarn.length + summaryWarn.length;
      if ((input.keywords ?? []).length < 3) warningCount += 1;
      if (!input.categoryPath || input.categoryPath.length === 0)
        warningCount += 1;
    }
    // Phase 2 — 발행 시 시맨틱 검색 임베딩 생성 (graceful: 실패 시 null).
    const embedding = willPublish
      ? await generateArticleEmbedding({
          title: input.title,
          summary: input.summary,
          summary30s: input.summary30s,
          keywords: input.keywords,
          bodyMarkdown: input.bodyMarkdown,
        })
      : null;

    const values: NewArticle = {
      productCode: input.productCode,
      contentType: input.contentType,
      status: willPublish ? 'published' : 'draft',
      categoryPath: input.categoryPath ?? null,
      slug: input.slug,
      title: input.title,
      summary: input.summary ?? null,
      summary30s: input.summary30s ?? null,
      keywords: input.keywords ?? [],
      appliesTo: input.appliesTo ?? null,
      bodyMarkdown: input.bodyMarkdown,
      toc,
      relatedSlugs: input.relatedSlugs ?? [],
      relatedArticleIds: input.relatedArticleIds ?? null,
      authorId,
      lastEditorId: authorId,
      publishedAt: willPublish ? new Date() : null,
      warningCount,
      embedding,
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
  editorId?: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const toc = extractTocV2(input.bodyMarkdown);
    const patch: Partial<NewArticle> = {
      productCode: input.productCode,
      categoryPath: input.categoryPath ?? null,
      slug: input.slug,
      title: input.title,
      summary: input.summary ?? null,
      summary30s: input.summary30s ?? null,
      bodyMarkdown: input.bodyMarkdown,
      toc,
      relatedArticleIds: input.relatedArticleIds ?? null,
    };
    if (input.contentType) patch.contentType = input.contentType;
    if (input.status) patch.status = input.status;
    if (input.keywords) patch.keywords = input.keywords;
    if (input.appliesTo !== undefined) patch.appliesTo = input.appliesTo;
    if (input.relatedSlugs) patch.relatedSlugs = input.relatedSlugs;
    if (editorId) patch.lastEditorId = editorId;

    // v1.5 — 발행 상태일 때 워닝 카운트 갱신 + status/publishedAt 전환
    const willPublish = input.publish === true || input.status === 'published';
    if (willPublish && input.contentType) {
      const { validateBody, validateTitle, validateSummary } =
        await import('@/lib/articles/body-validator');
      const bodyWarn = validateBody(
        input.bodyMarkdown,
        input.contentType,
      ).warnings;
      const titleWarn = validateTitle(input.title).warnings;
      const summaryWarn = validateSummary(
        input.summary ?? input.summary30s,
      ).warnings;
      let warningCount =
        bodyWarn.length + titleWarn.length + summaryWarn.length;
      if ((input.keywords ?? []).length < 3) warningCount += 1;
      if (!input.categoryPath || input.categoryPath.length === 0)
        warningCount += 1;
      patch.warningCount = warningCount;

      // status='published'로 강제 전환 (편집 페이지 발행 버튼).
      // publishedAt은 첫 발행 시에만 새로 찍음 — 재발행 시 기존 시각 유지.
      patch.status = 'published';
      const [existing] = await db
        .select({ publishedAt: articles.publishedAt })
        .from(articles)
        .where(eq(articles.id, id))
        .limit(1);
      if (!existing?.publishedAt) {
        patch.publishedAt = new Date();
      }

      // Phase 2 — 본문/제목 변경 반영해 임베딩 재생성 (graceful).
      patch.embedding = await generateArticleEmbedding({
        title: input.title,
        summary: input.summary,
        summary30s: input.summary30s,
        keywords: input.keywords,
        bodyMarkdown: input.bodyMarkdown,
      });
    }

    await db.update(articles).set(patch).where(eq(articles.id, id));
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

/** v1.1 — 명시적 발행 (status='published', publishedAt=now, toc 재추출, lastEditorId). */
export async function publishArticleById(
  id: string,
  editorId: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const rows = await db
      .select({
        title: articles.title,
        summary: articles.summary,
        summary30s: articles.summary30s,
        keywords: articles.keywords,
        bodyMarkdown: articles.bodyMarkdown,
      })
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);
    if (rows.length === 0) {
      return { ok: false, message: 'ARTICLE_NOT_FOUND' };
    }
    const row = rows[0]!;
    const toc = extractTocV2(row.bodyMarkdown);
    // Phase 2 — 발행 시점 임베딩 생성 (graceful).
    const embedding = await generateArticleEmbedding(row);
    await db
      .update(articles)
      .set({
        status: 'published',
        publishedAt: new Date(),
        lastEditorId: editorId,
        toc,
        embedding,
      })
      .where(eq(articles.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[articles.publishArticleById] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

/** v1.1 — 명시적 비공개 (status='draft', publishedAt 보존, lastEditorId). */
export async function unpublishArticleById(
  id: string,
  editorId: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(articles)
      .set({ status: 'draft', lastEditorId: editorId })
      .where(eq(articles.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[articles.unpublishArticleById] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

/** @deprecated v1.1 — publishArticleById / unpublishArticleById 사용. */
export async function togglePublishArticleById(
  id: string,
  publish: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(articles)
      .set({
        status: publish ? 'published' : 'draft',
        publishedAt: publish ? new Date() : null,
      })
      .where(eq(articles.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[articles.togglePublishArticleById] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

/**
 * v1.1 — 새 URL `/help/[product]/[content_type]/[slug]` 조회용.
 *
 * - slug가 전역 unique이므로 product+content_type는 검증 용도
 * - 검증 실패 시 null 반환 (호출자가 404 또는 redirect 결정)
 */
export async function getArticleBySlugAndType(
  productCode: string,
  contentType: ArticleContentType,
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
      conditions.push(eq(articles.status, 'published'));
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
    if (!r) return null;
    // product/contentType 불일치 시 null (호출자가 redirect 결정)
    if (
      r.article.productCode !== productCode ||
      r.article.contentType !== contentType
    ) {
      return null;
    }
    return {
      ...r.article,
      authorName: r.authorName,
      authorEmail: r.authorEmail,
    };
  } catch (err) {
    console.error('[articles.getArticleBySlugAndType] 실패:', err);
    return null;
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
 * 자동완성용 경량 검색 (knowledge-base-overhaul A4).
 *
 * 발행된 아티클 중 title ILIKE '%q%' (또는 slug 정확 매칭) top N개.
 */
export async function searchArticlesForAutocomplete(
  q: string,
  productCode?: string,
  limit = 10,
): Promise<
  Array<{ id: string; slug: string; title: string; productCode: string }>
> {
  if (!db) return [];
  const term = q.trim();
  if (term.length < 2) return [];
  try {
    const conds = [
      eq(articles.status, 'published'),
      eq(articles.isActive, true),
      or(
        ilike(articles.title, `%${term}%`),
        eq(articles.slug, term.toLowerCase()),
      )!,
    ];
    if (productCode?.trim()) {
      conds.push(eq(articles.productCode, productCode.trim()));
    }
    const rows = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        productCode: articles.productCode,
      })
      .from(articles)
      .where(and(...conds))
      .orderBy(desc(articles.viewCount))
      .limit(limit);
    return rows;
  } catch (err) {
    console.error('[articles.searchArticlesForAutocomplete] 실패:', err);
    return [];
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
  return (
    text
      .toLowerCase()
      .replace(/[^\wㄱ-힝\s-]/g, '') // 한글 + word + 공백 + 하이픈만
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80) || `h-${Math.random().toString(36).slice(2, 8)}`
  );
}
