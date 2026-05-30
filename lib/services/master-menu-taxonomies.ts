/**
 * 마스터 — 메뉴 구조 (menu-taxonomies).
 *
 * 도움말 아티클의 `menu_path` 정본 트리. 깊이 ≤ 3단(앱 레벨 강제).
 *
 * 운영 패턴:
 *   - 비활성(`is_active = false`)은 어드민 편집 화면에서만 노출
 *   - 노드 비활성 시 자식까지 cascade 비활성 (이력 보존)
 *   - articles와 FK 없음. 비활성 메뉴를 가리키는 아티클은 어드민 화면에 경고 (별도 검증)
 *
 * @see docs/01-plan/features/아티클관리시스템.plan.md §5.2, P0-D
 */

import 'server-only';
import { and, asc, count, desc, eq, ilike, inArray, isNull, sql } from 'drizzle-orm';
import { unstable_cache, revalidateTag } from 'next/cache';

import { db } from '@/db';
import {
  menuTaxonomies,
  type MenuTaxonomy,
  type NewMenuTaxonomy,
} from '@/db/schema';

const MENU_TAX_CACHE_TAG = 'menu-taxonomies';

/** 메뉴 트리 최대 깊이. 0=루트, 1=중분류, 2=소분류. */
export const MAX_MENU_DEPTH = 2;

// ─────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────

/** 트리 형태(자식 포함). */
export type MenuTaxonomyTreeNode = MenuTaxonomy & {
  depth: number;
  children: MenuTaxonomyTreeNode[];
};

/** 평탄화된 노드 (드롭다운/검색용). */
export type MenuTaxonomyFlatNode = MenuTaxonomy & {
  depth: number;
  /** 루트부터 자신까지 라벨 배열 (예: ["예약 관리", "예약 등록"]) */
  pathLabels: string[];
  /** 자식 수 (활성 only) */
  childCount: number;
};

export type ListMenuTaxonomyParams = {
  productCode?: string;
  search?: string;
  includeInactive?: boolean;
};

// ─────────────────────────────────────────────────────────────────
// 내부 헬퍼
// ─────────────────────────────────────────────────────────────────

function buildTree(
  rows: MenuTaxonomy[],
): { byProduct: Record<string, MenuTaxonomyTreeNode[]>; depthOf: Map<string, number> } {
  const byProduct: Record<string, MenuTaxonomyTreeNode[]> = {};
  const nodeMap = new Map<string, MenuTaxonomyTreeNode>();
  const depthOf = new Map<string, number>();

  // 1차: 노드 객체 초기화
  for (const row of rows) {
    const node: MenuTaxonomyTreeNode = { ...row, depth: 0, children: [] };
    nodeMap.set(row.id, node);
  }

  // 2차: 부모-자식 연결
  for (const row of rows) {
    const node = nodeMap.get(row.id)!;
    if (row.parentId && nodeMap.has(row.parentId)) {
      const parent = nodeMap.get(row.parentId)!;
      parent.children.push(node);
    } else {
      if (!byProduct[row.productCode]) byProduct[row.productCode] = [];
      byProduct[row.productCode].push(node);
    }
  }

  // 3차: depth 계산 + 정렬
  const computeDepth = (node: MenuTaxonomyTreeNode, d: number): void => {
    node.depth = d;
    depthOf.set(node.id, d);
    node.children.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
    );
    for (const c of node.children) computeDepth(c, d + 1);
  };
  for (const product of Object.keys(byProduct)) {
    byProduct[product].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
    );
    for (const root of byProduct[product]) computeDepth(root, 0);
  }

  return { byProduct, depthOf };
}

function flatten(
  node: MenuTaxonomyTreeNode,
  pathLabels: string[],
): MenuTaxonomyFlatNode[] {
  const here: MenuTaxonomyFlatNode = {
    ...node,
    pathLabels: [...pathLabels, node.label],
    childCount: node.children.length,
  };
  const rest = node.children.flatMap((c) => flatten(c, here.pathLabels));
  return [here, ...rest];
}

// ─────────────────────────────────────────────────────────────────
// 조회
// ─────────────────────────────────────────────────────────────────

