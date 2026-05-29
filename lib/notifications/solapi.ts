/**
 * 솔라피 SMS — Phase 5에서 실 SDK 연동으로 교체.
 *
 * SOLAPI_API_KEY / SOLAPI_API_SECRET / SOLAPI_SENDER가 비어있으면
 * console.log로 stub 처리하고 ok 반환 (빌드·테스트 환경 안전).
 *
 * SDK 패키지명: `solapi` (npm). v5+ 의존성.
 */

import { env } from '@/lib/env';
import { markdownToPlain } from '@/lib/editor/markdown-to-plain';

export type SendSmsInput = {
  to: string;
  /** SMS 본문. 마크다운이 섞여 있어도 발송 직전 plain text로 자동 변환됨. */
  text: string;
};

export type SendSmsResult =
  | { ok: true; messageId: string; stub?: boolean }
  | { ok: false; error: string };

let _client: unknown | null = null;

async function getClient(): Promise<unknown | null> {
  if (_client) return _client;
  if (!env.SOLAPI_API_KEY || !env.SOLAPI_API_SECRET || !env.SOLAPI_SENDER) {
    return null;
  }
  try {
    // 동적 import: 키 미설정 시 SDK 로드 자체를 회피.
    const mod = (await import('solapi')) as unknown as {
      SolapiMessageService?: new (
        apiKey: string,
        apiSecret: string,
      ) => unknown;
      default?: {
        SolapiMessageService?: new (
          apiKey: string,
          apiSecret: string,
        ) => unknown;
      };
    };
    const Ctor =
      mod.SolapiMessageService ?? mod.default?.SolapiMessageService;
    if (!Ctor) {
      console.warn('[solapi] SDK 모듈에서 SolapiMessageService를 찾지 못함');
      return null;
    }
    _client = new Ctor(env.SOLAPI_API_KEY, env.SOLAPI_API_SECRET);
    return _client;
  } catch (err) {
    console.warn(
      '[solapi] SDK 로드 실패:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const client = (await getClient()) as
    | {
        send?: (msg: unknown) => Promise<{ groupId?: string; messageId?: string } | unknown>;
        sendOne?: (msg: unknown) => Promise<{ messageId?: string } | unknown>;
      }
    | null;

  // RichEditor 도입(Phase 1+) 후 본문에 마크다운이 섞일 수 있어 발송 직전 plain 변환.
  // 이미 plain인 입력에도 안전 (멱등).
  const safeText = markdownToPlain(input.text);

  if (!client || !env.SOLAPI_SENDER) {
    console.log('[SMS STUB]', { to: input.to, text: safeText });
    return { ok: true, messageId: 'stub-sms-' + Date.now(), stub: true };
  }

  try {
    const message = {
      to: input.to,
      from: env.SOLAPI_SENDER,
      text: safeText,
    };
    // SDK 버전에 따라 send / sendOne 호출 시그니처가 다를 수 있어 안전하게 분기.
    const result = client.send
      ? await client.send(message)
      : client.sendOne
        ? await client.sendOne(message)
        : null;
    const messageId =
      ((result as { messageId?: string })?.messageId ??
        (result as { groupId?: string })?.groupId) ||
      'unknown';
    return { ok: true, messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown sms error';
    console.error('[solapi] sendSms 실패:', msg);
    return { ok: false, error: msg };
  }
}
