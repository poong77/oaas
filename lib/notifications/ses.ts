/**
 * AWS SES v2 — 이메일 발송.
 *
 * Phase 1: oa-marketing 키 재사용. noreply@oapms.com (도메인 검증 완료).
 * 발송 실패는 호출부에서 처리 (fire-and-forget 아님 — 사용자 가시 알림이라 결과 필요).
 *
 * `AWS_ACCESS_KEY_ID`가 비어있으면 console.log로 stub 처리하고 ok 반환.
 */

import {
  SESv2Client,
  SendEmailCommand,
  type SendEmailCommandInput,
} from '@aws-sdk/client-sesv2';
import { env } from '@/lib/env';

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** 미지정 시 env.SES_FROM_EMAIL */
  from?: string;
};

export type SendEmailResult =
  | { ok: true; messageId: string; stub?: boolean }
  | { ok: false; error: string };

let _client: SESv2Client | null = null;

function getClient(): SESv2Client | null {
  if (_client) return _client;
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_REGION) {
    return null;
  }
  _client = new SESv2Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getClient();
  const fromAddress = input.from ?? env.SES_FROM_EMAIL;

  if (!client || !fromAddress) {
    console.log('[EMAIL STUB] (AWS 키 또는 SES_FROM_EMAIL 미설정)', {
      to: input.to,
      subject: input.subject,
    });
    return { ok: true, messageId: 'stub-' + Date.now(), stub: true };
  }

  const toAddresses = Array.isArray(input.to) ? input.to : [input.to];

  const params: SendEmailCommandInput = {
    FromEmailAddress: fromAddress,
    Destination: { ToAddresses: toAddresses },
    Content: {
      Simple: {
        Subject: { Data: input.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: input.html, Charset: 'UTF-8' },
          ...(input.text
            ? { Text: { Data: input.text, Charset: 'UTF-8' } }
            : {}),
        },
      },
    },
  };

  try {
    const result = await client.send(new SendEmailCommand(params));
    return { ok: true, messageId: result.MessageId ?? 'unknown' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SES unknown error';
    console.error('[SES] sendEmail 실패:', message);
    return { ok: false, error: message };
  }
}
