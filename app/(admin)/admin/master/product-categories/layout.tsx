/**
 * 'product-categories' 마스터 메뉴 접근 가드.
 *
 * 제품 분류(대/중/소 + 메모) 트리 편집 전용 메뉴. 이 하위 전 경로를 보호한다.
 * 매니저가 메뉴 접근 제어에서 차단된 경우 notFound(). 어드민은 항상 통과.
 * @see app/(admin)/admin/master/menu-access
 */

import type { ReactNode } from 'react';
import { requireMasterMenuAccess } from '@/lib/services/master-menu-access';

export default async function ProductCategoriesMenuLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireMasterMenuAccess('product-categories');
  return <>{children}</>;
}
