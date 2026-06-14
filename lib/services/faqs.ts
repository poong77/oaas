/**
 * faqs 데이터 액세스 (Server 전용) — Phase 4 SF-01, SF-04.
 *
 * - listFaqs: 공개·어드민 공용. (publishedOnly 개념 없음 — is_active 기준만)
 * - getFaqById, getFaqsBySearch
 * - incrementFaqView (fire-and-forget)
 * - recordFaqHelpful (단순 counter +1, 1회 제약은 localStorage에서)
 * - 어드민 CRUD + 정렬순 이동
 */

import 'server-only';
import {
  and,
  arrayOverlaps,
  asc,
  desc,
  eq,
  ilike,
  isNotNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

import { db } from '@/db';
import { faqs, type Faq, type NewFaq } from '@/db/schema';

export type FaqListItem = Pick<
  Faq,
  | 'id'
  | 'productCode'
  | 'issueType'
  | 'question'
  | 'answerMarkdown'
  | 'sortOrder'
  | 'viewCount'
  | 'helpfulYes'
  | 'helpfulNo'
  | 'isActive'
  | 'createdAt'
  | 'updatedAt'
>;

export type ListFaqsParams = {
  productCode?: string;
  issueType?: string;
  q?: string;
  isActive?: boolean | 'all';
  sortBy?:
    | 'sort_order'
    | 'view_count'
    | 'helpful'
    | 'updated_at'
    | 'created_at';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
};

export type ListFaqsResult = {
  items: FaqListItem[];
  total: number;
  page: number;
  pageSize: number;
};

// ─────────────────────────────────────────────────────────────────────
// 조회
// ─────────────────────────────────────────────────────────────────────

export async function listFaqs(
  params: ListFaqsParams = {},
): Promise<ListFaqsResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  if (!db) return { items: [], total: 0, page, pageSize };

  const conditions: SQL[] = [];
  if (params.isActive !== 'all') {
    conditions.push(eq(faqs.isActive, params.isActive ?? true));
  }
  if (params.productCode) {
    conditions.push(eq(faqs.productCode, params.productCode));
  }
  if (params.issueType) {
    conditions.push(eq(faqs.issueType, params.issueType));
  }
  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    const search = or(
      ilike(faqs.question, pattern),
      ilike(faqs.answerMarkdown, pattern),
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
      ? faqs.viewCount
      : params.sortBy === 'helpful'
        ? faqs.helpfulYes
        : params.sortBy === 'updated_at'
          ? faqs.updatedAt
          : params.sortBy === 'created_at'
            ? faqs.createdAt
            : faqs.sortOrder;
  const orderExpr =
    (params.sortOrder ??
      (params.sortBy === 'sort_order' || !params.sortBy ? 'asc' : 'desc')) ===
    'asc'
      ? asc(sortColumn)
      : desc(sortColumn);

  try {
    // 본조회와 count(독립) 병렬 실행
    const itemsPromise = db
      .select({
        id: faqs.id,
        productCode: faqs.productCode,
        issueType: faqs.issueType,
        question: faqs.question,
        answerMarkdown: faqs.answerMarkdown,
        sortOrder: faqs.sortOrder,
        viewCount: faqs.viewCount,
        helpfulYes: faqs.helpfulYes,
        helpfulNo: faqs.helpfulNo,
        isActive: faqs.isActive,
        createdAt: faqs.createdAt,
        updatedAt: faqs.updatedAt,
      })
      .from(faqs)
      .where(whereExpr)
      .orderBy(orderExpr, desc(faqs.createdAt))
      .limit(pageSize)
      .offset(offset);

    const totalPromise = db
      .select({ count: sql<number>`count(*)::int` })
      .from(faqs)
      .where(whereExpr);

    const [items, totalRows] = await Promise.all([itemsPromise, totalPromise]);
    const total = Number(totalRows[0]?.count ?? 0);

    return { items, total, page, pageSize };
  } catch (err) {
    console.error('[faqs.listFaqs] 실패:', err);
    return { items: [], total: 0, page, pageSize };
  }
}

/**
 * 현재 콘텐츠 필터(q/product/issueType)의 전체 카운트 — 어드민 통계 카드용.
 * isActive 필터는 적용하지 않고 활성/비활성으로 분리해 total = active + inactive 보장.
 */
export type FaqStatusCounts = {
  total: number;
  active: number;
  inactive: number;
};

export async function getFaqCounts(
  params: Pick<ListFaqsParams, 'productCode' | 'issueType' | 'q'> = {},
): Promise<FaqStatusCounts> {
  if (!db) return { total: 0, active: 0, inactive: 0 };

  const conditions: SQL[] = [];
  if (params.productCode) {
    conditions.push(eq(faqs.productCode, params.productCode));
  }
  if (params.issueType) {
    conditions.push(eq(faqs.issueType, params.issueType));
  }
  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    const search = or(
      ilike(faqs.question, pattern),
      ilike(faqs.answerMarkdown, pattern),
    );
    if (search) conditions.push(search);
  }

  const whereExpr =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

  try {
    const rows = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${faqs.isActive} = true)::int`,
        inactive: sql<number>`count(*) filter (where ${faqs.isActive} = false)::int`,
      })
      .from(faqs)
      .where(whereExpr);
    const r = rows[0];
    return {
      total: Number(r?.total ?? 0),
      active: Number(r?.active ?? 0),
      inactive: Number(r?.inactive ?? 0),
    };
  } catch (err) {
    console.error('[faqs.getFaqCounts] 실패:', err);
    return { total: 0, active: 0, inactive: 0 };
  }
}

export async function getFaqById(
  id: string,
): Promise<Omit<Faq, 'embedding'> | null> {
  if (!db) return null;
  try {
    // embedding(1536-float)은 편집/조회에 불필요 — 명시 select로 페이로드 절감.
    const rows = await db
      .select({
        id: faqs.id,
        productCode: faqs.productCode,
        issueType: faqs.issueType,
        question: faqs.question,
        answerMarkdown: faqs.answerMarkdown,
        keywords: faqs.keywords,
        sortOrder: faqs.sortOrder,
        viewCount: faqs.viewCount,
        helpfulYes: faqs.helpfulYes,
        helpfulNo: faqs.helpfulNo,
        isActive: faqs.isActive,
        createdAt: faqs.createdAt,
        updatedAt: faqs.updatedAt,
      })
      .from(faqs)
      .where(eq(faqs.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[faqs.getFaqById] 실패:', err);
    return null;
  }
}

/** 인기 FAQ — 조회수 상위 (홈 위젯 작은 보강용). */
export async function listPopularFaqs(limit = 3): Promise<FaqListItem[]> {
  if (!db) return [];
  try {
    return await db
      .select({
        id: faqs.id,
        productCode: faqs.productCode,
        issueType: faqs.issueType,
        question: faqs.question,
        answerMarkdown: faqs.answerMarkdown,
        sortOrder: faqs.sortOrder,
        viewCount: faqs.viewCount,
        helpfulYes: faqs.helpfulYes,
        helpfulNo: faqs.helpfulNo,
        isActive: faqs.isActive,
        createdAt: faqs.createdAt,
        updatedAt: faqs.updatedAt,
      })
      .from(faqs)
      .where(eq(faqs.isActive, true))
      .orderBy(desc(faqs.viewCount), desc(faqs.helpfulYes))
      .limit(limit);
  } catch (err) {
    console.error('[faqs.listPopularFaqs] 실패:', err);
    return [];
  }
}

export type SearchFaqHit = FaqListItem & {
  score: number;
  /** 질문이 검색어(동의어 포함)와 일치하는지 — "질문 일치" 뱃지용. */
  questionMatch: boolean;
  /** v1.7 — 검색 키워드(랭킹·디버그용). UI 노출은 선택. */
  keywords: string[];
};

export async function searchFaqs(
  q: string,
  options: { productCode?: string; limit?: number } = {},
): Promise<SearchFaqHit[]> {
  if (!db) return [];
  const query = q.trim();
  if (!query) return [];
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  try {
    // v1.6 — articles와 동일하게 동의어 확장 적용 (통합검색 일관성).
    // 이전: 원본 검색어 ILIKE만 → "CI"로 "체크인" FAQ를 못 찾음.
    const { expandKeywords } = await import('./synonym-expander');
    const expanded = await expandKeywords(query, { maxTokens: 32 });
    const terms = expanded.length > 0 ? expanded : [query];

    // 공통 필터 (키워드/벡터 leg 동일).
    const baseConds: SQL[] = [eq(faqs.isActive, true)];
    if (options.productCode) {
      baseConds.push(eq(faqs.productCode, options.productCode));
    }

    const SELECT = {
      id: faqs.id,
      productCode: faqs.productCode,
      issueType: faqs.issueType,
      question: faqs.question,
      answerMarkdown: faqs.answerMarkdown,
      keywords: faqs.keywords,
      sortOrder: faqs.sortOrder,
      viewCount: faqs.viewCount,
      helpfulYes: faqs.helpfulYes,
      helpfulNo: faqs.helpfulNo,
      isActive: faqs.isActive,
      createdAt: faqs.createdAt,
      updatedAt: faqs.updatedAt,
    } as const;

    // (1) 키워드 leg — articles.buildArticleSearchCondition와 동일 패턴.
    //   keywords 배열 GIN 매칭(정확 일치) + 확장 term ILIKE(question/answer).
    // v1.7 정렬 버그 수정: sort_order로 자른 뒤 점수 매기던 것을 → 후보 전체
    // (FAQ는 소량) fetch 후 score 정렬→limit으로 변경.
    const CANDIDATE_CAP = 200;
    const orParts: SQL[] = [arrayOverlaps(faqs.keywords, terms)];
    for (const term of terms) {
      const p = `%${term}%`;
      const c = or(ilike(faqs.question, p), ilike(faqs.answerMarkdown, p));
      if (c) orParts.push(c);
    }
    const searchCond = orParts.length === 1 ? orParts[0] : or(...orParts);
    const keywordConds = searchCond ? [...baseConds, searchCond] : baseConds;
    const keywordRows = await db
      .select(SELECT)
      .from(faqs)
      .where(and(...keywordConds))
      .orderBy(asc(faqs.sortOrder), desc(faqs.createdAt))
      .limit(CANDIDATE_CAP);

    // (2) 벡터 leg — 쿼리 임베딩이 생성되면 코사인 최근접. graceful: 키 없으면 skip.
    const { embedText, toVectorLiteral } = await import('./embeddings');
    const qVec = await embedText(query);
    const vectorRows: Array<(typeof keywordRows)[number] & { sim: number }> = [];
    if (qVec) {
      const lit = toVectorLiteral(qVec);
      const distance = sql<number>`(${faqs.embedding} <=> ${lit}::vector)`;
      const rows = await db
        .select({ ...SELECT, sim: sql<number>`1 - ${distance}` })
        .from(faqs)
        .where(and(...baseConds, isNotNull(faqs.embedding)))
        .orderBy(distance)
        .limit(limit);
      for (const r of rows) vectorRows.push({ ...r, sim: Number(r.sim) });
    }

    // (3) 병합 + 점수. 키워드 점수(확장 term 기준) + 벡터 유사도×4 (articles와 동일).
    const { matchesAnyTerm, keywordsMatchAnyTerm } = await import(
      '@/lib/text/search-match'
    );
    const lowered = query.toLowerCase();
    /** 벡터 유사도 가중치 — sim(0~1)×4 가 질문 일치(2.5)와 견줄 수준. */
    const VEC_WEIGHT = 4;

    type FaqRow = (typeof keywordRows)[number];
    function scoreRow(r: FaqRow): { score: number; questionMatch: boolean } {
      // 관련도 (articles 골격): question + answer + keywords + 원본 직접일치
      let score = 0;
      const questionMatch = matchesAnyTerm(r.question, terms);
      if (questionMatch) score += 2.5;
      if (matchesAnyTerm(r.answerMarkdown, terms)) score += 1;
      if (keywordsMatchAnyTerm(r.keywords, terms)) score += 1;
      if (r.question.toLowerCase().includes(lowered)) score += 1;
      // 인기·유용도 가중 (관련도보다 작게 — 동점 보정 수준).
      score += Math.min(0.8, Math.log10(1 + Math.max(0, r.viewCount)) * 0.4);
      const helpfulTotal = r.helpfulYes + r.helpfulNo;
      if (helpfulTotal >= 3) score += (r.helpfulYes / helpfulTotal) * 0.6;
      return { score, questionMatch };
    }

    const byId = new Map<string, SearchFaqHit>();
    for (const r of keywordRows) {
      const { score, questionMatch } = scoreRow(r);
      byId.set(r.id, { ...r, score: 0.5 + score, questionMatch });
    }
    for (const r of vectorRows) {
      const existing = byId.get(r.id);
      if (existing) {
        existing.score += r.sim * VEC_WEIGHT;
      } else {
        // 키워드로는 안 잡혔지만 의미적으로 가까운 FAQ (시맨틱 전용 hit).
        const { score, questionMatch } = scoreRow(r);
        byId.set(r.id, {
          ...r,
          score: 0.5 + score + r.sim * VEC_WEIGHT,
          questionMatch,
        });
      }
    }

    return Array.from(byId.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (err) {
    console.error('[faqs.searchFaqs] 실패:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// 카운터
// ─────────────────────────────────────────────────────────────────────

/** 펼침 시 fire-and-forget 호출. 실패 무시. */
export function incrementFaqView(faqId: string): void {
  if (!db) return;
  Promise.resolve()
    .then(async () => {
      await db!
        .update(faqs)
        .set({ viewCount: sql`${faqs.viewCount} + 1` })
        .where(eq(faqs.id, faqId));
    })
    .catch((err) => {
      console.warn(
        `[faqs.incrementFaqView] faqId=${faqId} 실패:`,
        err instanceof Error ? err.message : err,
      );
    });
}

export async function recordFaqHelpful(
  faqId: string,
  helpful: boolean,
): Promise<{ ok: boolean; helpfulYes?: number; helpfulNo?: number }> {
  if (!db) return { ok: false };
  try {
    if (helpful) {
      await db
        .update(faqs)
        .set({ helpfulYes: sql`${faqs.helpfulYes} + 1` })
        .where(and(eq(faqs.id, faqId), eq(faqs.isActive, true)));
    } else {
      await db
        .update(faqs)
        .set({ helpfulNo: sql`${faqs.helpfulNo} + 1` })
        .where(and(eq(faqs.id, faqId), eq(faqs.isActive, true)));
    }
    const after = await db
      .select({ helpfulYes: faqs.helpfulYes, helpfulNo: faqs.helpfulNo })
      .from(faqs)
      .where(eq(faqs.id, faqId))
      .limit(1);
    return {
      ok: true,
      helpfulYes: after[0]?.helpfulYes ?? 0,
      helpfulNo: after[0]?.helpfulNo ?? 0,
    };
  } catch (err) {
    console.error('[faqs.recordFaqHelpful] 실패:', err);
    return { ok: false };
  }
}

// ─────────────────────────────────────────────────────────────────────
// 어드민 CRUD
// ─────────────────────────────────────────────────────────────────────

export type FaqWriteInput = {
  productCode: string;
  issueType?: string | null;
  question: string;
  answerMarkdown: string;
  /** v1.7 — 검색 보강 키워드. trim·중복제거·공백제거 후 저장. */
  keywords?: string[] | null;
  sortOrder?: number;
};

/**
 * v1.7 — FAQ 시맨틱 검색 임베딩 생성.
 * graceful: OPENAI_API_KEY 미설정/오류 시 null → 임베딩 없이 저장.
 */
async function generateFaqEmbedding(f: {
  question: string;
  keywords?: string[] | null;
  answerMarkdown?: string | null;
}): Promise<number[] | null> {
  const { embedText, buildFaqEmbeddingInput } = await import('./embeddings');
  return embedText(buildFaqEmbeddingInput(f));
}

/** keywords 정규화 — trim, 빈값 제거, 중복 제거(최대 30개). */
function normalizeFaqKeywords(input?: string[] | null): string[] {
  if (!input || input.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const k = (raw ?? '').trim();
    if (!k) continue;
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k.slice(0, 60));
    if (out.length >= 30) break;
  }
  return out;
}

export async function createFaq(
  input: FaqWriteInput,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const keywords = normalizeFaqKeywords(input.keywords);
    const embedding = await generateFaqEmbedding({
      question: input.question,
      keywords,
      answerMarkdown: input.answerMarkdown,
    });
    const row: NewFaq = {
      productCode: input.productCode,
      issueType: input.issueType ?? null,
      question: input.question,
      answerMarkdown: input.answerMarkdown,
      keywords,
      sortOrder: input.sortOrder ?? 0,
      embedding,
    };
    const [created] = await db
      .insert(faqs)
      .values(row)
      .returning({ id: faqs.id });
    return { ok: true, id: created?.id };
  } catch (err) {
    console.error('[faqs.createFaq] 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

export async function updateFaqById(
  id: string,
  input: FaqWriteInput,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const keywords = normalizeFaqKeywords(input.keywords);
    const embedding = await generateFaqEmbedding({
      question: input.question,
      keywords,
      answerMarkdown: input.answerMarkdown,
    });
    await db
      .update(faqs)
      .set({
        productCode: input.productCode,
        issueType: input.issueType ?? null,
        question: input.question,
        answerMarkdown: input.answerMarkdown,
        keywords,
        sortOrder: input.sortOrder ?? 0,
        embedding,
      })
      .where(eq(faqs.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[faqs.updateFaqById] 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

export async function archiveFaqById(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db.update(faqs).set({ isActive: false }).where(eq(faqs.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[faqs.archiveFaqById] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function restoreFaqById(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db.update(faqs).set({ isActive: true }).where(eq(faqs.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[faqs.restoreFaqById] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

/**
 * 정렬순 직접 이동. 인접한 항목과 sort_order swap (단일 productCode 내).
 * 비활성 항목은 제외하고 인접한 활성 항목과만 swap.
 *
 * direction: 'up' = sort_order 작은 쪽 (앞으로), 'down' = 큰 쪽 (뒤로)
 */
export async function moveFaqOrder(
  id: string,
  direction: 'up' | 'down',
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const current = await db
      .select({
        id: faqs.id,
        productCode: faqs.productCode,
        sortOrder: faqs.sortOrder,
      })
      .from(faqs)
      .where(eq(faqs.id, id))
      .limit(1);
    if (current.length === 0) return { ok: false, message: 'NOT_FOUND' };
    const me = current[0]!;

    // 인접 항목 조회
    const neighborCond =
      direction === 'up'
        ? sql`${faqs.sortOrder} < ${me.sortOrder}`
        : sql`${faqs.sortOrder} > ${me.sortOrder}`;
    const orderBy =
      direction === 'up' ? desc(faqs.sortOrder) : asc(faqs.sortOrder);
    const neighbors = await db
      .select({ id: faqs.id, sortOrder: faqs.sortOrder })
      .from(faqs)
      .where(
        and(
          eq(faqs.productCode, me.productCode),
          eq(faqs.isActive, true),
          neighborCond,
        ),
      )
      .orderBy(orderBy)
      .limit(1);

    if (neighbors.length === 0) {
      return { ok: false, message: 'NO_NEIGHBOR' };
    }
    const neighbor = neighbors[0]!;

    // 두 row를 swap (값이 같으면 +1/-1로 분기시킨다)
    if (neighbor.sortOrder === me.sortOrder) {
      // tie-break — 양쪽을 살짝 분리
      const newMe = direction === 'up' ? me.sortOrder - 1 : me.sortOrder + 1;
      const newNeighbor =
        direction === 'up' ? neighbor.sortOrder + 1 : neighbor.sortOrder - 1;
      await db.update(faqs).set({ sortOrder: newMe }).where(eq(faqs.id, me.id));
      await db
        .update(faqs)
        .set({ sortOrder: newNeighbor })
        .where(eq(faqs.id, neighbor.id));
    } else {
      // 일반 swap
      await db
        .update(faqs)
        .set({ sortOrder: neighbor.sortOrder })
        .where(eq(faqs.id, me.id));
      await db
        .update(faqs)
        .set({ sortOrder: me.sortOrder })
        .where(eq(faqs.id, neighbor.id));
    }

    return { ok: true };
  } catch (err) {
    console.error('[faqs.moveFaqOrder] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

/**
 * 역할별 시작 매퍼용 — 활성 FAQ 자동완성 (질문 부분일치).
 * articles.searchArticlesForAutocomplete와 동일 정책.
 */
export async function searchFaqsForAutocomplete(
  q: string,
  productCode?: string,
  limit = 10,
): Promise<
  Array<{
    id: string;
    question: string;
    productCode: string;
    issueType: string | null;
  }>
> {
  if (!db) return [];
  const term = q.trim();
  if (term.length < 2) return [];
  try {
    const conds: SQL[] = [
      eq(faqs.isActive, true),
      ilike(faqs.question, `%${term}%`),
    ];
    if (productCode?.trim()) {
      conds.push(eq(faqs.productCode, productCode.trim()));
    }
    const rows = await db
      .select({
        id: faqs.id,
        question: faqs.question,
        productCode: faqs.productCode,
        issueType: faqs.issueType,
      })
      .from(faqs)
      .where(and(...conds))
      .orderBy(desc(faqs.viewCount))
      .limit(limit);
    return rows;
  } catch (err) {
    console.error('[faqs.searchFaqsForAutocomplete] 실패:', err);
    return [];
  }
}
