'use server';

/**
 * 메일&문자 발송 (툴 박스) Server Actions — major-overhaul P7.
 *
 * - 매니저+어드민. 발송 이력은 notification_logs(채널별) + activity_logs(사유·건수).
 * - 메일: AWS SES (발신 as@oapms.com). 문자: Solapi.
 * - 수신자 선택: 호텔별 연락처 조회(getHotelContactsAction) + 직접 입력.
 */

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sql } from 'drizzle-orm';

import { db } from '@/db';
import { requireRole } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import { notifyEmail, notifySms } from '@/lib/notifications';
import { getHotelById, listStaffByHotel } from '@/lib/services/users';
import { runClaudeText } from '@/lib/ai/anthropic-client';
import { markdownToHtml } from '@/lib/editor/markdown-to-html';
import { markdownToPlain } from '@/lib/editor/markdown-to-plain';
import {
  buildMailFooterHtml,
  buildMailFooterText,
  classifySms,
  substituteVars,
  type MessageVars,
} from '@/lib/messaging/format';

/** 메일 발신 도메인 (고정). 앞부분(local part)만 사용자 입력. */
const MAIL_DOMAIN = 'oapms.com';
/** 발신자 앞부분 기본값 / 검증 정규식. */
const DEFAULT_MAIL_LOCAL = 'as';
const MAIL_LOCAL_RE = /^[a-zA-Z0-9._-]{1,64}$/;
/** 1회 최대 수신자 수 (오발송·과금 방지). */
const MAX_RECIPIENTS = 200;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function dedupe(list: string[]): string[] {
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))];
}

/** 발신자 앞부분 → as@oapms.com 형태 완성. 잘못된 값은 기본값으로 폴백. */
function resolveMailFrom(local?: string | null): string {
  const l = (local ?? '').trim();
  const safe = MAIL_LOCAL_RE.test(l) ? l : DEFAULT_MAIL_LOCAL;
  return `${safe}@${MAIL_DOMAIN}`;
}

/** 구조화 수신자 — 주소 + 업체명(표시용) + 치환 변수 값. */
const RecipientSchema = z.object({
  address: z.string(),
  company: z.string().nullable().optional(),
  vars: z
    .object({
      업체명: z.string().nullable().optional(),
      담당자명: z.string().nullable().optional(),
      연락처: z.string().nullable().optional(),
      호텔명: z.string().nullable().optional(),
    })
    .optional(),
});
export type SendRecipient = z.infer<typeof RecipientSchema>;

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
  recipients: z.array(RecipientSchema).min(1).max(MAX_RECIPIENTS),
  fromLocal: z.string().optional(),
  subject: z.string().min(1).max(200),
  markdown: z.string().min(1).max(50000),
  reason: z.string().max(500).optional(),
  ticketId: z.string().uuid().nullable().optional(),
});

