/**
 * 'inquiry-classification' (문의 분류) 마스터 메뉴 접근 가드.
 *
 * 통합 메뉴 (2026-06-09): categories(이슈유형/긴급도/영향범위) + ticket_channels(유입 채널).
 * 인덱스/channels new·[id] 등 하위 전 경로를 한 번에 보호한다.
 * 구 /admin/master/ticket-channels/{new,[id]}도 이 키로 가드된다.
 * @see app/(admin)/admin/master/menu-access
 */

import type { ReactNode } from 'react';
import { requireMasterMenuAccess } from '@/lib/services/master-menu-access';

export default async function MasterMenuLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireMasterMenuAccess('inquiry-classification');
  return <>{children}</>;
}
