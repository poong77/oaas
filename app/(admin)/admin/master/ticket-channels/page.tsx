/**
 * /admin/master/ticket-channels — 구 라우트 (2026-06-09 통합).
 *
 * 유입 채널은 '문의 분류'(inquiry-classification) 메뉴의 채널 탭으로 통합되었다.
 * 채널 신규/편집(new·[id])은 이 경로 하위에 그대로 유지된다. 목록만 리다이렉트.
 */

import { permanentRedirect } from 'next/navigation';

export default function LegacyTicketChannelsPage() {
  permanentRedirect('/admin/master/inquiry-classification?tab=channels');
}
