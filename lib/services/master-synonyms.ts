/**
 * 마스터 — 동의어 사전 (synonyms-master).
 *
 * 어드민이 그룹/동의어 추가·수정·비활성. 모든 변경은 `revalidateTag('synonyms')`로
 * 검색 확장 인덱스(`loadSynonymIndex`) 캐시 무효화.
 *
 * 다국어 (Q-5/Q-6 결정):
 *   - P0: 'ko' | 'en'
 *   - P1+: 'ja' | 'zh' 추가 가능 (enum 대신 text)
 */

import 'server-only';
import { and, asc, count, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { unstable_cache, revalidateTag } from 'next/cache';

import { db } from '@/db';
import {
  termGroups,
  termSynonyms,
  type NewTermGroup,
  type NewTermSynonym,
  type TermGroup,
  type TermGroupCategory,
  type TermSynonym,
} from '@/db/schema';
import { normalizeTerm } from '@/lib/text/normalize';

const SYNONYMS_CACHE_TAG = 'synonyms';

// ─────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────

export type TermGroupWithSynonyms = TermGroup & {
  synonyms: TermSynonym[];
};

export type TermGroupListItem = TermGroup & {
  synonymCount: number;
};

export type ListTermGroupsParams = {
  category?: TermGroupCategory;
  search?: string;
  includeInactive?: boolean;
  sortBy?: 'sort_order' | 'canonical_term' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

// ─────────────────────────────────────────────────────────────────
// 조회 (어드민)
// ─────────────────────────────────────────────────────────────────

export async function listTermGroups(
  params: ListTermGroupsParams = {},
): Promise<TermGroupListItem[]> {
  if (!db) return [];
  try {
    const conditions = [];
    if (!params.includeInactive) {
      conditions.push(eq(termGroups.isActive, true));
    }
    if (params.category) {
      conditions.push(eq(termGroups.category, params.category));
    }
    if (params.search?.trim()) {
      conditions.push(ilike(termGroups.canonicalTerm, `%${params.search.trim()}%`));
    }
    const where = conditions.length === 0 ? undefined : and(...conditions);

    const sortColumn =
      params.sortBy === 'canonical_term'
        ? termGroups.canonicalTerm
        : params.sortBy === 'updated_at'
          ? termGroups.updatedAt
          : termGroups.sortOrder;
    const orderExpr =
      (params.sortOrder ?? 'asc') === 'asc'
        ? asc(sortColumn)
        : desc(sortColumn);

    // synonym count subquery
    const synonymCounts = db
      .select({
        groupId: termSynonyms.groupId,
        cnt: count().as('cnt'),
      })
      .from(termSynonyms)
      .where(eq(termSynonyms.isActive, true))
      .groupBy(termSynonyms.groupId)
      .as('sc');

    const rows = await db
      .select({
        id: termGroups.id,
        canonicalTerm: termGroups.canonicalTerm,
        category: termGroups.category,
        description: termGroups.description,
        suggestedCategoryId: termGroups.suggestedCategoryId,
        sortOrder: termGroups.sortOrder,
        isActive: termGroups.isActive,
        createdAt: termGroups.createdAt,
        updatedAt: termGroups.updatedAt,
        synonymCount: sql<number>`COALESCE(${synonymCounts.cnt}, 0)::int`,
      })
      .from(termGroups)
      .leftJoin(synonymCounts, eq(synonymCounts.groupId, termGroups.id))
      .where(where)
      .orderBy(orderExpr, asc(termGroups.canonicalTerm));

    return rows.map((r) => ({
      ...r,
      synonymCount: Number(r.synonymCount ?? 0),
    }));
  } catch (err) {
    console.error('[master-synonyms.listTermGroups] 실패:', err);
    return [];
  }
}

export async function getTermGroupById(
  id: string,
): Promise<TermGroupWithSynonyms | null> {
  if (!db) return null;
  try {
    const groupRows = await db
      .select()
      .from(termGroups)
      .where(eq(termGroups.id, id))
      .limit(1);
    const group = groupRows[0];
    if (!group) return null;

    const synonyms = await db
      .select()
      .from(termSynonyms)
      .where(and(eq(termSynonyms.groupId, id), eq(termSynonyms.isActive, true)))
      .orderBy(asc(termSynonyms.sortOrder), asc(termSynonyms.term));

    return { ...group, synonyms };
  } catch (err) {
    console.error('[master-synonyms.getTermGroupById] 실패:', err);
    return null;
  }
}

export async function getStats(): Promise<{
  totalGroups: number;
  activeGroups: number;
  totalSynonyms: number;
  largestGroupSize: number;
}> {
  if (!db) {
    return {
      totalGroups: 0,
      activeGroups: 0,
      totalSynonyms: 0,
      largestGroupSize: 0,
    };
  }
  try {
    const [gAll, gActive, sActive, maxRow] = await Promise.all([
      db.select({ c: count() }).from(termGroups),
      db
        .select({ c: count() })
        .from(termGroups)
        .where(eq(termGroups.isActive, true)),
      db
        .select({ c: count() })
        .from(termSynonyms)
        .where(eq(termSynonyms.isActive, true)),
      db
        .select({
          c: sql<number>`COUNT(*)::int`,
        })
        .from(termSynonyms)
        .where(eq(termSynonyms.isActive, true))
        .groupBy(termSynonyms.groupId)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(1),
    ]);

    return {
      totalGroups: Number(gAll[0]?.c ?? 0),
      activeGroups: Number(gActive[0]?.c ?? 0),
      totalSynonyms: Number(sActive[0]?.c ?? 0),
      largestGroupSize: Number(maxRow[0]?.c ?? 0),
    };
  } catch (err) {
    console.error('[master-synonyms.getStats] 실패:', err);
    return {
      totalGroups: 0,
      activeGroups: 0,
      totalSynonyms: 0,
      largestGroupSize: 0,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// 검색 인덱스 (Q-4: 메모리 캐시 5분)
// ─────────────────────────────────────────────────────────────────

export type SynonymIndex = {
  /** normalize(term) → 그룹 ID set */
  termToGroupIds: Map<string, Set<string>>;
  /** 그룹 ID → 해당 그룹의 [canonical, ...synonyms] (검색 확장용 원본 보존) */
  groupIdToTerms: Map<string, string[]>;
  /** 그룹 ID → 추천 카테고리 ID (P1 category-suggester 용도) */
  groupIdToSuggestedCategoryId: Map<string, string>;
};

/**
 * 활성 그룹+동의어 전체를 메모리 인덱스로 로딩.
 *
 * - unstable_cache 5분 TTL
 * - revalidateTag('synonyms')로 즉시 무효화 가능 (변경 액션에서 호출)
 * - 그룹 비활성이면 동의어 무시
 */
/**
 * 캐시 내부 — Map/Set 직렬화 불가능. Next 16 unstable_cache는 plain object로 변환하여
 * `.get is not a function` throw 유발. 따라서 raw rows만 캐싱하고 함수 호출 시점에 Map 구성.
 */
type _SynonymIndexRaw = {
  groups: Array<{ id: string; canonicalTerm: string; suggestedCategoryId: string | null }>;
  synonyms: Array<{ groupId: string; term: string }>;
};

const _loadSynonymRaw = unstable_cache(
  async (): Promise<_SynonymIndexRaw> => {
    if (!db) return { groups: [], synonyms: [] };
    try {
      const groups = await db
        .select({
          id: termGroups.id,
          canonicalTerm: termGroups.canonicalTerm,
          suggestedCategoryId: termGroups.suggestedCategoryId,
        })
        .from(termGroups)
        .where(eq(termGroups.isActive, true));
      const synonyms = await db
        .select({
          groupId: termSynonyms.groupId,
          term: termSynonyms.term,
        })
        .from(termSynonyms)
        .where(eq(termSynonyms.isActive, true));
      return { groups, synonyms };
    } catch (err) {
      console.error('[master-synonyms._loadSynonymRaw] 실패:', err);
      return { groups: [], synonyms: [] };
    }
  },
  ['synonym-index:v2-raw'],
  { revalidate: 300, tags: [SYNONYMS_CACHE_TAG] },
);

export async function loadSynonymIndex(): Promise<SynonymIndex> {
  const { groups, synonyms } = await _loadSynonymRaw();
  const termToGroupIds = new Map<string, Set<string>>();
  const groupIdToTerms = new Map<string, string[]>();
  const groupIdToSuggestedCategoryId = new Map<string, string>();

  const activeGroupIds = new Set(groups.map((g) => g.id));
  for (const g of groups) {
    groupIdToTerms.set(g.id, [g.canonicalTerm]);
    if (g.suggestedCategoryId) {
      groupIdToSuggestedCategoryId.set(g.id, g.suggestedCategoryId);
    }
    const key = normalizeTerm(g.canonicalTerm);
    if (!termToGroupIds.has(key)) termToGroupIds.set(key, new Set());
    termToGroupIds.get(key)!.add(g.id);
  }
  for (const s of synonyms) {
    if (!activeGroupIds.has(s.groupId)) continue;
    const arr = groupIdToTerms.get(s.groupId);
    if (!arr) continue;
    arr.push(s.term);
    const key = normalizeTerm(s.term);
    if (!termToGroupIds.has(key)) termToGroupIds.set(key, new Set());
    termToGroupIds.get(key)!.add(s.groupId);
  }
  return { termToGroupIds, groupIdToTerms, groupIdToSuggestedCategoryId };
}

// 이하 원본 unstable_cache 블록은 위 _loadSynonymRaw + loadSynonymIndex로 대체됨.
// 아래 deprecated 블록은 빌드 시 dead code (호출되지 않음) — 호환 유지용 stub.
const _deprecatedLoadSynonymIndex = unstable_cache(
  async (): Promise<SynonymIndex> => {
    const termToGroupIds = new Map<string, Set<string>>();
    const groupIdToTerms = new Map<string, string[]>();
    const groupIdToSuggestedCategoryId = new Map<string, string>();

    if (!db) {
      return { termToGroupIds, groupIdToTerms, groupIdToSuggestedCategoryId };
    }

    try {
      const groups = await db
        .select({
          id: termGroups.id,
          canonicalTerm: termGroups.canonicalTerm,
          suggestedCategoryId: termGroups.suggestedCategoryId,
        })
        .from(termGroups)
        .where(eq(termGroups.isActive, true));

      const synonyms = await db
        .select({
          groupId: termSynonyms.groupId,
          term: termSynonyms.term,
        })
        .from(termSynonyms)
        .where(eq(termSynonyms.isActive, true));

      const activeGroupIds = new Set(groups.map((g) => g.id));

      for (const g of groups) {
        groupIdToTerms.set(g.id, [g.canonicalTerm]);
        if (g.suggestedCategoryId) {
          groupIdToSuggestedCategoryId.set(g.id, g.suggestedCategoryId);
        }
        const key = normalizeTerm(g.canonicalTerm);
        if (!termToGroupIds.has(key)) {
          termToGroupIds.set(key, new Set());
        }
        termToGroupIds.get(key)!.add(g.id);
      }

      for (const s of synonyms) {
        if (!activeGroupIds.has(s.groupId)) continue;
        const arr = groupIdToTerms.get(s.groupId);
        if (!arr) continue;
        arr.push(s.term);
        const key = normalizeTerm(s.term);
        if (!termToGroupIds.has(key)) {
          termToGroupIds.set(key, new Set());
        }
        termToGroupIds.get(key)!.add(s.groupId);
      }
    } catch (err) {
      console.error('[master-synonyms.loadSynonymIndex] 실패:', err);
    }

    return { termToGroupIds, groupIdToTerms, groupIdToSuggestedCategoryId };
  },
  ['synonym-index:v1'],
  { revalidate: 300, tags: [SYNONYMS_CACHE_TAG] },
);

// ─────────────────────────────────────────────────────────────────
// 변경 (어드민)
// ─────────────────────────────────────────────────────────────────

export type CreateTermGroupInput = Pick<
  NewTermGroup,
  | 'canonicalTerm'
  | 'category'
  | 'description'
  | 'suggestedCategoryId'
  | 'sortOrder'
>;

export type UpdateTermGroupInput = Partial<CreateTermGroupInput> & {
  isActive?: boolean;
};

export async function createTermGroup(
  input: CreateTermGroupInput,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const [row] = await db
      .insert(termGroups)
      .values({
        canonicalTerm: input.canonicalTerm.trim(),
        category: input.category,
        description: input.description?.trim() || null,
        suggestedCategoryId: input.suggestedCategoryId?.trim() || null,
        sortOrder: input.sortOrder ?? 100,
      })
      .returning({ id: termGroups.id });
    revalidateTag(SYNONYMS_CACHE_TAG, "default");
    return { ok: true, id: row!.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'INTERNAL_ERROR';
    if (msg.includes('term_groups_canonical_uq')) {
      return { ok: false, message: 'DUPLICATE_CANONICAL' };
    }
    console.error('[master-synonyms.createTermGroup] 실패:', err);
    return { ok: false, message: msg };
  }
}

export async function updateTermGroup(
  id: string,
  patch: UpdateTermGroupInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const update: Partial<NewTermGroup> & { isActive?: boolean } = {};
    if (patch.canonicalTerm !== undefined) {
      update.canonicalTerm = patch.canonicalTerm.trim();
    }
    if (patch.category !== undefined) update.category = patch.category;
    if (patch.description !== undefined) {
      update.description = patch.description?.trim() || null;
    }
    if (patch.suggestedCategoryId !== undefined) {
      update.suggestedCategoryId = patch.suggestedCategoryId?.trim() || null;
    }
    if (patch.sortOrder !== undefined) update.sortOrder = patch.sortOrder;
    if (patch.isActive !== undefined) update.isActive = patch.isActive;

    await db.update(termGroups).set(update).where(eq(termGroups.id, id));
    revalidateTag(SYNONYMS_CACHE_TAG, "default");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'INTERNAL_ERROR';
    if (msg.includes('term_groups_canonical_uq')) {
      return { ok: false, message: 'DUPLICATE_CANONICAL' };
    }
    console.error('[master-synonyms.updateTermGroup] 실패:', err);
    return { ok: false, message: msg };
  }
}

/** soft delete. */
export async function deactivateTermGroup(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(termGroups)
      .set({ isActive: false })
      .where(eq(termGroups.id, id));
    revalidateTag(SYNONYMS_CACHE_TAG, "default");
    return { ok: true };
  } catch (err) {
    console.error('[master-synonyms.deactivateTermGroup] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function restoreTermGroup(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(termGroups)
      .set({ isActive: true })
      .where(eq(termGroups.id, id));
    revalidateTag(SYNONYMS_CACHE_TAG, "default");
    return { ok: true };
  } catch (err) {
    console.error('[master-synonyms.restoreTermGroup] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

// ─── 동의어 ──────────────────────────────────────────────────────

export type AddSynonymInput = {
  groupId: string;
  term: string;
  language?: 'ko' | 'en';
  weight?: number;
};

export async function addSynonym(
  input: AddSynonymInput,
): Promise<
  | { ok: true; synonym: TermSynonym }
  | { ok: false; message: 'DUPLICATE_IN_GROUP' | 'GROUP_NOT_FOUND' | 'INTERNAL_ERROR' | 'DB_NOT_READY' }
> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const term = input.term.trim();
    if (!term) return { ok: false, message: 'INTERNAL_ERROR' };

    // 그룹 존재 확인
    const groupRows = await db
      .select({ id: termGroups.id })
      .from(termGroups)
      .where(eq(termGroups.id, input.groupId))
      .limit(1);
    if (groupRows.length === 0) {
      return { ok: false, message: 'GROUP_NOT_FOUND' };
    }

    // 다음 sort_order
    const maxRow = await db
      .select({
        max: sql<number>`COALESCE(MAX(${termSynonyms.sortOrder}), 0)::int`,
      })
      .from(termSynonyms)
      .where(eq(termSynonyms.groupId, input.groupId));
    const nextOrder = Number(maxRow[0]?.max ?? 0) + 10;

    const [row] = await db
      .insert(termSynonyms)
      .values({
        groupId: input.groupId,
        term,
        language: input.language ?? 'ko',
        weight: input.weight ?? 5,
        sortOrder: nextOrder,
      })
      .returning();
    revalidateTag(SYNONYMS_CACHE_TAG, "default");
    return { ok: true, synonym: row! };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'INTERNAL_ERROR';
    if (msg.includes('term_synonyms_group_term_uq')) {
      return { ok: false, message: 'DUPLICATE_IN_GROUP' };
    }
    console.error('[master-synonyms.addSynonym] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

/** soft delete. */
export async function removeSynonym(
  synonymId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(termSynonyms)
      .set({ isActive: false })
      .where(eq(termSynonyms.id, synonymId));
    revalidateTag(SYNONYMS_CACHE_TAG, "default");
    return { ok: true };
  } catch (err) {
    console.error('[master-synonyms.removeSynonym] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function reorderSynonyms(
  groupId: string,
  ordering: { id: string; sortOrder: number }[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    for (const o of ordering) {
      await db
        .update(termSynonyms)
        .set({ sortOrder: o.sortOrder })
        .where(
          and(eq(termSynonyms.id, o.id), eq(termSynonyms.groupId, groupId)),
        );
    }
    revalidateTag(SYNONYMS_CACHE_TAG, "default");
    return { ok: true };
  } catch (err) {
    console.error('[master-synonyms.reorderSynonyms] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

/**
 * 다의어 충돌 감지 — 같은 term이 다른 그룹에 존재하는지 확인 (어드민 UI 경고용).
 *
 * @returns 다른 그룹에 존재하면 해당 그룹의 canonical 배열, 없으면 빈 배열
 */
export async function findConflictingGroups(
  term: string,
  excludeGroupId?: string,
): Promise<{ groupId: string; canonicalTerm: string }[]> {
  if (!db) return [];
  try {
    const trimmed = term.trim();
    if (!trimmed) return [];
    const synonymHits = await db
      .select({
        groupId: termSynonyms.groupId,
      })
      .from(termSynonyms)
      .where(
        and(
          eq(termSynonyms.term, trimmed),
          eq(termSynonyms.isActive, true),
        ),
      );
    const groupIds = Array.from(new Set(synonymHits.map((r) => r.groupId)));
    if (groupIds.length === 0) return [];
    const rows = await db
      .select({
        groupId: termGroups.id,
        canonicalTerm: termGroups.canonicalTerm,
      })
      .from(termGroups)
      .where(
        and(
          inArray(termGroups.id, groupIds),
          eq(termGroups.isActive, true),
        ),
      );
    return rows
      .filter((r) => r.groupId !== excludeGroupId)
      .map((r) => ({ groupId: r.groupId, canonicalTerm: r.canonicalTerm }));
  } catch (err) {
    console.error('[master-synonyms.findConflictingGroups] 실패:', err);
    return [];
  }
}
