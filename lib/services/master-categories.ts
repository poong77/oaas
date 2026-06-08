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
  /** 계층(대/중/소) 부모 id. null이면 대분류. */
  parentId?: string | null;
  /** 운영 메모. */
  memo?: string | null;
  meta?: Record<string, unknown>;
};

/** 제품 분류 계층 트리 노드. */
export type ProductTaxonomyNode = {
  id: string;
  code: string;
  label: string;
  memo: string | null;
  children: ProductTaxonomyNode[];
};

/**
 * 제품 분류(type='product')를 parent_id 기반 계층 트리로 조회 (활성만).
 * 접수폼 cascading select·어드민 트리 표시에 사용.
 */
export async function getProductTaxonomyTree(): Promise<ProductTaxonomyNode[]> {
  if (!db) return [];
  try {
    const rows = await db
      .select()
      .from(categories)
      .where(and(eq(categories.type, 'product'), eq(categories.isActive, true)))
      .orderBy(asc(categories.sortOrder), asc(categories.label));

    const byId = new Map<string, ProductTaxonomyNode>();
    for (const r of rows) {
      byId.set(r.id, {
        id: r.id,
        code: r.code,
        label: r.label,
        memo: r.memo,
        children: [],
      });
    }
    const roots: ProductTaxonomyNode[] = [];
    for (const r of rows) {
      const node = byId.get(r.id)!;
      if (r.parentId && byId.has(r.parentId)) {
        byId.get(r.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  } catch (err) {
    console.error('[master-categories.getProductTaxonomyTree] 실패:', err);
    return [];
  }
}

/** 어드민 편집용 제품 분류 트리 노드 (비활성 포함, 전체 필드). */
export type ProductCategoryAdminNode = {
  id: string;
  code: string;
  label: string;
  memo: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  /** 0=대분류 · 1=중분류 · 2=소분류 */
  depth: number;
  parentId: string | null;
  children: ProductCategoryAdminNode[];
};

/**
 * 제품 분류(type='product') 전체(활성+비활성)를 parent_id 기준 계층 트리로 조회.
 * 어드민 트리 편집 메뉴(`/admin/master/product-categories`) 전용.
 * 정렬: sortOrder ASC → label ASC. depth는 트리 순회로 부여.
 */
export async function listProductCategoryAdminTree(): Promise<
  ProductCategoryAdminNode[]
> {
  if (!db) return [];
  try {
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.type, 'product'))
      .orderBy(asc(categories.sortOrder), asc(categories.label));

    const byId = new Map<string, ProductCategoryAdminNode>();
    for (const r of rows) {
      byId.set(r.id, {
        id: r.id,
        code: r.code,
        label: r.label,
        memo: r.memo,
        icon: r.icon,
        sortOrder: r.sortOrder,
        isActive: r.isActive,
        depth: 0,
        parentId: r.parentId ?? null,
        children: [],
      });
    }
    const roots: ProductCategoryAdminNode[] = [];
    for (const r of rows) {
      const node = byId.get(r.id)!;
      if (r.parentId && byId.has(r.parentId)) {
        byId.get(r.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    // depth 부여 (순회)
    const assignDepth = (node: ProductCategoryAdminNode, depth: number) => {
      node.depth = depth;
      for (const child of node.children) assignDepth(child, depth + 1);
    };
    for (const root of roots) assignDepth(root, 0);
    return roots;
  } catch (err) {
    console.error('[master-categories.listProductCategoryAdminTree] 실패:', err);
    return [];
  }
}

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
      parentId: input.parentId ?? null,
      memo: input.memo ?? null,
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
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.memo !== undefined ? { memo: input.memo } : {}),
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
