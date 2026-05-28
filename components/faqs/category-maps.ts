/**
 * 카테고리 → 라벨 맵 헬퍼.
 * server / client 양쪽에서 호출 가능 (순수 함수).
 */

import type { ProductCategoryView } from '@/lib/services/categories';

export function buildProductMap(
  list: ProductCategoryView[],
): Record<string, ProductCategoryView> {
  const out: Record<string, ProductCategoryView> = {};
  for (const c of list) out[c.code] = c;
  return out;
}

export function buildIssueTypeMap(
  list: Array<{ code: string; label: string }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of list) out[c.code] = c.label;
  return out;
}
