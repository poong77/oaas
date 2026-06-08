'use server';

/**
 * 메일&문자 발송 (툴 박스) Server Actions — major-overhaul P7.
 *
 * - 매니저+어드민. 발송 이력은 notification_logs(채널별) + activity_logs(사유·건수).
 * - 메일: AWS SES (발신 as@oapms.com). 문자: Solapi.
 * - 수신자 선택: 호텔별 연락처 조회(getHotelContactsAction) + 직접 입력.
 */

import { z } from 'zod';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { notificationLogs } from '@/db/schema';
import { requireRole } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import { notifyEmail, notifySms } from '@/lib/notifications';
import { getHotelById, listStaffByHotel } from '@/lib/services/users';
import { runClaudeText } from '@/lib/ai/anthropic-client';

/** 메일 발신 주소 (P7 요구사항 고정). */
const MAIL_FROM = 'as@oapms.com';
/** 1회 최대 수신자 수 (오발송·과금 방지). */
const MAX_RECIPIENTS = 200;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function dedupe(list: string[]): string[] {
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))];
}

/** 호텔 연락처 조회 — 직원(users) + 호텔 추가 이메일/연락처. */
export async function getHotelContactsAction(hotelId: string): Promise<{
  ok: boolean;
  emails?: string[];
  phones?: string[];
  people?: Array<{ name: string; email: string | null; phone: string | null }>;
  message?: string;
}> {
  await requireRole(['manager', 'admin']);
  if (!z.string().uuid().safeParse(hotelId).success) {
    return { ok: false, message: '잘못된 호텔' };
  }
  try {
    const [hotel, staff] = await Promise.all([
      getHotelById(hotelId),
      listStaffByHotel(hotelId),
    ]);
    const people = staff
      .filter((u) => u.isActive)
      .map((u) => ({ name: u.name, email: u.email, phone: u.phone }));

    const emails = dedupe([
      ...people.map((p) => p.email ?? ''),
      ...(hotel?.extraEmails ?? []),
    ]);
    const phones = dedupe([
      ...people.map((p) => p.phone ?? ''),
      ...(hotel?.phone ? [hotel.phone] : []),
      ...((hotel?.extraContacts ?? []).map((c) => c.phone ?? '')),
    ]);
    return { ok: true, emails, phones, people };
  } catch (err) {
    console.error('[getHotelContactsAction] 실패:', err);
    return { ok: false, message: '연락처 조회 실패' };
  }
}

const EmailSchema = z.object({
  recipients: z.array(z.string()).min(1).max(MAX_RECIPIENTS),
  subject: z.string().min(1).max(200),
  markdown: z.string().min(1).max(50000),
  reason: z.string().max(500).optional(),
  ticketId: z.string().uuid().nullable().optional(),
});

/** 메일 일괄 발송 (SES). */
export async function sendBulkEmailAction(input: {
  recipients: string[];
  subject: string;
  markdown: string;
  reason?: string;
  ticketId?: string | null;
}): Promise<{ ok: boolean; sent?: number; failed?: number; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = EmailSchema.safeParse({
    ...input,
    recipients: dedupe(input.recipients ?? []),
  });
  if (!parsed.success) {
    return { ok: false, message: '제목·본문·수신자를 확인하세요' };
  }
  const valid = parsed.data.recipients.filter((r) => EMAIL_RE.test(r));
  if (valid.length === 0) {
    return { ok: false, message: '유효한 이메일 주소가 없습니다' };
  }

  let sent = 0;
  let failed = 0;
  for (const to of valid) {
    const res = await notifyEmail(
      {
        to,
        subject: parsed.data.subject,
        markdown: parsed.data.markdown,
        from: MAIL_FROM,
      },
      {
        eventKey: 'manual.email',
        ticketId: parsed.data.ticketId ?? null,
        // 이력 탭에서 본문 조회·복사가 가능하도록 본문/사유를 로그에 보존.
        extraPayload: {
          body: parsed.data.markdown,
          reason: parsed.data.reason ?? null,
        },
      },
    );
    if (res.ok) sent += 1;
    else failed += 1;
  }

  logActivity({
    userId: user.id,
    action: 'messaging.email.send',
    targetType: 'messaging',
    targetId: parsed.data.ticketId ?? null,
    payload: {
      channel: 'email',
      recipients: valid.length,
      sent,
      failed,
      subject: parsed.data.subject,
      reason: parsed.data.reason ?? null,
    },
  });
  return { ok: true, sent, failed };
}

const SmsSchema = z.object({
  recipients: z.array(z.string()).min(1).max(MAX_RECIPIENTS),
  text: z.string().min(1).max(2000),
  reason: z.string().max(500).optional(),
  ticketId: z.string().uuid().nullable().optional(),
});

/** 문자 일괄 발송 (Solapi). */
export async function sendBulkSmsAction(input: {
  recipients: string[];
  text: string;
  reason?: string;
  ticketId?: string | null;
}): Promise<{ ok: boolean; sent?: number; failed?: number; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = SmsSchema.safeParse({
    ...input,
    recipients: dedupe(input.recipients ?? []),
  });
  if (!parsed.success) {
    return { ok: false, message: '본문·수신자를 확인하세요' };
  }
  const valid = parsed.data.recipients
    .map((r) => r.replace(/[^0-9]/g, ''))
    .filter((r) => r.length >= 9 && r.length <= 11);
  if (valid.length === 0) {
    return { ok: false, message: '유효한 전화번호가 없습니다' };
  }

  let sent = 0;
  let failed = 0;
  for (const to of valid) {
    const res = await notifySms(
      { to, text: parsed.data.text },
      {
        eventKey: 'manual.sms',
        ticketId: parsed.data.ticketId ?? null,
        extraPayload: { reason: parsed.data.reason ?? null },
      },
    );
    if (res.ok) sent += 1;
    else failed += 1;
  }

  logActivity({
    userId: user.id,
    action: 'messaging.sms.send',
    targetType: 'messaging',
    targetId: parsed.data.ticketId ?? null,
    payload: {
      channel: 'sms',
      recipients: valid.length,
      sent,
      failed,
      reason: parsed.data.reason ?? null,
    },
  });
  return { ok: true, sent, failed };
}

