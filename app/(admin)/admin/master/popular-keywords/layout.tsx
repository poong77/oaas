/**
 * 'popular-keywords' 마스터 메뉴 접근 가드.
 *
 * 인덱스/new/[id] 등 이 메뉴 하위 전 경로를 한 번에 보호한다.
 * 매니저가 메뉴 접근 제어에서 차단된 경우 notFound(). 어드민은 항상 통과.
 * @see app/(admin)/admin/master/menu-access
 */

import type { ReactNode } from 'react';
import { requireMasterMenuAccess } from '@/lib/services/master-menu-access';

export default async function MasterMenuLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireMasterMenuAccess('popular-keywords');
  return <>{children}</>;
}
