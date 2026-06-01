/**
 * 마스터 — quick_actions (Phase 9).
 *
 * 홈 LP-01 ④ 카드. visible=true && is_active=true 만 홈에 노출.
 * DB에 row 없으면 호출부에서 _constants.ts의 하드코딩 fallback 사용.
 */

import 'server-only';
import { unstable_cache } from 'next/cache';
import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import {
  quickActions,
  type NewQuickAction,
  type QuickAction,
} from '@/db/schema';

/**
 * 홈 노출 quick_actions 캐시 태그.
 * 어드민 변경 시 master-actions에서 `revalidateTag(QUICK_ACTIONS_CACHE_TAG, 'default')`.
 * 어드민 목록(includeHidden/Inactive)은 캐시하지 않고 항상 최신 조회.
 */
export const QUICK_ACTIONS_CACHE_TAG = 'master:quick-actions';

export async function listQuickActions(
  options: { includeHidden?: boolean; includeInactive?: boolean } = {},
): Promise<QuickAction[]> {
  if (!db) return [];
  try {
    const conditions = [];
    if (!options.includeInactive) conditions.push(eq(quickActions.isActive, true));
    if (!options.includeHidden) conditions.push(eq(quickActions.visible, true));
    const where = conditions.length === 0 ? undefined : and(...conditions);
    return await db
      .select()
      .from(quickActions)
      .where(where)
      .orderBy(asc(quickActions.sortOrder), asc(quickActions.label));
  } catch (err) {
    console.error('[master-quick-actions.listQuickActions] 실패:', err);
    return [];
  }
}

/** 홈 페이지용 — 가시 + 활성만 (1시간 캐시 + 태그 무효화). */
const _listVisibleQuickActionsCached = unstable_cache(
  async (): Promise<QuickAction[]> =>
    listQuickActions({ includeHidden: false, includeInactive: false }),
  ['quick-actions:visible:v1'],
  { revalidate: 3600, tags: [QUICK_ACTIONS_CACHE_TAG] },
);

export async function listVisibleQuickActions(): Promise<QuickAction[]> {
  return _listVisibleQuickActionsCached();
}

export async function getQuickActionById(
  id: string,
): Promise<QuickAction | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(quickActions)
      .where(eq(quickActions.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[master-quick-actions.getQuickActionById] 실패:', err);
    return null;
  }
}

export type QuickActionWriteInput = {
  label: string;
  description?: string | null;
  icon?: string | null;
  linkUrl: string;
  sortOrder?: number;
  visible?: boolean;
};

export async function createQuickAction(
  input: QuickActionWriteInput,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const row: NewQuickAction = {
      label: input.label,
      description: input.description ?? null,
      icon: input.icon ?? null,
      linkUrl: input.linkUrl,
      sortOrder: input.sortOrder ?? 0,
      visible: input.visible ?? true,
    };
    const [created] = await db
      .insert(quickActions)
      .values(row)
      .returning({ id: quickActions.id });
    return { ok: true, id: created?.id };
  } catch (err) {
    console.error('[master-quick-actions.createQuickAction] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function updateQuickAction(
  id: string,
  input: Partial<QuickActionWriteInput>,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(quickActions)
      .set({
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.linkUrl !== undefined ? { linkUrl: input.linkUrl } : {}),
        ...(input.sortOrder !== undefined
          ? { sortOrder: input.sortOrder }
          : {}),
        ...(input.visible !== undefined ? { visible: input.visible } : {}),
      })
      .where(eq(quickActions.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[master-quick-actions.updateQuickAction] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function setQuickActionActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(quickActions)
      .set({ isActive })
      .where(eq(quickActions.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[master-quick-actions.setQuickActionActive] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}