// ─────────────────────────────────────────────────────────────────────
// 지난 발송 이력 (메일&문자 툴박스 수동 발송분)
// ─────────────────────────────────────────────────────────────────────

/** 이력 1건 (UI용 평탄화). */
export type MessagingHistoryItem = {
  id: string;
  channel: 'email' | 'sms';
  toAddress: string;
  subject: string | null;
  body: string;
  reason: string | null;
  status: 'sent' | 'failed' | 'retry';
  errorMessage: string | null;
  createdAt: string;
};

const MANUAL_EVENT_KEYS = ['manual.email', 'manual.sms'] as const;

const HistoryQuerySchema = z.object({
  channel: z.enum(['all', 'email', 'sms']).default('all'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(30),
});

/** 메일&문자 툴박스에서 발송한 지난 이력 조회 (수동 발송분만, 최신순). */
export async function listMessagingHistoryAction(input?: {
  channel?: 'all' | 'email' | 'sms';
  page?: number;
  pageSize?: number;
}): Promise<{
  ok: boolean;
  items?: MessagingHistoryItem[];
  hasMore?: boolean;
  message?: string;
}> {
  await requireRole(['manager', 'admin']);
  if (!db) return { ok: true, items: [], hasMore: false };

  const q = HistoryQuerySchema.safeParse(input ?? {});
  if (!q.success) return { ok: false, message: '잘못된 조회 조건' };
  const { channel, page, pageSize } = q.data;

  const eventFilter =
    channel === 'email'
      ? eq(notificationLogs.templateEventKey, 'manual.email')
      : channel === 'sms'
        ? eq(notificationLogs.templateEventKey, 'manual.sms')
        : inArray(notificationLogs.templateEventKey, [...MANUAL_EVENT_KEYS]);

  try {
    // hasMore 판단을 위해 pageSize + 1건 조회.
    const rows = await db
      .select()
      .from(notificationLogs)
      .where(and(eventFilter))
      .orderBy(desc(notificationLogs.createdAt))
      .limit(pageSize + 1)
      .offset((page - 1) * pageSize);

    const hasMore = rows.length > pageSize;
    const items: MessagingHistoryItem[] = rows.slice(0, pageSize).map((r) => {
      const payload = (r.payload ?? {}) as Record<string, unknown>;
      const channelKind: 'email' | 'sms' =
        r.channel === 'email' ? 'email' : 'sms';
      const subject =
        typeof payload.subject === 'string' ? payload.subject : null;
      // 메일: body 우선(과거 로그는 미보존 → '' ), 문자: text.
      const body =
        typeof payload.body === 'string'
          ? payload.body
          : typeof payload.text === 'string'
            ? payload.text
            : '';
      const reason =
        typeof payload.reason === 'string' && payload.reason.length > 0
          ? payload.reason
          : null;
      return {
        id: r.id,
        channel: channelKind,
        toAddress: r.toAddress ?? '',
        subject,
        body,
        reason,
        status: r.status,
        errorMessage: r.errorMessage ?? null,
        createdAt: (r.createdAt ?? new Date()).toISOString(),
      };
    });

    return { ok: true, items, hasMore };
  } catch (err) {
    console.error('[listMessagingHistoryAction] 실패:', err);
    return { ok: false, message: '이력 조회 실패' };
  }
}

/** AI 메일 본문 작성·최적화. */
export async function aiWriteEmailAction(input: {
  subject: string;
  draft: string;
  instruction?: string;
}): Promise<{ ok: boolean; markdown?: string; message?: string }> {
  await requireRole(['manager', 'admin']);
  const subject = (input.subject ?? '').slice(0, 200).trim();
  const draft = (input.draft ?? '').slice(0, 8000).trim();
  if (subject.length + draft.length < 3) {
    return { ok: false, message: '제목 또는 초안을 입력해주세요' };
  }
  try {
    const system =
      '너는 호텔 솔루션 고객지원팀의 이메일 작성 도우미다. 주어진 제목과 초안을 ' +
      '정중하고 명확한 한국어 안내 메일 본문(마크다운)으로 다듬는다. 인사·핵심 안내·' +
      '맺음말 구조를 갖추되 과장 없이 간결하게. 본문 마크다운만 출력(제목/코드펜스 없이).';
    const user = [
      `# 제목\n${subject || '(제목 없음)'}`,
      input.instruction ? `# 추가 지침\n${input.instruction.slice(0, 500)}` : '',
      `# 초안\n${draft || '(초안 없음 — 제목 기반으로 작성)'}`,
    ]
      .filter(Boolean)
      .join('\n\n');
    const out = await runClaudeText({
      system,
      user,
      bucket: 'messaging-email-write',
      maxTokens: 1200,
    });
    return { ok: true, markdown: out.trim() };
  } catch (err) {
    console.error('[aiWriteEmailAction] 실패:', err);
    return { ok: false, message: 'AI 작성 중 오류가 발생했습니다' };
  }
}
