import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import { RoleScope } from '@/components/layout/role-scope';
import './globals.css';

export const metadata: Metadata = {
  title: '통합 AS 플랫폼 — support.oapms.com',
  description: 'OA 솔루션 호텔리어를 위한 통합 셀프 서비스 + AS 티켓 허브',
  applicationName: '통합 AS 플랫폼',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Header/EmergencyBanner/ChatbotFab의 노출 정책 + data-role 부여는 RoleScope가 일괄 담당한다.
  // server-side에서 session + viewMode 쿠키를 읽어 결정 (NextAuth 미들웨어 미사용 — design.md §4 결정).
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <RoleScope>{children}</RoleScope>
          </div>
        </Providers>
      </body>
    </html>
  );
}
