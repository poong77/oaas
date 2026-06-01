/**
 * GET /admin/help/guide — 어드민·매니저 실무 가이드 (정적 HTML 풀페이지).
 *
 * 설계 결정:
 *   - 별도 풀페이지 standalone HTML(자체 레이아웃·목차·다크미사용)을 그대로 서빙한다.
 *     → admin 레이아웃 chrome 없이 새 탭에서 단독 표시. 사이드바 footer "가이드" 링크가 진입점.
 *   - public/ 정적 배치 대신 **Route Handler로 인증 게이트**: 가이드에 GitHub 주소·환경변수 키 등
 *     내부 운영정보가 있어 비로그인 외부 노출을 막아야 한다 (manager/admin 한정).
 *   - HTML은 이 라우트 폴더에 co-locate → `import.meta.url` 상대 읽기로 Vercel 번들 추적(nft) 보장.
 *
 * 단일 소스: app/(admin)/admin/help/guide/admin-manager-guide.html (편집 시 이 파일만 수정)
 */

import { readFileSync } from 'node:fs';
import { getCurrentUser, isManagerOrAdmin } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// 모듈 로드(콜드스타트) 시 1회 읽어 캐시. import.meta.url 상대 경로 → nft가 asset으로 포함.
const GUIDE_HTML = readFileSync(
  new URL('./admin-manager-guide.html', import.meta.url),
  'utf-8',
);

export async function GET(req: Request): Promise<Response> {
  const user = await getCurrentUser();

  if (!user) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', '/admin/help/guide');
    return Response.redirect(loginUrl, 302);
  }

  if (!isManagerOrAdmin(user.role)) {
    return new Response('Forbidden', { status: 403 });
  }

  return new Response(GUIDE_HTML, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, max-age=300',
    },
  });
}