/** 전체 트리 (productCode별 그룹화) — 어드민 인덱스 페이지 메인 뷰. */
export async function listMenuTaxonomyTree(
  params: ListMenuTaxonomyParams = {},
): Promise<Record<string, MenuTaxonomyTreeNode[]>> {
  if (!db) return {};
  try {
    const conditions = [];
    if (!params.includeInactive) {
      conditions.push(eq(menuTaxonomies.isActive, true));
    }
    if (params.productCode) {
      conditions.push(eq(menuTaxonomies.productCode, params.productCode));
    }
    if (params.search?.trim()) {
      conditions.push(ilike(menuTaxonomies.label, `%${params.search.trim()}%`));
    }
    const where = conditions.length === 0 ? undefined : and(...conditions);

    const rows = await db
      .select()
      .from(menuTaxonomies)
      .where(where)
      .orderBy(
        asc(menuTaxonomies.productCode),
        asc(menuTaxonomies.sortOrder),
        asc(menuTaxonomies.label),
      );

    const { byProduct } = buildTree(rows);
    return byProduct;
  } catch (err) {
    console.error('[master-menu-taxonomies.listMenuTaxonomyTree] 실패:', err);
    return {};
  }
}

/** 평탄화된 전체 노드 — 드롭다운(부모 선택)·검증용. */
export async function listMenuTaxonomyFlat(
  params: ListMenuTaxonomyParams = {},
): Promise<MenuTaxonomyFlatNode[]> {
  const byProduct = await listMenuTaxonomyTree(params);
  return Object.values(byProduct).flatMap((roots) =>
    roots.flatMap((r) => flatten(r, [])),
  );
}

/** 단일 노드 + 자식 카운트 + depth. */
export async function getMenuTaxonomyById(
  id: string,
): Promise<MenuTaxonomyFlatNode | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(menuTaxonomies)
      .where(eq(menuTaxonomies.id, id))
      .limit(1);
    const node = rows[0];
    if (!node) return null;

    // depth와 pathLabels는 ancestor 추적으로 계산
    const pathLabels: string[] = [node.label];
    let cursor = node.parentId;
    let depth = 0;
    while (cursor) {
      const parentRows = await db
        .select()
        .from(menuTaxonomies)
        .where(eq(menuTaxonomies.id, cursor))
        .limit(1);
      const p = parentRows[0];
      if (!p) break;
      pathLabels.unshift(p.label);
      depth += 1;
      cursor = p.parentId;
      // depth 폭주 방지 (방어적)
      if (depth > 10) break;
    }

    const childCountRow = await db
      .select({ c: count() })
      .from(menuTaxonomies)
      .where(
        and(
          eq(menuTaxonomies.parentId, id),
          eq(menuTaxonomies.isActive, true),
        ),
      );

    return {
      ...node,
      depth,
      pathLabels,
      childCount: Number(childCountRow[0]?.c ?? 0),
    };
  } catch (err) {
    console.error('[master-menu-taxonomies.getMenuTaxonomyById] 실패:', err);
    return null;
  }
}

export async function getMenuTaxonomyStats(): Promise<{
  totalNodes: number;
  activeNodes: number;
  rootNodes: number;
  byProductCount: Record<string, number>;
}> {
  if (!db) {
    return { totalNodes: 0, activeNodes: 0, rootNodes: 0, byProductCount: {} };
  }
  try {
    const [allCount, activeCount, rootCount, perProduct] = await Promise.all([
      db.select({ c: count() }).from(menuTaxonomies),
      db
        .select({ c: count() })
        .from(menuTaxonomies)
        .where(eq(menuTaxonomies.isActive, true)),
      db
        .select({ c: count() })
        .from(menuTaxonomies)
        .where(
          and(isNull(menuTaxonomies.parentId), eq(menuTaxonomies.isActive, true)),
        ),
      db
        .select({
          productCode: menuTaxonomies.productCode,
          c: count(),
        })
        .from(menuTaxonomies)
        .where(eq(menuTaxonomies.isActive, true))
        .groupBy(menuTaxonomies.productCode),
    ]);

    const byProductCount: Record<string, number> = {};
    for (const row of perProduct) {
      byProductCount[row.productCode] = Number(row.c);
    }

    return {
      totalNodes: Number(allCount[0]?.c ?? 0),
      activeNodes: Number(activeCount[0]?.c ?? 0),
      rootNodes: Number(rootCount[0]?.c ?? 0),
      byProductCount,
    };
  } catch (err) {
    console.error('[master-menu-taxonomies.getMenuTaxonomyStats] 실패:', err);
    return { totalNodes: 0, activeNodes: 0, rootNodes: 0, byProductCount: {} };
  }
}

// ─────────────────────────────────────────────────────────────────
// 검색 인덱스 (articles.menu_path 검증용 — 캐시)
// ─────────────────────────────────────────────────────────────────

