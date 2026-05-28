import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import { Header } from '@/components/layout/header';
import { EmergencyBanner } from '@/components/layout/emergency-banner';
import { ChatbotFab } from '@/components/chatbot/chatbot-fab';
import { getChatbotEmbedUrl } from '@/lib/services/chatbot-meta';
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
  // server-side에서 env 읽고 Client Component에 prop 전달 (server-only chain 유지)
  const chatbotEmbedUrl = getChatbotEmbedUrl();

  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <EmergencyBanner />
            <Header />
            <main className="flex-1">{children}</main>
          </div>
          <ChatbotFab embedUrl={chatbotEmbedUrl} />
        </Providers>
      </body>
    </html>
  );
}
