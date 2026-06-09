/**
 * /admin/master/categories — 구 라우트 (2026-06-09 통합).
 *
 * 이슈유형/긴급도/영향범위는 '문의 분류'(inquiry-classification) 메뉴로 통합되었다.
 * 북마크·구 링크 보존을 위해 영구 리다이렉트.
 */

import { permanentRedirect } from 'next/navigation';

export default function LegacyCategoriesPage() {
  permanentRedirect('/admin/master/inquiry-classification?tab=issue_type');
}
