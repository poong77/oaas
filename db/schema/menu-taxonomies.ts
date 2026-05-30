/**
 * `menu_taxonomies` — 도움말 메뉴 구조 마스터.
 *
 * 제품(`productCode`)별 메뉴 트리. 아티클의 `category_path`(=menu_path)가 가리키는
 * 정본 라벨 트리. 깊이 ≤ 3단(앱 레벨 강제, DB 제약 없음).
 *
 * 자기참조 트리:
 *   - `parentId = NULL` → 루트(대메뉴)
 *   - depth는 라우팅·표시에서 동적 계산
 *
 * 운영 패턴:
 *   - 비활성(`is_active = false`)은 어드민 목록에서만 노출, 아티클 검증에서 제외
 *   - 노드 삭제 시 자식 노드 cascade 비활성은 서비스 레이어에서 처리
 *   - articles와 FK 없음 — 메뉴 리네임/재배치 시 아티클 잠금 방지
 *
 * 어드민 메뉴: `/admin/master/menu-taxonomies`.
 *
 * @see docs/01-plan/features/아티클관리시스템.plan.md §5.2 (P0-D)
 */

import {
  AnyPgColumn,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';

export const menuTaxonomies = pgTable(
  'menu_taxonomies',
  {
    ...commonColumns(),
    /** 제품 코드 (`categories.code` 의 product 타입 참조 — FK 없음, 자유 변경 허용). */
    productCode: text('product_code').notNull(),
    /** 상위 노드. NULL이면 루트(대메뉴). 자기참조. */
    parentId: uuid('parent_id').references(
      (): AnyPgColumn => menuTaxonomies.id,
      { onDelete: 'set null' },
    ),
    /** 사용자 노출 라벨. 같은 부모 아래에서는 unique. */
    label: text('label').notNull(),
    /** 운영자 메모 (검색·표시 미반영). */
    description: text('description'),
    /** 형제 노드 간 정렬. 낮을수록 위. 같으면 label 알파벳 */
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    // 같은 product + 같은 parent 아래에서는 label 중복 불가 (활성/비활성 무관)
    uniqueIndex('menu_taxonomies_label_uq').on(
      table.productCode,
      table.parentId,
      table.label,
    ),
    // 트리 조회용
    index('menu_taxonomies_product_parent_idx').on(
      table.productCode,
      table.parentId,
      table.sortOrder,
    ),
    // 활성 필터용
    index('menu_taxonomies_active_idx').on(table.isActive),
  ],
);

export type MenuTaxonomy = typeof menuTaxonomies.$inferSelect;
export type NewMenuTaxonomy = typeof menuTaxonomies.$inferInsert;
