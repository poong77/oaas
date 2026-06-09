/**
 * 'message-templates' 마스터 메뉴 접근 가드 (구 quick-replies 라우트).
 *
 * 2026-06-09: 빠른 응대가 '메시지 템플릿'으로 통합됨. 목록은 리다이렉트하되
 * new/[id] 편집 라우트는 이 폴더에 유지되므로 통합 키로 가드한다.
 * @see app/(admin)/admin/master/message-templates
 */

import type { ReactNode } from 'react';
import { requireMasterMenuAccess } from '@/lib/services/master-menu-access';

export default async function MasterMenuLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireMasterMenuAccess('message-templates');
  return <>{children}</>;
}
