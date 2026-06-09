/**
 * 'inquiry-classification' 마스터 메뉴 접근 가드 (구 ticket-channels 라우트).
 *
 * 2026-06-09: 유입 채널이 '문의 분류'로 통합됨. 목록은 ../inquiry-classification로
 * 리다이렉트하되 채널 new/[id] 편집 라우트는 이 폴더에 유지되므로, 통합 키로 가드한다.
 * @see app/(admin)/admin/master/inquiry-classification
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
