/**
 * categories 데이터 액세스 (Server 전용).
 *
 * Phase 2:
 *   - getProductCategories() — 홈/검색/help placeholder에서 6개 product 카드 노출.
 *
 * DB 미연결 시에는 시드 기준 하드코딩 fallback 반환 (UI 안정성).
 */

import 'server-only';
import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { categories, type Category, type CategoryType } from '@/db/schema';

/** DB 미연결 시 fallback. 시드와 동일한 6개 product. */
const FALLBACK_PRODUCT_CATEGORIES: Array<
  Pick<Category, 'id' | 'code' | 'label' | 'icon' | 'sortOrder'> & {
    fallback: true;
  }
> = [
  { id: 'fallback-pms', code: 'pms', label: 'PMS', icon: 'Building2', sortOrder: 10, fallback: true },
  { id: 'fallback-cms', code: 'cms', label: 'CMS', icon: 'Layers', sortOrder: 20, fallback: true },
  { id: 'fallback-keyless', code: 'keyless', label: 'Keyless', icon: 'KeyRound', sortOrder: 30, fallback: true },
  { id: 'fallback-kiosk', code: 'kiosk', label: '키오스크', icon: 'Monitor', sortOrder: 40, fallback: true },
  { id: 'fallback-web', code: 'web', label: '웹서비스', icon: 'Globe', sortOrder: 50, fallback: true },
  { id: 'fallback-config', code: 'config', label: '설정', icon: 'Settings', sortOrder: 60, fallback: true },
];

export type ProductCategoryView = {
  id: string;
  code: string;
  label: string;
  icon: string | null;
  sortOrder: number;
};

export async function getProductCategories(): Promise<ProductCategoryView[]> {
  if (!db) {
    return FALLBACK_PRODUCT_CATEGORIES.map(({ fallback: _f, ...rest }) => rest);
  }
  try {
    const rows = await db
      .select({
        id: categories.id,
        code: categories.code,
        label: categories.label,
        icon: categories.icon,
        sortOrder: categories.sortOrder,
      })
      .from(categories)
      .where(and(eq(categories.type, 'product'), eq(categories.isActive, true)))
      .orderBy(asc(categories.sortOrder), asc(categories.label));
    if (rows.length === 0) {
      return FALLBACK_PRODUCT_CATEGORIES.map(({ fallback: _f, ...rest }) => rest);
    }
    return rows;
  } catch (err) {
    console.error('[categories.getProductCategories] 실패:', err);
    return FALLBACK_PRODUCT_CATEGORIES.map(({ fallback: _f, ...rest }) => rest);
  }
}

/** 일반 타입별 조회 (검색 등에서 재사용). */
export async function getCategoriesByType(
  type: CategoryType,
): Promise<Category[]> {
  if (!db) return [];
  try {
    return await db
      .select()
      .from(categories)
      .where(and(eq(categories.type, type), eq(categories.isActive, true)))
      .orderBy(asc(categories.sortOrder), asc(categories.label));
  } catch (err) {
    console.error('[categories.getCategoriesByType] 실패:', err);
    return [];
  }
}
