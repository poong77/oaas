/**
 * 솔라피 SMS — Phase 1 stub.
 *
 * SOLAPI_API_KEY가 비어있으면 console.log로 출력만 한다 (실 발송 X).
 * TODO(phase-1-temp): 키 발급 후 `solapi` SDK 정식 연동.
 */

import { env } from '@/lib/env';

export type SendSmsInput = {
  to: string;
  text: string;
};

export type SendSmsResult =
  | { ok: true; messageId: string; stub?: boolean }
  | { ok: false; error: string };

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  if (!env.SOLAPI_API_KEY || !env.SOLAPI_API_SECRET || !env.SOLAPI_SENDER) {
    console.log('[SMS STUB]', { to: input.to, text: input.text });
    return { ok: true, messageId: 'stub-sms-' + Date.now(), stub: true };
  }

  // TODO(phase-1-temp): 실제 솔라피 SDK 연동.
  // 현재는 환경변수가 모두 채워져 있어도 stub 처리 (SDK 미설치).
  console.log('[SMS PENDING-SDK]', { to: input.to, text: input.text });
  return { ok: true, messageId: 'pending-' + Date.now(), stub: true };
}
