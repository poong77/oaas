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
import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';

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
  sortBy?: 'sort_order' | 'view_count' | 'helpful' | 'updated_at' | 'created_at';
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
    (params.sortOrder ?? (params.sortBy === 'sort_order' || !params.sortBy ? 'asc' : 'desc')) === 'asc'
      ? asc(sortColumn)
      : desc(sortColumn);

  try {
    const items = await db
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

    const totalRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(faqs)
      .where(whereExpr);
    const total = Number(totalRows[0]?.count ?? 0);

    return { items, total, page, pageSize };
  } catch (err) {
    console.error('[faqs.listFaqs] 실패:', err);
    return { items: [], total: 0, page, pageSize };
  }
}

export async function getFaqById(id: string): Promise<Faq | null> {
  if (!db) return null;
  try {
    const rows = await db.select().from(faqs).where(eq(faqs.id, id)).limit(1);
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

export type SearchFaqHit = FaqListItem & { score: number };

export async function searchFaqs(
  q: string,
  options: { productCode?: string; limit?: number } = {},
): Promise<SearchFaqHit[]> {
  if (!db) return [];
  const query = q.trim();
  if (!query) return [];
  const pattern = `%${query}%`;
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  try {
    const conditions: SQL[] = [eq(faqs.isActive, true)];
    if (options.productCode) {
      conditions.push(eq(faqs.productCode, options.productCode));
    }
    const searchCond = or(
      ilike(faqs.question, pattern),
      ilike(faqs.answerMarkdown, pattern),
    );
    if (searchCond) conditions.push(searchCond);
    const rows = await db
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
      .where(and(...conditions))
      .orderBy(asc(faqs.sortOrder), desc(faqs.createdAt))
      .limit(limit);

    const lowered = query.toLowerCase();
    return rows.map((r) => {
      let score = 0;
      if (r.question.toLowerCase().includes(lowered)) score += 2;
      if (r.answerMarkdown.toLowerCase().includes(lowered)) score += 0.5;
      return { ...r, score };
    });
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
  sortOrder?: number;
};

export async function createFaq(
  input: FaqWriteInput,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const row: NewFaq = {
      productCode: input.productCode,
      issueType: input.issueType ?? null,
      question: input.question,
      answerMarkdown: input.answerMarkdown,
      sortOrder: input.sortOrder ?? 0,
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
    await db
      .update(faqs)
      .set({
        productCode: input.productCode,
        issueType: input.issueType ?? null,
        question: input.question,
        answerMarkdown: input.answerMarkdown,
        sortOrder: input.sortOrder ?? 0,
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
      await db
        .update(faqs)
        .set({ sortOrder: newMe })
        .where(eq(faqs.id, me.id));
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