type _MenuTaxonomyIndexRaw = {
  rows: Array<{ id: string; productCode: string; parentId: string | null; label: string }>;
};

const _loadMenuTaxonomyRaw = unstable_cache(
  async (): Promise<_MenuTaxonomyIndexRaw> => {
    if (!db) return { rows: [] };
    try {
      const rows = await db
        .select({
          id: menuTaxonomies.id,
          productCode: menuTaxonomies.productCode,
          parentId: menuTaxonomies.parentId,
          label: menuTaxonomies.label,
        })
        .from(menuTaxonomies)
        .where(eq(menuTaxonomies.isActive, true));
      return { rows };
    } catch (err) {
      console.error('[master-menu-taxonomies._loadMenuTaxonomyRaw] 실패:', err);
      return { rows: [] };
    }
  },
  ['menu-taxonomies:v1-raw'],
  { revalidate: 300, tags: [MENU_TAX_CACHE_TAG] },
);

/**
 * `productCode`별 유효 경로 set 반환 — articles.menu_path 검증용.
 *
 * 반환: Map<productCode, Set<"a > b > c">> 형태. 경로 라벨은 ` > `로 join.
 */
export async function loadValidMenuPaths(): Promise<Map<string, Set<string>>> {
  const { rows } = await _loadMenuTaxonomyRaw();
  const byId = new Map<string, { productCode: string; parentId: string | null; label: string }>();
  for (const r of rows) byId.set(r.id, r);

  const result = new Map<string, Set<string>>();
  for (const r of rows) {
    const path: string[] = [r.label];
    let cursor = r.parentId;
    let safety = 0;
    while (cursor && safety < 10) {
      const p = byId.get(cursor);
      if (!p) break;
      path.unshift(p.label);
      cursor = p.parentId;
      safety += 1;
    }
    const set = result.get(r.productCode) ?? new Set<string>();
    set.add(path.join(' > '));
    result.set(r.productCode, set);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────
// 변경
// ─────────────────────────────────────────────────────────────────

export type CreateMenuTaxonomyInput = {
  productCode: string;
  parentId?: string | null;
  label: string;
  description?: string | null;
  sortOrder?: number;
};

export type UpdateMenuTaxonomyInput = Partial<CreateMenuTaxonomyInput> & {
  isActive?: boolean;
};

/**
 * 부모 depth + 1이 MAX_MENU_DEPTH를 초과하면 거부.
 *
 * @returns 부모의 depth (0=root). 부모 없으면 -1.
 */
async function getParentDepth(parentId: string | null | undefined): Promise<number> {
  if (!parentId) return -1;
  if (!db) return -1;
  let cursor: string | null = parentId;
  let d = 0;
  let safety = 0;
  while (cursor && safety < 10) {
    const rows: { parentId: string | null }[] = await db
      .select({ parentId: menuTaxonomies.parentId })
      .from(menuTaxonomies)
      .where(eq(menuTaxonomies.id, cursor))
      .limit(1);
    const row = rows[0];
    if (!row) return d;
    cursor = row.parentId;
    if (cursor) d += 1;
    safety += 1;
  }
  return d;
}

export async function createMenuTaxonomy(
  input: CreateMenuTaxonomyInput,
): Promise<
  | { ok: true; id: string }
  | { ok: false; message: 'DUPLICATE_LABEL' | 'DEPTH_EXCEEDED' | 'PARENT_NOT_FOUND' | 'INVALID_INPUT' | 'DB_NOT_READY' | 'INTERNAL_ERROR' }
> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  const label = input.label?.trim();
  if (!label || !input.productCode?.trim()) {
    return { ok: false, message: 'INVALID_INPUT' };
  }

  try {
    // 깊이 검증
    if (input.parentId) {
      const parentDepth = await getParentDepth(input.parentId);
      if (parentDepth < 0) return { ok: false, message: 'PARENT_NOT_FOUND' };
      if (parentDepth + 1 > MAX_MENU_DEPTH) {
        return { ok: false, message: 'DEPTH_EXCEEDED' };
      }
      // 부모의 productCode 일치 검증
      const parentRows = await db
        .select({ productCode: menuTaxonomies.productCode })
        .from(menuTaxonomies)
        .where(eq(menuTaxonomies.id, input.parentId))
        .limit(1);
      if (
        parentRows[0] &&
        parentRows[0].productCode !== input.productCode.trim()
      ) {
        return { ok: false, message: 'INVALID_INPUT' };
      }
    }

    const [row] = await db
      .insert(menuTaxonomies)
      .values({
        productCode: input.productCode.trim(),
        parentId: input.parentId ?? null,
        label,
        description: input.description?.trim() || null,
        sortOrder: input.sortOrder ?? 100,
      } satisfies NewMenuTaxonomy)
      .returning({ id: menuTaxonomies.id });
    revalidateTag(MENU_TAX_CACHE_TAG, 'default');
    return { ok: true, id: row!.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'INTERNAL_ERROR';
    if (msg.includes('menu_taxonomies_label_uq')) {
      return { ok: false, message: 'DUPLICATE_LABEL' };
    }
    console.error('[master-menu-taxonomies.createMenuTaxonomy] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function updateMenuTaxonomy(
  id: string,
  patch: UpdateMenuTaxonomyInput,
): Promise<
  | { ok: true }
  | { ok: false; message: 'DUPLICATE_LABEL' | 'DEPTH_EXCEEDED' | 'INVALID_INPUT' | 'DB_NOT_READY' | 'INTERNAL_ERROR' | 'CYCLE_DETECTED' }
> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const update: Partial<NewMenuTaxonomy> & { isActive?: boolean } = {};
    if (patch.productCode !== undefined) {
      const v = patch.productCode.trim();
      if (!v) return { ok: false, message: 'INVALID_INPUT' };
      update.productCode = v;
    }
    if (patch.parentId !== undefined) {
      // 자기 자신 또는 자신의 후손을 부모로 지정하면 사이클 → 거부
      if (patch.parentId === id) return { ok: false, message: 'CYCLE_DETECTED' };
      if (patch.parentId) {
        // 후손인지 검사
        const descendants = await collectDescendantIds(id);
        if (descendants.has(patch.parentId)) {
          return { ok: false, message: 'CYCLE_DETECTED' };
        }
        const parentDepth = await getParentDepth(patch.parentId);
        if (parentDepth + 1 > MAX_MENU_DEPTH) {
          return { ok: false, message: 'DEPTH_EXCEEDED' };
        }
      }
      update.parentId = patch.parentId ?? null;
    }
    if (patch.label !== undefined) {
      const v = patch.label.trim();
      if (!v) return { ok: false, message: 'INVALID_INPUT' };
      update.label = v;
    }
    if (patch.description !== undefined) {
      update.description = patch.description?.trim() || null;
    }
    if (patch.sortOrder !== undefined) update.sortOrder = patch.sortOrder;
    if (patch.isActive !== undefined) update.isActive = patch.isActive;

    if (Object.keys(update).length === 0) return { ok: true };

    await db.update(menuTaxonomies).set(update).where(eq(menuTaxonomies.id, id));
    revalidateTag(MENU_TAX_CACHE_TAG, 'default');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'INTERNAL_ERROR';
    if (msg.includes('menu_taxonomies_label_uq')) {
      return { ok: false, message: 'DUPLICATE_LABEL' };
    }
    console.error('[master-menu-taxonomies.updateMenuTaxonomy] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

async function collectDescendantIds(rootId: string): Promise<Set<string>> {
  const set = new Set<string>();
  if (!db) return set;
  const queue: string[] = [rootId];
  let safety = 0;
  while (queue.length > 0 && safety < 100) {
    const current = queue.shift()!;
    const children = await db
      .select({ id: menuTaxonomies.id })
      .from(menuTaxonomies)
      .where(eq(menuTaxonomies.parentId, current));
    for (const c of children) {
      if (!set.has(c.id)) {
        set.add(c.id);
        queue.push(c.id);
      }
    }
    safety += 1;
  }
  return set;
}

/** soft delete (자식 cascade 비활성). */
export async function deactivateMenuTaxonomy(
  id: string,
): Promise<{ ok: true; affectedCount: number } | { ok: false; message: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const descendants = await collectDescendantIds(id);
    const ids = [id, ...descendants];
    await db
      .update(menuTaxonomies)
      .set({ isActive: false })
      .where(inArray(menuTaxonomies.id, ids));
    revalidateTag(MENU_TAX_CACHE_TAG, 'default');
    return { ok: true, affectedCount: ids.length };
  } catch (err) {
    console.error('[master-menu-taxonomies.deactivateMenuTaxonomy] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function restoreMenuTaxonomy(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(menuTaxonomies)
      .set({ isActive: true })
      .where(eq(menuTaxonomies.id, id));
    revalidateTag(MENU_TAX_CACHE_TAG, 'default');
    return { ok: true };
  } catch (err) {
    console.error('[master-menu-taxonomies.restoreMenuTaxonomy] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}
