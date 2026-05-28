/**
 * RoleScope — 역할별 모드 UI 분리의 핵심 서버 컴포넌트.
 *
 * 책임:
 *   1. 세션(user.role) + viewMode 쿠키 → RoleMode 결정
 *   2. <div data-role={mode}>로 자식을 감싸 CSS 변수 cascade 적용
 *      (app/globals.css의 [data-role='manager'|'hotelier'] 셀렉터)
 *   3. 호텔리어 UI(Header, EmergencyBanner, ChatbotFab)를 mode === 'hotelier'일 때만 노출
 *   4. 시점 보기 모드(매니저/어드민이 viewMode=hotelier 켠 상태)일 때 ViewModeBanner 노출
 *
 * 보안:
 *   - viewMode 쿠키는 UI 표시용. 서버 권한 체크(requireRole)는 항상 user.role 사용.
 *   - 호텔리어 본인은 viewMode 쿠키 무시(resolveRoleMode에서 처리).
 *
 * 성능 부수 효과:
 *   - 어드민/매니저 모드에서는 EmergencyBanner DB 쿼리 자체가 발생 안 함.
 *   - ChatbotFab iframe도 호텔리어 모드에서만 마운트.
 *
 * @see docs/02-design/features/role-mode-ui.design.md §3.1
 */

import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { resolveRoleMode, isInViewMode } from '@/lib/types/role-mode';
import { VIEW_MODE_COOKIE } from '@/lib/view-mode';
import { EmergencyBanner } from './emergency-banner';
import { Header } from './header';
import { ViewModeBanner } from './view-mode-banner';
import { ChatbotFab } from '@/components/chatbot/chatbot-fab';
import { getChatbotEmbedUrl } from '@/lib/services/chatbot-meta';

export async function RoleScope({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const cookieStore = await cookies();
  const viewModeCookie = cookieStore.get(VIEW_MODE_COOKIE)?.value;

  const userRole = session?.user?.role ?? null;
  const mode = resolveRoleMode(userRole, viewModeCookie);
  const showHotelierUi = mode === 'hotelier';
  const viewModeActive = isInViewMode(userRole, viewModeCookie);

  // 호텔리어 모드에서만 챗봇 임베드 URL 필요 (server-only chain 유지)
  const chatbotEmbedUrl = showHotelierUi ? getChatbotEmbedUrl() : '';

  return (
    <div data-role={mode} className="contents">
      {/* 시점 보기 모드 진입 시 노란 배너 (매니저/어드민만, 호텔리어 본인은 viewModeActive=false) */}
      {viewModeActive && userRole && userRole !== 'hotelier' && (
        <ViewModeBanner userRole={userRole} />
      )}

      {/* 호텔리어 UI는 mode==='hotelier'일 때만 노출 */}
      {showHotelierUi && <EmergencyBanner />}
      {showHotelierUi && <Header />}

      <main className="flex-1">{children}</main>

      {showHotelierUi && <ChatbotFab embedUrl={chatbotEmbedUrl} />}
    </div>
  );
}
