/**
 * 챗봇 메타 (server-only).
 *
 * Client Component인 ChatbotFab가 `env.OACHAT_EMBED_URL`을 직접 import하면
 * server-only chain이 깨질 수 있어 RSC layout에서 한 번 읽어 prop으로 전달한다.
 *
 * 이 모듈은 env만 노출하는 단순 패스스루.
 */

import 'server-only';
import { env } from '@/lib/env';

export function getChatbotEmbedUrl(): string {
  return env.OACHAT_EMBED_URL.trim();
}

export function isChatbotConfigured(): boolean {
  const url = env.OACHAT_EMBED_URL.trim();
  return url.length > 0 && (url.startsWith('http://') || url.startsWith('https://'));
}
