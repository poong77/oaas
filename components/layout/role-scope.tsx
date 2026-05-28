/**
 * RoleScope — 역할별 모드 UI 분리의 핵심 서버 컴포넌트.
 *
 * 책임:
 *   1. 세션(user.role) → RoleMode 결정
 *   2. <div data-role={mode}>로 자식을 감싸 CSS 변수 cascade 적용
 *      (app/globals.css의 [data-role='manager'|'hotelier'] 셀렉터)
 *   3. 호텔리어 UI(Header, EmergencyBanner, ChatbotFab)를 mode === 'hotelier'일 때만 노출
 *
 * 성능 부수 효과:
 *   - 어드민/매니저 모드에서는 EmergencyBanner DB 쿼리 자체가 발생 안 함.
 *   - ChatbotFab iframe도 호텔리어 모드에서만 마운트.
 */

import { auth } from '@/lib/auth';
import { resolveRoleMode } from '@/lib/types/role-mode';
import { EmergencyBanner } from './emergency-banner';
import { Header } from './header';
import { ChatbotFab } from '@/components/chatbot/chatbot-fab';
import { getChatbotEmbedUrl } from '@/lib/services/chatbot-meta';

export async function RoleScope({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userRole = session?.user?.role ?? null;
  const mode = resolveRoleMode(userRole);
  const showHotelierUi = mode === 'hotelier';

  // 호텔리어 모드에서만 챗봇 임베드 URL 필요 (server-only chain 유지)
  const chatbotEmbedUrl = showHotelierUi ? getChatbotEmbedUrl() : '';

  return (
    <div data-role={mode} className="contents">
      {/* 호텔리어 UI는 mode==='hotelier'일 때만 노출 */}
      {showHotelierUi && <EmergencyBanner />}
      {showHotelierUi && <Header />}

      <main className="flex-1">{children}</main>

      {showHotelierUi && <ChatbotFab embedUrl={chatbotEmbedUrl} />}
    </div>
  );
}
