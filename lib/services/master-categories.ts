/**
 * 마스터 — 카테고리 (Phase 9).
 *
 * 4 타입 (product / issue_type / urgency / impact) 모두 동일 테이블.
 * (type, code) unique. 시드와 동일한 6/6/3/4 구조 기본.
 */

import 'server-only';
import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import {
  categories,
  type Category,
  type CategoryType,
  type NewCategory,
} from '@/db/schema';

export async function listAllCategories(
  type: CategoryType,
  includeInactive = false,
): Promise<Category[]> {
  if (!db) return [];
  try {
    const conditions = [eq(categories.type, type)];
    if (!includeInactive) conditions.push(eq(categories.isActive, true));
    return await db
      .select()
      .from(categories)
      .where(and(...conditions))
      .orderBy(asc(categories.sortOrder), asc(categories.label));
  } catch (err) {
    console.error('[master-categories.listAllCategories] 실패:', err);
    return [];
  }
}

export async function getCategoryById(id: string): Promise<Category | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[master-categories.getCategoryById] 실패:', err);
    return null;
  }
}

export type CategoryWriteInput = {
  type: CategoryType;
  code: string;
  label: string;
  icon?: string | null;
  sortOrder?: number;
  meta?: Record<string, unknown>;
};

export async function createCategory(
  input: CategoryWriteInput,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const row: NewCategory = {
      type: input.type,
      code: input.code,
      label: input.label,
      icon: input.icon ?? null,
      sortOrder: input.sortOrder ?? 0,
      meta: input.meta ?? {},
    };
    const [created] = await db
      .insert(categories)
      .values(row)
      .returning({ id: categories.id });
    return { ok: true, id: created?.id };
  } catch (err) {
    console.error('[master-categories.createCategory] 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

export async function updateCategory(
  id: string,
  input: Partial<CategoryWriteInput>,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(categories)
      .set({
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.sortOrder !== undefined
          ? { sortOrder: input.sortOrder }
          : {}),
        ...(input.meta !== undefined ? { meta: input.meta } : {}),
      })
      .where(eq(categories.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[master-categories.updateCategory] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function setCategoryActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(categories)
      .set({ isActive })
      .where(eq(categories.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[master-categories.setCategoryActive] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}
