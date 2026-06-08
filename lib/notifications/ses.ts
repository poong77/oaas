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
import { markdownToHtml } from '@/lib/editor/markdown-to-html';
import { markdownToPlain } from '@/lib/editor/markdown-to-plain';

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  /**
   * HTML 본문. `markdown`이 함께 또는 단독 제공된 경우 무시되고 변환 결과 사용.
   */
  html?: string;
  text?: string;
  /**
   * 마크다운 본문 (RichEditor 호출자 편의). 제공 시 자동으로 html + text(미지정 시) 생성.
   */
  markdown?: string;
  /** 미지정 시 env.SES_FROM_EMAIL */
  from?: string;
};

export type SendEmailResult =
  | { ok: true; messageId: string; stub?: boolean }
  | { ok: false; error: string };

let _client: SESv2Client | null = null;

function getClient(): SESv2Client | null {
  if (_client) return _client;
  // SES 전용 리전 우선 (도메인 인증이 S3와 다른 리전에 있을 수 있음).
  const sesRegion = env.SES_REGION || env.AWS_REGION;
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !sesRegion) {
    return null;
  }
  _client = new SESv2Client({
    region: sesRegion,
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

  // 본문 변환: markdown 제공 시 우선, 없으면 html + text 그대로
  const html = input.markdown
    ? markdownToHtml(input.markdown)
    : (input.html ?? '');
  const text = input.text ?? (input.markdown ? markdownToPlain(input.markdown) : undefined);

  if (!client || !fromAddress) {
    console.log('[EMAIL STUB] (AWS 키 또는 SES_FROM_EMAIL 미설정)', {
      to: input.to,
      subject: input.subject,
    });
    return { ok: true, messageId: 'stub-' + Date.now(), stub: true };
  }

  if (!html) {
    return { ok: false, error: 'html 또는 markdown 본문이 필요합니다' };
  }

  const toAddresses = Array.isArray(input.to) ? input.to : [input.to];

  const params: SendEmailCommandInput = {
    FromEmailAddress: fromAddress,
    Destination: { ToAddresses: toAddresses },
    Content: {
      Simple: {
        Subject: { Data: input.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: html, Charset: 'UTF-8' },
          ...(text ? { Text: { Data: text, Charset: 'UTF-8' } } : {}),
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
