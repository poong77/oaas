/**
 * RoleScope — 역할별 모드 UI 분리의 핵심 서버 컴포넌트.
 *
 * 책임:
 *   1. 세션(user.role) → RoleMode 결정 + data-role 부여
 *   2. Header(GNB)는 어드민 워크스페이스(/admin/*)를 제외한 전 영역에서 항상 노출.
 *      어드민/매니저로 로그인한 상태에서도 프론트 페이지(/, /help, /faq …)
 *      네비게이션이 끊기지 않도록 함. Header 내부에서 역할별 메뉴(티켓 큐·어드민
 *      메뉴 배지)는 이미 분기 처리되어 있음.
 *   3. EmergencyBanner·ChatbotFab은 호텔리어 모드에서만 노출 (운영 비용 최소화).
 *
 * 경로 판별:
 *   - proxy.ts가 모든 요청에 `x-pathname` 헤더를 주입.
 *   - 어드민 영역(/admin)은 자체 AdminShell이 있으므로 중복 헤더 방지를 위해 제외.
 */

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { resolveRoleMode } from '@/lib/types/role-mode';
import { EmergencyBanner } from './emergency-banner';
import { Header } from './header';
import { ChatbotFab } from '@/components/chatbot/chatbot-fab';
import { getChatbotEmbedUrl } from '@/lib/services/chatbot-meta';

export async function RoleScope({ children }: { children: React.ReactNode }) {
  const [session, hdrs] = await Promise.all([auth(), headers()]);
  const userRole = session?.user?.role ?? null;
  const mode = resolveRoleMode(userRole);
  const isHotelier = mode === 'hotelier';

  const pathname = hdrs.get('x-pathname') ?? '';
  const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/');

  // Header는 어드민 워크스페이스(/admin/*) 외 전 영역에서 노출
  const showHeader = !isAdminArea;
  // EmergencyBanner·ChatbotFab은 호텔리어 모드 전용
  const showHotelierExtras = isHotelier && !isAdminArea;

  const chatbotEmbedUrl = showHotelierExtras ? getChatbotEmbedUrl() : '';

  return (
    <div data-role={mode} className="contents">
      {showHotelierExtras && <EmergencyBanner />}
      {showHeader && <Header />}

      <main className="flex-1">{children}</main>

      {showHotelierExtras && <ChatbotFab embedUrl={chatbotEmbedUrl} />}
    </div>
  );
}
