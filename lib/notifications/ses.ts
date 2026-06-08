/**
 * AWS SES v2 — 이메일 발송.
 *
 * Phase 1: oa-marketing 키 재사용. noreply@oapms.com (도메인 검증 완료).
 * 발송 실패는 호출부에서 처리 (fire-and-forget 아님 — 사용자 가시 알림이라 결과 필요).
 *
 * 자격증명: `SES_ACCESS_KEY_ID`/`SES_SECRET_ACCESS_KEY` (cross-account IAM User).
 * S3와 분리 — S3는 EC2 IAM Role 사용. 자세한 이유는 lib/env.ts 주석 참고.
 *
 * SES 키가 비어있으면 console.log로 stub 처리하고 ok 반환.
 */

import {
  SESv2Client,
  SendEmailCommand,
  type SendEmailCommandInput,
} from '@aws-sdk/client-sesv2';
import { env } from '@/lib/env';
import { markdownToHtml } from '@/lib/editor/markdown-to-html';
import { markdownToPlain } from '@/lib/editor/markdown-to-plain';
import { extractEditorInlineImages } from '@/lib/notifications/email-images';
import { buildRawEmail } from '@/lib/notifications/raw-email';

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
  if (!env.SES_ACCESS_KEY_ID || !env.SES_SECRET_ACCESS_KEY || !sesRegion) {
    return null;
  }
  _client = new SESv2Client({
    region: sesRegion,
    credentials: {
      accessKeyId: env.SES_ACCESS_KEY_ID,
      secretAccessKey: env.SES_SECRET_ACCESS_KEY,
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
    const missing = [
      !env.SES_ACCESS_KEY_ID && 'SES_ACCESS_KEY_ID',
      !env.SES_SECRET_ACCESS_KEY && 'SES_SECRET_ACCESS_KEY',
      !(env.SES_REGION || env.AWS_REGION) && 'SES_REGION/AWS_REGION',
      !fromAddress && 'SES_FROM_EMAIL',
    ].filter(Boolean);
    // 프로덕션에서 stub은 "조용한 실패"다. 가짜 성공(ok:true)으로 로그를
    // 'sent'로 남기면 미발송이 가려진다. → 프로덕션은 실패로 표면화한다.
    if (env.NODE_ENV === 'production') {
      const error = `SES 미설정으로 발송 불가 (누락: ${missing.join(', ')})`;
      console.error('[SES] 발송 차단 —', error, { to: input.to, subject: input.subject });
      return { ok: false, error };
    }
    console.log('[EMAIL STUB] (개발: AWS 키 또는 SES_FROM_EMAIL 미설정)', {
      to: input.to,
      subject: input.subject,
      missing,
    });
    return { ok: true, messageId: 'stub-' + Date.now(), stub: true };
  }

  if (!html) {
    return { ok: false, error: 'html 또는 markdown 본문이 필요합니다' };
  }

  const toAddresses = Array.isArray(input.to) ? input.to : [input.to];

  // 에디터 본문 이미지(`/api/files/view?key=...` 인증 프록시)는 수신자가 비로그인이라
  // 그대로 보내면 깨진다. → S3에서 받아 CID 인라인 첨부로 동봉하고 본문 src를 cid:로 치환.
  const { html: inlinedHtml, images } = await extractEditorInlineImages(html);

  // 인라인 이미지가 있으면 raw MIME(multipart/related), 없으면 기존 Simple 발송.
  const params: SendEmailCommandInput =
    images.length > 0
      ? {
          FromEmailAddress: fromAddress,
          Destination: { ToAddresses: toAddresses },
          Content: {
            Raw: {
              Data: buildRawEmail({
                from: fromAddress,
                to: toAddresses,
                subject: input.subject,
                html: inlinedHtml,
                text,
                images,
              }),
            },
          },
        }
      : {
          FromEmailAddress: fromAddress,
          Destination: { ToAddresses: toAddresses },
          Content: {
            Simple: {
              Subject: { Data: input.subject, Charset: 'UTF-8' },
              Body: {
                Html: { Data: inlinedHtml, Charset: 'UTF-8' },
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
