/**
 * 'message-templates' (메시지 템플릿) 마스터 메뉴 접근 가드.
 *
 * 통합 메뉴 (2026-06-09): notification_templates(알림) + quick_reply_templates(빠른 응대).
 * 구 /admin/master/notification-templates/{new,[id]} · /admin/master/quick-replies/{new,[id]}도
 * 각자 레이아웃에서 이 키로 가드된다.
 * @see app/(admin)/admin/master/menu-access
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
