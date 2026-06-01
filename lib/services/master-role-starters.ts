/**
 * 마스터 — role_starters (Phase 9).
 *
 * 홈 LP-01 ⑤ 카드. role_key unique.
 */

import 'server-only';
import { unstable_cache } from 'next/cache';
import { and, asc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import {
  articles,
  roleStarters,
  type NewRoleStarter,
  type RoleStarter,
} from '@/db/schema';

/**
 * role_starters 캐시 태그.
 * 어드민 변경 시 master-actions에서 `revalidateTag(ROLE_STARTERS_CACHE_TAG, 'default')`.
 * 홈(listActiveRoleStarters)·역할 페이지(getRoleStarterWithArticles) 공통.
 */
export const ROLE_STARTERS_CACHE_TAG = 'master:role-starters';

export const KNOWN_ROLE_KEYS = [
  'front',
  'sales',
  'housekeeping',
  'manager',
  'new_open',
] as const;
export type KnownRoleKey = (typeof KNOWN_ROLE_KEYS)[number];

export async function listRoleStarters(
  includeInactive = false,
): Promise<RoleStarter[]> {
  if (!db) return [];
  try {
    const conditions = [];
    if (!includeInactive) conditions.push(eq(roleStarters.isActive, true));
    const where = conditions.length === 0 ? undefined : and(...conditions);
    return await db
      .select()
      .from(roleStarters)
      .where(where)
      .orderBy(asc(roleStarters.sortOrder), asc(roleStarters.label));
  } catch (err) {
    console.error('[master-role-starters.listRoleStarters] 실패:', err);
    return [];
  }
}

/** 홈 페이지용 — 활성만 (1시간 캐시 + 태그 무효화). */
const _listActiveRoleStartersCached = unstable_cache(
  async (): Promise<RoleStarter[]> => listRoleStarters(false),
  ['role-starters:active:v1'],
  { revalidate: 3600, tags: [ROLE_STARTERS_CACHE_TAG] },
);

export async function listActiveRoleStarters(): Promise<RoleStarter[]> {
  return _listActiveRoleStartersCached();
}

/**
 * roleKey로 단일 조회 (활성만). 없으면 null.
 */
export async function getRoleStarterByKey(
  roleKey: string,
): Promise<RoleStarter | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(roleStarters)
      .where(
        and(eq(roleStarters.roleKey, roleKey), eq(roleStarters.isActive, true)),
      )
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[master-role-starters.getRoleStarterByKey] 실패:', err);
    return null;
  }
}

/**
 * /role/[key] 페이지용 — role + 매핑된 발행 아티클 카드 (articleIds 순서 보존).
 *
 * @returns null이면 폴백(정적 ROLE_STARTERS) 사용.
 */
export async function getRoleStarterWithArticles(roleKey: string): Promise<{
  starter: RoleStarter;
  articles: Array<{
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    productCode: string;
    contentType: string;
  }>;
} | null> {
  const starter = await getRoleStarterByKey(roleKey);
  if (!starter || !db) return null;
  const ids = starter.articleIds ?? [];
  if (ids.length === 0) return { starter, articles: [] };
  try {
    const rows = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        summary: articles.summary,
        productCode: articles.productCode,
        contentType: articles.contentType,
      })
      .from(articles)
      .where(
        and(
          inArray(articles.id, ids),
          eq(articles.status, 'published'),
          eq(articles.isActive, true),
        ),
      );
    // 순서 보존 — articleIds 배열 순서대로
    const byId = new Map(rows.map((r) => [r.id, r] as const));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => !!r);
    return { starter, articles: ordered };
  } catch (err) {
    console.error('[master-role-starters.getRoleStarterWithArticles] 실패:', err);
    return { starter, articles: [] };
  }
}

export async function getRoleStarterById(
  id: string,
): Promise<RoleStarter | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(roleStarters)
      .where(eq(roleStarters.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[master-role-starters.getRoleStarterById] 실패:', err);
    return null;
  }
}

export type RoleStarterWriteInput = {
  roleKey: string;
  label: string;
  description?: string | null;
  icon?: string | null;
  articleIds?: string[];
  sortOrder?: number;
};

export async function upsertRoleStarter(
  input: RoleStarterWriteInput,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const row: NewRoleStarter = {
      roleKey: input.roleKey,
      label: input.label,
      description: input.description ?? null,
      icon: input.icon ?? null,
      articleIds: input.articleIds ?? [],
      sortOrder: input.sortOrder ?? 0,
    };
    const [created] = await db
      .insert(roleStarters)
      .values(row)
      .onConflictDoUpdate({
        target: roleStarters.roleKey,
        set: {
          label: row.label,
          description: row.description,
          icon: row.icon,
          articleIds: row.articleIds,
          sortOrder: row.sortOrder,
          isActive: true,
        },
      })
      .returning({ id: roleStarters.id });
    return { ok: true, id: created?.id };
  } catch (err) {
    console.error('[master-role-starters.upsertRoleStarter] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function updateRoleStarterById(
  id: string,
  input: Partial<RoleStarterWriteInput>,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(roleStarters)
      .set({
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.articleIds !== undefined
          ? { articleIds: input.articleIds }
          : {}),
        ...(input.sortOrder !== undefined
          ? { sortOrder: input.sortOrder }
          : {}),
      })
      .where(eq(roleStarters.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[master-role-starters.updateRoleStarterById] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function setRoleStarterActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(roleStarters)
      .set({ isActive })
      .where(eq(roleStarters.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[master-role-starters.setRoleStarterActive] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}
