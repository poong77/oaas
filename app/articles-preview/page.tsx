/**
 * /articles-preview — 저장하지 않은 편집 상태의 미리보기 (어드민 셸 밖).
 *
 * 위치 결정 사유:
 *   - (admin) 라우트 그룹 안에 두면 AdminShell(사이드바+헤더)이 둘러쌈
 *   - "실제 /help 페이지처럼" 미리보기가 목적이므로 어드민 크롬을 벗어나야 함
 *   - 권한은 server에서 requireRole 로 직접 체크
 *
 * URL: /articles-preview?key={nonce}
 */

import { requireRole } from '@/lib/permissions';
import { PreviewRenderer } from './_preview-renderer';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'DRAFT 미리보기 — OA서포트',
  robots: { index: false, follow: false },
};

export default async function ArticlePreviewPage() {
  // 어드민/매니저만 접근 가능 (호텔리어가 URL 직접 입력해도 차단)
  await requireRole(['manager', 'admin']);
  return <PreviewRenderer />;
}
