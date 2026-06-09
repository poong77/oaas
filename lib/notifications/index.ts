/**
 * 알림 발송 + `notification_logs` 자동 기록 헬퍼.
 *
 * 모든 호출은 fire-and-forget으로 logs를 INSERT한다 — 발송 실패가 메인 로직을 깨면 안 됨.
 * 호출부에서는 await로 결과를 받아도 되지만 logs는 별도 비동기로 기록된다.
 */

import 'server-only';
import { db } from '@/db';
import { notificationLogs } from '@/db/schema';
import {
  sendSms,
  type SendSmsInput,
  type SendSmsResult,
} from './solapi';
import {
  sendEmail,
  type SendEmailInput,
  type SendEmailResult,
} from './ses';
import {
  sendSlack,
  type SendSlackInput,
  type SendSlackResult,
} from './slack';

export type NotifyMeta = {
  eventKey: string;
  ticketId?: string | null;
  /** 일괄 발송 묶음 id (메시지함 그룹핑용). 수동 발송에만 지정. */
  batchId?: string | null;
  /** 로그 payload에 병합할 추가 필드 (예: 수동 발송 본문). */
  extraPayload?: Record<string, unknown>;
};

// ─────────────────────────────────────────────────────────────────────
// 공통 로그 헬퍼
// ─────────────────────────────────────────────────────────────────────

function recordLog(input: {
  templateEventKey: string;
  channel: 'sms' | 'email' | 'slack';
  toAddress: string | null;
  payload: Record<string, unknown>;
  status: 'sent' | 'failed';
  errorMessage?: string | null;
  relatedTicketId?: string | null;
  batchId?: string | null;
}): void {
  if (!db) {
    console.log('[notification.log STUB]', input);
    return;
  }
  Promise.resolve()
    .then(async () => {
      await db!.insert(notificationLogs).values({
        templateEventKey: input.templateEventKey,
        channel: input.channel,
        toAddress: input.toAddress,
        payload: input.payload,
        status: input.status,
        errorMessage: input.errorMessage ?? null,
        relatedTicketId: input.relatedTicketId ?? null,
        batchId: input.batchId ?? null,
        sentAt: input.status === 'sent' ? new Date() : null,
      });
    })
    .catch((err) => {
      console.warn(
        `[notification.log] event=${input.templateEventKey} 기록 실패:`,
        err instanceof Error ? err.message : err,
      );
    });
}

// ─────────────────────────────────────────────────────────────────────
// 채널별 alias — 자동 로그 + 같은 시그니처
// ─────────────────────────────────────────────────────────────────────

export async function notifySms(
  input: SendSmsInput,
  meta: NotifyMeta,
): Promise<SendSmsResult> {
  const result = await sendSms(input);
  recordLog({
    templateEventKey: meta.eventKey,
    channel: 'sms',
    toAddress: input.to,
    payload: { text: input.text, ...meta.extraPayload },
    status: result.ok ? 'sent' : 'failed',
    errorMessage: result.ok ? null : result.error,
    relatedTicketId: meta.ticketId ?? null,
    batchId: meta.batchId ?? null,
  });
  return result;
}

export async function notifyEmail(
  input: SendEmailInput,
  meta: NotifyMeta,
): Promise<SendEmailResult> {
  const result = await sendEmail(input);
  const to = Array.isArray(input.to) ? input.to.join(',') : input.to;
  recordLog({
    templateEventKey: meta.eventKey,
    channel: 'email',
    toAddress: to,
    payload: { subject: input.subject, ...meta.extraPayload },
    status: result.ok ? 'sent' : 'failed',
    errorMessage: result.ok ? null : result.error,
    relatedTicketId: meta.ticketId ?? null,
    batchId: meta.batchId ?? null,
  });
  return result;
}

export async function notifySlack(
  input: SendSlackInput,
  meta: NotifyMeta,
): Promise<SendSlackResult> {
  const result = await sendSlack(input);
  recordLog({
    templateEventKey: meta.eventKey,
    channel: 'slack',
    toAddress: input.channel,
    payload: { fallbackText: input.fallbackText },
    status: result.ok ? 'sent' : 'failed',
    errorMessage: result.ok ? null : result.error,
    relatedTicketId: meta.ticketId ?? null,
  });
  return result;
}
