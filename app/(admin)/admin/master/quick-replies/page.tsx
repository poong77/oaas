/**
 * /admin/master/quick-replies — 구 라우트 (2026-06-09 통합).
 *
 * 빠른 응대는 '메시지 템플릿'(message-templates)의 빠른 응대 탭으로 통합되었다.
 * 신규/편집(new·[id])은 이 경로 하위에 그대로 유지된다. 목록만 리다이렉트.
 */

import { permanentRedirect } from 'next/navigation';

export default function LegacyQuickRepliesPage() {
  permanentRedirect('/admin/master/message-templates?tab=quick-reply');
}