/** 메일 일괄 발송 (SES) — 수신자별 변수 치환 + 푸터 자동 첨부 + batch 기록. */
export async function sendBulkEmailAction(input: {
  recipients: SendRecipient[];
  fromLocal?: string;
  subject: string;
  markdown: string;
  reason?: string;
  ticketId?: string | null;
}): Promise<{ ok: boolean; sent?: number; failed?: number; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = EmailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: '제목·본문·수신자를 확인하세요' };
  }
  // 주소 기준 중복 제거 + 유효성.
  const seen = new Set<string>();
  const valid = parsed.data.recipients.filter((r) => {
    const a = r.address.trim();
    if (!a || seen.has(a) || !EMAIL_RE.test(a)) return false;
    seen.add(a);
    return true;
  });
  if (valid.length === 0) {
    return { ok: false, message: '유효한 이메일 주소가 없습니다' };
  }

  const from = resolveMailFrom(parsed.data.fromLocal);
  const batchId = randomUUID();
  const footerHtml = buildMailFooterHtml();
  const footerText = buildMailFooterText();

  let sent = 0;
  let failed = 0;
  for (const r of valid) {
    const vars: MessageVars = r.vars ?? {};
    const subject = substituteVars(parsed.data.subject, vars);
    const bodyMd = substituteVars(parsed.data.markdown, vars);
    const html = markdownToHtml(bodyMd) + footerHtml;
    const text = markdownToPlain(bodyMd) + footerText;
    const res = await notifyEmail(
      { to: r.address.trim(), subject, html, text, from },
      {
        eventKey: 'manual.email',
        ticketId: parsed.data.ticketId ?? null,
        batchId,
        // 메시지함 조회용: 원본 템플릿(치환 전) + 업체명 + 유형 보존.
        extraPayload: {
          subject: parsed.data.subject,
          body: parsed.data.markdown,
          reason: parsed.data.reason ?? null,
          company: r.company ?? null,
          msgType: 'email',
          from,
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
      batchId,
      from,
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
  recipients: z.array(RecipientSchema).min(1).max(MAX_RECIPIENTS),
  subject: z.string().max(40).optional(),
  text: z.string().min(1).max(2000),
  reason: z.string().max(500).optional(),
  ticketId: z.string().uuid().nullable().optional(),
});

/** 문자 일괄 발송 (Solapi) — 제목(선택)·수신자별 변수 치환·SMS/LMS 판정·batch 기록. */
export async function sendBulkSmsAction(input: {
  recipients: SendRecipient[];
  subject?: string;
  text: string;
  reason?: string;
  ticketId?: string | null;
}): Promise<{ ok: boolean; sent?: number; failed?: number; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = SmsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: '본문·수신자를 확인하세요' };
  }
  // 주소(전화번호) 정규화 + 중복 제거 + 유효성. vars/company는 정규화 주소에 매핑.
  const seen = new Set<string>();
  const valid: SendRecipient[] = [];
  for (const r of parsed.data.recipients) {
    const digits = r.address.replace(/[^0-9]/g, '');
    if (digits.length < 9 || digits.length > 11 || seen.has(digits)) continue;
    seen.add(digits);
    valid.push({ ...r, address: digits });
  }
  if (valid.length === 0) {
    return { ok: false, message: '유효한 전화번호가 없습니다' };
  }

  const subject = parsed.data.subject?.trim() || undefined;
  const batchId = randomUUID();
  // 유형은 batch 단위로 한 번 판정(템플릿 기준) → 메시지함 대표 유형 표시 일관성 보장.
  // (수신자별 변수 치환으로 byte가 미세 변동해도 batch 표시는 동일하게 유지)
  const msgType = classifySms({
    text: parsed.data.text,
    hasSubject: Boolean(subject),
  });

  let sent = 0;
  let failed = 0;
  for (const r of valid) {
    const vars: MessageVars = r.vars ?? {};
    const text = substituteVars(parsed.data.text, vars);
    const subj = subject ? substituteVars(subject, vars) : undefined;
    const res = await notifySms(
      { to: r.address, text, subject: subj },
      {
        eventKey: 'manual.sms',
        ticketId: parsed.data.ticketId ?? null,
        batchId,
        extraPayload: {
          subject: subject ?? null,
          text: parsed.data.text,
          reason: parsed.data.reason ?? null,
          company: r.company ?? null,
          msgType,
        },
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
      batchId,
      recipients: valid.length,
      sent,
      failed,
      subject: subject ?? null,
      reason: parsed.data.reason ?? null,
    },
  });
  return { ok: true, sent, failed };
}

// ─────────────────────────────────────────────────────────────────────
// 메시지함 (발송 묶음 단위 조회 — batch_id 보유 신규 발송분만)
// ─────────────────────────────────────────────────────────────────────

/** 메시지함 리스트 1행 = 발송 묶음 1건. */
export type MessageBatchItem = {
  batchId: string;
  channel: 'email' | 'sms';
  /** 메일: email, 문자: sms/lms/mms. */
  msgType: 'email' | 'sms' | 'lms' | 'mms';
  createdAt: string;
  total: number;
  success: number;
  failed: number;
  subject: string | null;
  body: string;
  reason: string | null;
};

export type BatchRecipient = {
  address: string;
  company: string | null;
  status: 'sent' | 'failed' | 'retry';
};

const MessageBoxQuerySchema = z.object({
  // 전체 / 메일 / 문자SMS / 문자LMS / 문자MMS
  type: z.enum(['all', 'email', 'sms', 'lms', 'mms']).default('all'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  company: z.string().max(100).optional(),
  email: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20),
});

/** KST 날짜 문자열(YYYY-MM-DD)을 그 날의 시작/끝 Date로. */
function kstDayStart(d: string): Date | null {
  const m = /^\d{4}-\d{2}-\d{2}$/.test(d.trim());
  return m ? new Date(`${d.trim()}T00:00:00+09:00`) : null;
}
function kstDayEnd(d: string): Date | null {
  const m = /^\d{4}-\d{2}-\d{2}$/.test(d.trim());
  return m ? new Date(`${d.trim()}T23:59:59.999+09:00`) : null;
}

