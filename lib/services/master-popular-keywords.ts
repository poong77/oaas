/**
 * 마스터 — popular_keywords (SS-04, 인기검색어 하이브리드 큐레이션).
 *
 * 어드민은 pin(고정)/block(제외)만 관리. 평상시 노출은 search_logs 자동집계.
 *   - resolvePopularKeywords(): 홈/검색 노출용 — pin + auto(block 제외) 병합 (1h 캐시)
 *   - list/get/create/update/setActive: 어드민 편집용 (항상 최신)
 *
 * DB row 0건 또는 auto 0건이면 _constants.ts 하드코딩 fallback.
 */

import 'server-only';
import { unstable_cache } from 'next/cache';
import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import {
  popularKeywords,
  type NewPopularKeyword,
  type PopularKeyword,
  type PopularKeywordKind,
} from '@/db/schema';
import { normalizeTerm } from '@/lib/text/normalize';
import { topQueries } from '@/lib/services/search-logs';
import { POPULAR_KEYWORDS } from '@/app/_components/home/_constants';

/**
 * 홈/검색 노출 인기검색어 캐시 태그.
 * 어드민 pin/block 편집 시 master-actions에서 revalidateTag(tag, 'default').
 */
export const POPULAR_KEYWORDS_CACHE_TAG = 'master:popular-keywords';

/** 노출 칩 최대 개수. */
const DISPLAY_LIMIT = 6;
/** 자동집계 윈도우(일). */
const AUTO_WINDOW_DAYS = 30;

// ─────────────────────────────────────────────────────────────────────
// 어드민 편집 (항상 최신)
// ─────────────────────────────────────────────────────────────────────

export async function listPopularKeywords(
  options: { kind?: PopularKeywordKind; includeInactive?: boolean } = {},
): Promise<PopularKeyword[]> {
  if (!db) return [];
  try {
    const conditions = [];
    if (!options.includeInactive)
      conditions.push(eq(popularKeywords.isActive, true));
    if (options.kind) conditions.push(eq(popularKeywords.kind, options.kind));
    const where = conditions.length === 0 ? undefined : and(...conditions);
    return await db
      .select()
      .from(popularKeywords)
      .where(where)
      .orderBy(asc(popularKeywords.sortOrder), asc(popularKeywords.keyword));
  } catch (err) {
    console.error('[master-popular-keywords.listPopularKeywords] 실패:', err);
    return [];
  }
}

export async function getPopularKeywordById(
  id: string,
): Promise<PopularKeyword | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(popularKeywords)
      .where(eq(popularKeywords.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[master-popular-keywords.getPopularKeywordById] 실패:', err);
    return null;
  }
}

export type PopularKeywordWriteInput = {
  keyword: string;
  kind: PopularKeywordKind;
  sortOrder?: number;
};

export async function createPopularKeyword(
  input: PopularKeywordWriteInput,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const row: NewPopularKeyword = {
      keyword: input.keyword,
      normalizedKeyword: normalizeTerm(input.keyword),
      kind: input.kind,
      sortOrder: input.sortOrder ?? 0,
    };
    const [created] = await db
      .insert(popularKeywords)
      .values(row)
      .returning({ id: popularKeywords.id });
    return { ok: true, id: created?.id };
  } catch (err) {
    console.error('[master-popular-keywords.createPopularKeyword] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function updatePopularKeyword(
  id: string,
  input: Partial<PopularKeywordWriteInput>,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(popularKeywords)
      .set({
        ...(input.keyword !== undefined
          ? {
              keyword: input.keyword,
              normalizedKeyword: normalizeTerm(input.keyword),
            }
          : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.sortOrder !== undefined
          ? { sortOrder: input.sortOrder }
          : {}),
      })
      .where(eq(popularKeywords.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[master-popular-keywords.updatePopularKeyword] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function setPopularKeywordActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(popularKeywords)
      .set({ isActive })
      .where(eq(popularKeywords.id, id));
    return { ok: true };
  } catch (err) {
    console.error(
      '[master-popular-keywords.setPopularKeywordActive] 실패:',
      err,
    );
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

// ─────────────────────────────────────────────────────────────────────
// 노출 해석 (홈/검색) — pin + auto(block 제외) 병합, 1h 캐시
// ─────────────────────────────────────────────────────────────────────

async function _resolve(): Promise<string[]> {
  if (!db) return POPULAR_KEYWORDS;
  try {
    const rows = await listPopularKeywords({ includeInactive: false });
    const pins = rows
      .filter((r) => r.kind === 'pin')
      .map((r) => r.keyword);
    const blocked = new Set(
      rows.filter((r) => r.kind === 'block').map((r) => r.normalizedKeyword),
    );
    const pinnedNorm = new Set(pins.map((k) => normalizeTerm(k)));

    const merged: string[] = [...pins];

    if (merged.length < DISPLAY_LIMIT) {
      // 충분한 후보 확보를 위해 limit의 3배수까지 집계 후 필터.
      const auto = await topQueries(AUTO_WINDOW_DAYS, DISPLAY_LIMIT * 3);
      for (const a of auto) {
        if (merged.length >= DISPLAY_LIMIT) break;
        if (blocked.has(a.query)) continue;
        if (pinnedNorm.has(a.query)) continue;
        // topQueries는 normalizedQuery(소문자)를 반환. 한글은 그대로 노출 가능.
        merged.push(a.query);
      }
    }

    const result = merged.slice(0, DISPLAY_LIMIT);
    // pin/auto 모두 비면 하드코딩 fallback.
    return result.length > 0 ? result : POPULAR_KEYWORDS;
  } catch (err) {
    console.error('[master-popular-keywords._resolve] 실패:', err);
    return POPULAR_KEYWORDS;
  }
}

const _resolveCached = unstable_cache(_resolve, ['popular-keywords:resolve:v1'], {
  revalidate: 3600,
  tags: [POPULAR_KEYWORDS_CACHE_TAG],
});

/** 홈/검색 노출용 인기검색어 칩 목록. */
export async function resolvePopularKeywords(): Promise<string[]> {
  return _resolveCached();
}