/** 메시지함 — 발송 묶음 목록 (검색·페이지네이션). */
export async function listMessageBatchesAction(input?: {
  type?: 'all' | 'email' | 'sms' | 'lms' | 'mms';
  dateFrom?: string;
  dateTo?: string;
  company?: string;
  email?: string;
  phone?: string;
  page?: number;
  pageSize?: 20 | 50 | 100;
}): Promise<{
  ok: boolean;
  items?: MessageBatchItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
}> {
  await requireRole(['manager', 'admin']);
  if (!db) return { ok: true, items: [], total: 0, page: 1, pageSize: 20 };

  const q = MessageBoxQuerySchema.safeParse(input ?? {});
  if (!q.success) return { ok: false, message: '잘못된 조회 조건' };
  const { type, dateFrom, dateTo, company, email, phone, page, pageSize } = q.data;

  // 행 단위 필터(matched 서브쿼리). 한 batch 내 일부 행만 매칭돼도 batch 전체를 집계.
  const conds = [
    sql`batch_id is not null`,
    sql`template_event_key in ('manual.email','manual.sms')`,
  ];
  const from = dateFrom ? kstDayStart(dateFrom) : null;
  const to = dateTo ? kstDayEnd(dateTo) : null;
  if (from) conds.push(sql`created_at >= ${from}`);
  if (to) conds.push(sql`created_at <= ${to}`);
  if (type === 'email') conds.push(sql`channel = 'email'`);
  else if (type === 'sms') conds.push(sql`payload->>'msgType' = 'sms'`);
  else if (type === 'lms') conds.push(sql`payload->>'msgType' = 'lms'`);
  else if (type === 'mms') conds.push(sql`payload->>'msgType' = 'mms'`);
  if (company && company.trim())
    conds.push(sql`payload->>'company' ilike ${'%' + company.trim() + '%'}`);
  if (email && email.trim())
    conds.push(sql`channel = 'email' and to_address ilike ${'%' + email.trim() + '%'}`);
  if (phone && phone.trim()) {
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits) conds.push(sql`channel = 'sms' and to_address ilike ${'%' + digits + '%'}`);
  }
  const whereSql = sql.join(conds, sql` and `);

  try {
    const countRes = await db.execute<{ count: number }>(sql`
      select count(distinct batch_id)::int as count
      from notification_logs
      where ${whereSql}
    `);
    const total = Number(countRes.rows[0]?.count ?? 0);

    const offset = (page - 1) * pageSize;
    const res = await db.execute<{
      batchId: string;
      channel: string;
      msgType: string | null;
      createdAt: string;
      total: number;
      success: number;
      failed: number;
      subject: string | null;
      body: string | null;
      reason: string | null;
    }>(sql`
      with matched as (
        select distinct batch_id from notification_logs where ${whereSql}
      )
      select
        batch_id as "batchId",
        (array_agg(channel))[1] as channel,
        (array_agg(payload->>'msgType'))[1] as "msgType",
        min(created_at) as "createdAt",
        count(*)::int as total,
        count(*) filter (where status = 'sent')::int as success,
        count(*) filter (where status in ('failed','retry'))::int as failed,
        (array_agg(payload->>'subject'))[1] as subject,
        (array_agg(coalesce(payload->>'body', payload->>'text')))[1] as body,
        (array_agg(payload->>'reason'))[1] as reason
      from notification_logs
      where batch_id in (select batch_id from matched)
      group by batch_id
      order by min(created_at) desc
      limit ${pageSize} offset ${offset}
    `);

    const items: MessageBatchItem[] = res.rows.map((r) => {
      const ch: 'email' | 'sms' = r.channel === 'email' ? 'email' : 'sms';
      const mt =
        r.msgType === 'email' || r.msgType === 'sms' || r.msgType === 'lms' || r.msgType === 'mms'
          ? r.msgType
          : ch === 'email'
            ? 'email'
            : 'sms';
      return {
        batchId: r.batchId,
        channel: ch,
        msgType: mt,
        createdAt: new Date(r.createdAt).toISOString(),
        total: Number(r.total ?? 0),
        success: Number(r.success ?? 0),
        failed: Number(r.failed ?? 0),
        subject: r.subject ?? null,
        body: r.body ?? '',
        reason: r.reason && r.reason.length > 0 ? r.reason : null,
      };
    });

    return { ok: true, items, total, page, pageSize };
  } catch (err) {
    console.error('[listMessageBatchesAction] 실패:', err);
    return { ok: false, message: '메시지함 조회 실패' };
  }
}

/** 발송 묶음의 수신자 목록 (총발송 팝업용). */
export async function getBatchRecipientsAction(batchId: string): Promise<{
  ok: boolean;
  recipients?: BatchRecipient[];
  message?: string;
}> {
  await requireRole(['manager', 'admin']);
  if (!db) return { ok: true, recipients: [] };
  if (!z.string().uuid().safeParse(batchId).success) {
    return { ok: false, message: '잘못된 batch' };
  }
  try {
    const res = await db.execute<{
      address: string | null;
      company: string | null;
      status: 'sent' | 'failed' | 'retry';
    }>(sql`
      select to_address as address, payload->>'company' as company, status
      from notification_logs
      where batch_id = ${batchId}
      order by created_at asc
    `);
    const recipients: BatchRecipient[] = res.rows.map((r) => ({
      address: r.address ?? '',
      company: r.company && r.company.length > 0 ? r.company : null,
      status: r.status,
    }));
    return { ok: true, recipients };
  } catch (err) {
    console.error('[getBatchRecipientsAction] 실패:', err);
    return { ok: false, message: '수신자 조회 실패' };
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
