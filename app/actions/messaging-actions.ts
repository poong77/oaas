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
import { sql, eq, and, asc } from 'drizzle-orm';

import { db } from '@/db';
import { manualMessageTemplates } from '@/db/schema';
import { requireRole } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import { notifyEmail, notifySms } from '@/lib/notifications';
import { getHotelById, listStaffByHotel, listUsers } from '@/lib/services/users';
import { runClaudeText } from '@/lib/ai/anthropic-client';
import { markdownToHtml } from '@/lib/editor/markdown-to-html';
import { markdownToPlain } from '@/lib/editor/markdown-to-plain';
import {
  buildMailFooterHtml,
  buildMailFooterText,
  classifySms,
  extractVarNames,
  resolveRecipientVars,
  substituteAll,
  BASE_VAR_NAMES,
  type VarBinding,
  type VarSource,
} from '@/lib/messaging/format';

/** 메일 발신 도메인 (고정). 앞부분(local part)만 사용자 입력. */
const MAIL_DOMAIN = 'oapms.com';
/** 발신자 앞부분 기본값 / 검증 정규식. */
const DEFAULT_MAIL_LOCAL = 'as';
const MAIL_LOCAL_RE = /^[a-zA-Z0-9._-]{1,64}$/;
/** 1회 최대 수신자 수 (오발송·과금 방지). 활성 호텔리어 전체(236명)+여유분. */
const MAX_RECIPIENTS = 500;

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

/** 구조화 수신자 — 주소 + 업체명(표시용) + 변수 자동주입값(auto) + 엑셀열값(excel). */
const RecipientSchema = z.object({
  address: z.string(),
  company: z.string().nullable().optional(),
  /** 연락처 자동주입 값 (업체명/담당자명/연락처/호텔명 + 기타 auto 변수). */
  auto: z.record(z.string(), z.string().nullable()).optional(),
  /** 엑셀 업로드 행의 열 값 (변수명 → 값). */
  excel: z.record(z.string(), z.string().nullable()).optional(),
});
export type SendRecipient = z.infer<typeof RecipientSchema>;

/** 변수 바인딩 — 본문/제목 변수별 값 소스(MSG-15). */
const VarBindingSchema = z.object({
  name: z.string().min(1).max(40),
  source: z.enum(['auto', 'manual', 'excel']),
  value: z.string().nullable().optional(),
});

/**
 * 본문·제목에 실제 사용된 변수명에 대한 바인딩 목록을 확정.
 * 폼이 보낸 바인딩 우선, 누락분은 기본 규칙(기본변수→auto, 그 외→excel).
 */
function resolveBindings(parts: string[], provided?: VarBinding[]): VarBinding[] {
  const names = extractVarNames(...parts);
  const map = new Map((provided ?? []).map((b) => [b.name, b]));
  return names.map(
    (n) =>
      map.get(n) ?? {
        name: n,
        source: (BASE_VAR_NAMES.includes(n) ? 'auto' : 'excel') as VarSource,
      },
  );
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

/** 수신자 후보 — 검색 결과의 개별 사용자(호텔리어). */
export type RecipientUserHit = {
  id: string;
  name: string;
  hotel: string | null;
  /** 채널 주소: 이메일 모드면 email, 문자 모드면 정규화된 휴대폰. 없으면 null. */
  address: string | null;
  phone: string | null;
};

/**
 * 수신자 사용자 검색 — 이름·아이디·이메일·휴대폰·호텔명으로 호텔리어를 찾아 직접 추가용으로 반환.
 * 호텔명 검색(getHotelContactsAction)과 별개로, 담당자명 등으로 바로 찾을 때 사용.
 */
export async function searchRecipientUsersAction(input: {
  q: string;
  channel: 'email' | 'sms';
}): Promise<{ ok: boolean; users?: RecipientUserHit[]; message?: string }> {
  await requireRole(['manager', 'admin']);
  const q = (input.q ?? '').trim();
  if (q.length === 0) return { ok: true, users: [] };
  const channel = input.channel === 'sms' ? 'sms' : 'email';
  try {
    const res = await listUsers({ role: 'hotelier', isActive: true, q, page: 1, pageSize: 20 });
    const users: RecipientUserHit[] = res.items.map((u) => {
      const phone = (u.phone ?? '').replace(/[^0-9]/g, '');
      const email = (u.email ?? '').trim();
      const address =
        channel === 'email'
          ? email && EMAIL_RE.test(email)
            ? email
            : null
          : phone.length >= 9 && phone.length <= 11
            ? phone
            : null;
      return { id: u.id, name: u.name ?? '', hotel: u.hotelName ?? null, address, phone: u.phone ?? null };
    });
    return { ok: true, users };
  } catch (err) {
    console.error('[searchRecipientUsersAction] 실패:', err);
    return { ok: false, message: '사용자 검색 실패' };
  }
}

const EmailSchema = z.object({
  recipients: z.array(RecipientSchema).min(1).max(MAX_RECIPIENTS),
  fromLocal: z.string().optional(),
  fromName: z.string().max(64).optional(),
  subject: z.string().min(1).max(200),
  markdown: z.string().min(1).max(50000),
  reason: z.string().max(500).optional(),
  ticketId: z.string().uuid().nullable().optional(),
  varBindings: z.array(VarBindingSchema).optional(),
  /** 청크 분할 발송 시 묶음 유지용. 미지정 시 새로 생성. */
  batchId: z.string().uuid().optional(),
  /** 청크 발송 시 true → 개별 감사로그 생략(요약은 recordBulkSendActivityAction). */
  skipActivityLog: z.boolean().optional(),
});

/** RFC 2047 — 한글 발신자 표시명을 SES 헤더에 안전하게 인코딩. */
function encodeFromHeader(name: string | undefined, addr: string): string {
  const n = (name ?? '').trim();
  if (!n) return addr;
  // ASCII만이면 그대로, 비ASCII 포함 시 =?UTF-8?B?...?= 인코딩.
  const ascii = /^[\x20-\x7e]*$/.test(n);
  const display = ascii ? n : `=?UTF-8?B?${Buffer.from(n, 'utf8').toString('base64')}?=`;
  return `${display} <${addr}>`;
}

/** 메일 일괄 발송 (SES) — 수신자별 변수 치환 + 푸터 자동 첨부 + batch 기록. */
export async function sendBulkEmailAction(input: {
  recipients: SendRecipient[];
  fromLocal?: string;
  fromName?: string;
  subject: string;
  markdown: string;
  reason?: string;
  ticketId?: string | null;
  varBindings?: VarBinding[];
  batchId?: string;
  skipActivityLog?: boolean;
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

  const addr = resolveMailFrom(parsed.data.fromLocal);
  const from = encodeFromHeader(parsed.data.fromName, addr);
  const batchId = parsed.data.batchId ?? randomUUID();
  const footerHtml = buildMailFooterHtml();
  const footerText = buildMailFooterText();
  const bindings = resolveBindings([parsed.data.subject, parsed.data.markdown], parsed.data.varBindings);

  let sent = 0;
  let failed = 0;
  for (const r of valid) {
    const values = resolveRecipientVars(bindings, { auto: r.auto, excel: r.excel });
    const subject = substituteAll(parsed.data.subject, values);
    const bodyMd = substituteAll(parsed.data.markdown, values);
    const html = markdownToHtml(bodyMd) + footerHtml;
    const text = markdownToPlain(bodyMd) + footerText;
    const res = await notifyEmail(
      { to: r.address.trim(), subject, html, text, from },
      {
        eventKey: 'manual.email',
        ticketId: parsed.data.ticketId ?? null,
        batchId,
        // 메시지함 조회용: 원본 템플릿(치환 전) + 업체명 + 유형 + 발송자 보존.
        extraPayload: {
          subject: parsed.data.subject,
          body: parsed.data.markdown,
          reason: parsed.data.reason ?? null,
          company: r.company ?? null,
          msgType: 'email',
          from,
          fromName: parsed.data.fromName ?? null,
          by: user.name ?? null,
        },
      },
    );
    if (res.ok) sent += 1;
    else failed += 1;
  }

  if (!parsed.data.skipActivityLog) {
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
  }
  return { ok: true, sent, failed };
}

const SmsSchema = z.object({
  recipients: z.array(RecipientSchema).min(1).max(MAX_RECIPIENTS),
  // MSG-19: 제목 필수.
  subject: z.string().min(1).max(40),
  text: z.string().min(1).max(2000),
  reason: z.string().max(500).optional(),
  batchId: z.string().uuid().optional(),
  skipActivityLog: z.boolean().optional(),
  ticketId: z.string().uuid().nullable().optional(),
  varBindings: z.array(VarBindingSchema).optional(),
});

/** 문자 일괄 발송 (Solapi) — 제목(필수)·수신자별 변수 치환·SMS/LMS 판정·batch 기록. */
export async function sendBulkSmsAction(input: {
  recipients: SendRecipient[];
  subject: string;
  text: string;
  reason?: string;
  ticketId?: string | null;
  varBindings?: VarBinding[];
  batchId?: string;
  skipActivityLog?: boolean;
}): Promise<{ ok: boolean; sent?: number; failed?: number; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = SmsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: '제목·본문·수신자를 확인하세요' };
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

  const subject = parsed.data.subject.trim();
  const batchId = parsed.data.batchId ?? randomUUID();
  // 유형은 batch 단위로 한 번 판정(템플릿 기준) → 메시지함 대표 유형 표시 일관성 보장.
  // (수신자별 변수 치환으로 byte가 미세 변동해도 batch 표시는 동일하게 유지)
  const msgType = classifySms({ text: parsed.data.text, hasSubject: true });
  const bindings = resolveBindings([subject, parsed.data.text], parsed.data.varBindings);

  let sent = 0;
  let failed = 0;
  for (const r of valid) {
    const values = resolveRecipientVars(bindings, { auto: r.auto, excel: r.excel });
    const text = substituteAll(parsed.data.text, values);
    const subj = substituteAll(subject, values);
    const res = await notifySms(
      { to: r.address, text, subject: subj },
      {
        eventKey: 'manual.sms',
        ticketId: parsed.data.ticketId ?? null,
        batchId,
        extraPayload: {
          subject,
          text: parsed.data.text,
          reason: parsed.data.reason ?? null,
          company: r.company ?? null,
          msgType,
          by: user.name ?? null,
        },
      },
    );
    if (res.ok) sent += 1;
    else failed += 1;
  }

  if (!parsed.data.skipActivityLog) {
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
        subject,
        reason: parsed.data.reason ?? null,
      },
    });
  }
  return { ok: true, sent, failed };
}

/** 청크 분할 발송 완료 후 감사로그 1건만 요약 기록. */
export async function recordBulkSendActivityAction(input: {
  channel: 'email' | 'sms';
  batchId: string;
  recipients: number;
  sent: number;
  failed: number;
  subject: string;
  reason?: string | null;
  ticketId?: string | null;
}): Promise<{ ok: boolean }> {
  const user = await requireRole(['manager', 'admin']);
  if (!z.string().uuid().safeParse(input.batchId).success) return { ok: false };
  logActivity({
    userId: user.id,
    action: input.channel === 'email' ? 'messaging.email.send' : 'messaging.sms.send',
    targetType: 'messaging',
    targetId: input.ticketId ?? null,
    payload: {
      channel: input.channel,
      batchId: input.batchId,
      recipients: input.recipients,
      sent: input.sent,
      failed: input.failed,
      subject: input.subject,
      reason: input.reason ?? null,
      chunked: true,
    },
  });
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────
// 테스트 발송 (MSG-22) — 단건, batch_id 미부여(메시지함 미노출), isTest 표식
// ─────────────────────────────────────────────────────────────────────

const TestEmailSchema = z.object({
  to: z.string().email(),
  fromLocal: z.string().optional(),
  fromName: z.string().max(64).optional(),
  subject: z.string().min(1).max(200),
  markdown: z.string().min(1).max(50000),
  /** 샘플 수신자 1명 기준 해석된 변수 값 맵. */
  sampleValues: z.record(z.string(), z.string().nullable()).optional(),
});

/** 메일 테스트 발송 — 지정 주소로 1건. 샘플 변수값으로 치환. */
export async function sendTestEmailAction(input: {
  to: string;
  fromLocal?: string;
  fromName?: string;
  subject: string;
  markdown: string;
  sampleValues?: Record<string, string | null>;
}): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = TestEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: '테스트 대상·제목·본문을 확인하세요' };

  const addr = resolveMailFrom(parsed.data.fromLocal);
  const from = encodeFromHeader(parsed.data.fromName, addr);
  const values = parsed.data.sampleValues ?? {};
  const subject = substituteAll(parsed.data.subject, values);
  const bodyMd = substituteAll(parsed.data.markdown, values);
  const html = markdownToHtml(bodyMd) + buildMailFooterHtml();
  const text = markdownToPlain(bodyMd) + buildMailFooterText();

  const res = await notifyEmail(
    { to: parsed.data.to.trim(), subject: `[테스트] ${subject}`, html, text, from },
    {
      eventKey: 'manual.email.test',
      // batchId 미부여 → 메시지함 미노출
      extraPayload: { isTest: true, by: user.name ?? null, msgType: 'email' },
    },
  );
  logActivity({
    userId: user.id,
    action: 'messaging.email.test',
    targetType: 'messaging',
    targetId: null,
    payload: { to: parsed.data.to, sent: res.ok },
  });
  return res.ok ? { ok: true } : { ok: false, message: '테스트 발송 실패' };
}

const TestSmsSchema = z.object({
  to: z.string(),
  subject: z.string().min(1).max(40),
  text: z.string().min(1).max(2000),
  sampleValues: z.record(z.string(), z.string().nullable()).optional(),
});

/** 문자 테스트 발송 — 지정 번호로 1건. 샘플 변수값으로 치환. */
export async function sendTestSmsAction(input: {
  to: string;
  subject: string;
  text: string;
  sampleValues?: Record<string, string | null>;
}): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = TestSmsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: '테스트 번호·제목·본문을 확인하세요' };
  const digits = parsed.data.to.replace(/[^0-9]/g, '');
  if (digits.length < 9 || digits.length > 11) {
    return { ok: false, message: '유효한 전화번호가 아닙니다' };
  }
  const values = parsed.data.sampleValues ?? {};
  const text = substituteAll(parsed.data.text, values);
  const subj = substituteAll(parsed.data.subject, values);
  const res = await notifySms(
    { to: digits, text, subject: subj },
    {
      eventKey: 'manual.sms.test',
      extraPayload: { isTest: true, by: user.name ?? null },
    },
  );
  logActivity({
    userId: user.id,
    action: 'messaging.sms.test',
    targetType: 'messaging',
    targetId: null,
    payload: { to: digits, sent: res.ok },
  });
  return res.ok ? { ok: true } : { ok: false, message: '테스트 발송 실패' };
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
  /** 수신 대상 업체명(distinct, 표시용). MSG-23 '수신' 컬럼. */
  companies: string[];
  /** 발송자(매니저)명. MSG-23 '발송자' 컬럼. */
  senderName: string | null;
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
      companies: string[] | null;
      senderName: string | null;
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
        (array_agg(payload->>'reason'))[1] as reason,
        (array_agg(distinct payload->>'company')
          filter (where nullif(payload->>'company','') is not null)) as companies,
        (array_agg(payload->>'by') filter (where nullif(payload->>'by','') is not null))[1] as "senderName"
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
        companies: Array.isArray(r.companies) ? r.companies.filter(Boolean) : [],
        senderName: r.senderName && r.senderName.length > 0 ? r.senderName : null,
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

// ─────────────────────────────────────────────────────────────────────
// 발송 템플릿 (MSG-16) — manual_message_templates CRUD + 정렬
// ─────────────────────────────────────────────────────────────────────

export type ManualTemplate = {
  id: string;
  channel: 'email' | 'sms';
  title: string;
  memo: string | null;
  subject: string | null;
  body: string;
  fromName: string | null;
  fromLocal: string | null;
  variables: Array<{ name: string; source: VarSource }>;
  sortOrder: number;
};

const TemplateVarSchema = z.object({
  name: z.string().min(1).max(40),
  source: z.enum(['auto', 'manual', 'excel']),
});
const SaveTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  channel: z.enum(['email', 'sms']),
  title: z.string().min(1).max(120),
  memo: z.string().max(300).nullable().optional(),
  subject: z.string().max(200).nullable().optional(),
  body: z.string().min(1).max(50000),
  fromName: z.string().max(64).nullable().optional(),
  fromLocal: z.string().max(64).nullable().optional(),
  variables: z.array(TemplateVarSchema).max(20).optional(),
});

/** 발송 템플릿 목록 (정렬순). channel 미지정 시 전체. */
export async function listManualTemplatesAction(input?: {
  channel?: 'email' | 'sms';
}): Promise<{ ok: boolean; items?: ManualTemplate[]; message?: string }> {
  await requireRole(['manager', 'admin']);
  if (!db) return { ok: true, items: [] };
  try {
    const where = input?.channel
      ? and(eq(manualMessageTemplates.isActive, true), eq(manualMessageTemplates.channel, input.channel))
      : eq(manualMessageTemplates.isActive, true);
    const rows = await db
      .select()
      .from(manualMessageTemplates)
      .where(where)
      .orderBy(asc(manualMessageTemplates.sortOrder), asc(manualMessageTemplates.createdAt));
    const items: ManualTemplate[] = rows.map((r) => ({
      id: r.id,
      channel: r.channel === 'sms' ? 'sms' : 'email',
      title: r.title,
      memo: r.memo,
      subject: r.subject,
      body: r.body,
      fromName: r.fromName,
      fromLocal: r.fromLocal,
      variables: Array.isArray(r.variables) ? r.variables : [],
      sortOrder: r.sortOrder,
    }));
    return { ok: true, items };
  } catch (err) {
    console.error('[listManualTemplatesAction] 실패:', err);
    return { ok: false, message: '템플릿 조회 실패' };
  }
}

/** 발송 템플릿 저장(신규/수정). */
export async function saveManualTemplateAction(input: {
  id?: string;
  channel: 'email' | 'sms';
  title: string;
  memo?: string | null;
  subject?: string | null;
  body: string;
  fromName?: string | null;
  fromLocal?: string | null;
  variables?: Array<{ name: string; source: VarSource }>;
}): Promise<{ ok: boolean; id?: string; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  if (!db) return { ok: false, message: 'DB 연결 없음' };
  const parsed = SaveTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: '제목·본문·채널을 확인하세요' };
  const d = parsed.data;
  try {
    if (d.id) {
      await db
        .update(manualMessageTemplates)
        .set({
          channel: d.channel,
          title: d.title,
          memo: d.memo ?? null,
          subject: d.subject ?? null,
          body: d.body,
          fromName: d.fromName ?? null,
          fromLocal: d.fromLocal ?? null,
          variables: d.variables ?? [],
        })
        .where(eq(manualMessageTemplates.id, d.id));
      logActivity({ userId: user.id, action: 'messaging.template.update', targetType: 'messaging', targetId: d.id, payload: { title: d.title } });
      return { ok: true, id: d.id };
    }
    // 신규 — 같은 채널 끝 순번 +1
    const maxRow = await db
      .select({ max: sql<number>`coalesce(max(${manualMessageTemplates.sortOrder}), -1)::int` })
      .from(manualMessageTemplates)
      .where(eq(manualMessageTemplates.channel, d.channel));
    const nextOrder = Number(maxRow[0]?.max ?? -1) + 1;
    const inserted = await db
      .insert(manualMessageTemplates)
      .values({
        channel: d.channel,
        title: d.title,
        memo: d.memo ?? null,
        subject: d.subject ?? null,
        body: d.body,
        fromName: d.fromName ?? null,
        fromLocal: d.fromLocal ?? null,
        variables: d.variables ?? [],
        sortOrder: nextOrder,
      })
      .returning({ id: manualMessageTemplates.id });
    const id = inserted[0]?.id;
    logActivity({ userId: user.id, action: 'messaging.template.create', targetType: 'messaging', targetId: id ?? null, payload: { title: d.title } });
    return { ok: true, id };
  } catch (err) {
    console.error('[saveManualTemplateAction] 실패:', err);
    return { ok: false, message: '템플릿 저장 실패' };
  }
}

/** 발송 템플릿 삭제 (soft delete). */
export async function deleteManualTemplateAction(input: {
  id: string;
}): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  if (!db) return { ok: false, message: 'DB 연결 없음' };
  if (!z.string().uuid().safeParse(input.id).success) return { ok: false, message: '잘못된 id' };
  try {
    await db
      .update(manualMessageTemplates)
      .set({ isActive: false })
      .where(eq(manualMessageTemplates.id, input.id));
    logActivity({ userId: user.id, action: 'messaging.template.delete', targetType: 'messaging', targetId: input.id, payload: {} });
    return { ok: true };
  } catch (err) {
    console.error('[deleteManualTemplateAction] 실패:', err);
    return { ok: false, message: '템플릿 삭제 실패' };
  }
}

/** 발송 템플릿 정렬 (드래그앤드롭 결과 반영). */
export async function reorderManualTemplatesAction(input: {
  orderedIds: string[];
}): Promise<{ ok: boolean; message?: string }> {
  await requireRole(['manager', 'admin']);
  if (!db) return { ok: false, message: 'DB 연결 없음' };
  const ids = (input.orderedIds ?? []).filter((id) => z.string().uuid().safeParse(id).success);
  if (ids.length === 0) return { ok: true };
  try {
    // 각 id에 인덱스를 sort_order로 일괄 반영.
    for (let i = 0; i < ids.length; i += 1) {
      await db
        .update(manualMessageTemplates)
        .set({ sortOrder: i })
        .where(eq(manualMessageTemplates.id, ids[i]));
    }
    return { ok: true };
  } catch (err) {
    console.error('[reorderManualTemplatesAction] 실패:', err);
    return { ok: false, message: '정렬 저장 실패' };
  }
}

// ─────────────────────────────────────────────────────────────────────
// 연락처 엑셀 업로드 (MSG-17)
// ─────────────────────────────────────────────────────────────────────

/** 엑셀 파싱 결과 1행 — 채널별 주소 + 업체/담당자 + 커스텀 변수값. */
export type ExcelRecipientRow = {
  company: string | null;
  email: string | null;
  phone: string | null;
  person: string | null;
  /** 커스텀 변수값 (변수명 → 값). */
  vars: Record<string, string>;
};

const KNOWN_COMPANY = ['업체명', '회사', '회사명', 'company', '호텔명'];
const KNOWN_EMAIL = ['이메일', 'email', 'e-mail', '메일'];
const KNOWN_PHONE = ['연락처', '휴대폰', '전화번호', '핸드폰', 'phone', '전화', '번호'];
const KNOWN_PERSON = ['담당자명', '담당자', '이름', 'name'];
const MAX_CUSTOM_VARS = 7;

function normHeader(s: unknown): string {
  return String(s ?? '').trim();
}
function inSet(h: string, set: string[]): boolean {
  const l = h.toLowerCase();
  return set.some((k) => k.toLowerCase() === l);
}

/**
 * 엑셀(.xlsx/.xls/.csv) 파싱 → 수신자 행 목록.
 * 컬럼: 업체명 · 이메일/연락처(필수 중 하나) · 담당자명 · 변수명1~7(임의 헤더).
 */
export async function parseRecipientsExcelAction(input: {
  fileBase64: string;
}): Promise<{
  ok: boolean;
  rows?: ExcelRecipientRow[];
  varNames?: string[];
  errors?: string[];
  message?: string;
}> {
  await requireRole(['manager', 'admin']);
  if (!input.fileBase64 || input.fileBase64.length > 8_000_000) {
    return { ok: false, message: '파일이 없거나 너무 큽니다(최대 ~6MB)' };
  }
  try {
    const XLSX = await import('xlsx');
    const buf = Buffer.from(input.fileBase64, 'base64');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return { ok: false, message: '시트를 찾을 수 없습니다' };
    const sheet = wb.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    if (matrix.length < 2) return { ok: false, message: '데이터 행이 없습니다(헤더 + 1행 이상)' };

    const headers = (matrix[0] as unknown[]).map(normHeader);
    // 컬럼 역할 매핑
    let companyIdx = -1;
    let emailIdx = -1;
    let phoneIdx = -1;
    let personIdx = -1;
    const varCols: Array<{ idx: number; name: string }> = [];
    headers.forEach((h, idx) => {
      if (!h) return;
      if (companyIdx < 0 && inSet(h, KNOWN_COMPANY)) companyIdx = idx;
      else if (emailIdx < 0 && inSet(h, KNOWN_EMAIL)) emailIdx = idx;
      else if (phoneIdx < 0 && inSet(h, KNOWN_PHONE)) phoneIdx = idx;
      else if (personIdx < 0 && inSet(h, KNOWN_PERSON)) personIdx = idx;
      else if (varCols.length < MAX_CUSTOM_VARS) varCols.push({ idx, name: h });
    });
    if (emailIdx < 0 && phoneIdx < 0) {
      return { ok: false, message: '이메일 또는 연락처 컬럼이 필요합니다' };
    }

    const rows: ExcelRecipientRow[] = [];
    const errors: string[] = [];
    for (let i = 1; i < matrix.length && rows.length < MAX_RECIPIENTS; i += 1) {
      const row = matrix[i] as unknown[];
      const cell = (idx: number) => (idx >= 0 ? String(row[idx] ?? '').trim() : '');
      const emailRaw = cell(emailIdx);
      const phoneRaw = cell(phoneIdx);
      const email = emailRaw && EMAIL_RE.test(emailRaw) ? emailRaw : null;
      const phoneDigits = phoneRaw.replace(/[^0-9]/g, '');
      const phone = phoneDigits.length >= 9 && phoneDigits.length <= 11 ? phoneDigits : null;
      if (!email && !phone) {
        if (emailRaw || phoneRaw) errors.push(`${i + 1}행: 연락처 형식 오류(${emailRaw || phoneRaw})`);
        continue;
      }
      const vars: Record<string, string> = {};
      for (const vc of varCols) {
        const v = cell(vc.idx);
        if (v) vars[vc.name] = v;
      }
      rows.push({
        company: cell(companyIdx) || null,
        email,
        phone,
        person: cell(personIdx) || null,
        vars,
      });
    }
    if (rows.length === 0) {
      return { ok: false, message: '유효한 수신자 행이 없습니다', errors };
    }
    return { ok: true, rows, varNames: varCols.map((v) => v.name), errors };
  } catch (err) {
    console.error('[parseRecipientsExcelAction] 실패:', err);
    return { ok: false, message: '엑셀 파싱 실패 — 파일 형식을 확인하세요' };
  }
}

// ─────────────────────────────────────────────────────────────────────
// 호텔리어 전체 불러오기 (MSG-18)
// ─────────────────────────────────────────────────────────────────────

/** 활성 호텔리어 전체를 수신자로 반환 (채널별 주소 보유분만, 최대 200). */
export async function listHoteliersAsRecipientsAction(input: {
  channel: 'email' | 'sms';
}): Promise<{ ok: boolean; recipients?: SendRecipient[]; count?: number; skipped?: number; message?: string }> {
  await requireRole(['manager', 'admin']);
  if (!db) return { ok: true, recipients: [], count: 0, skipped: 0 };
  const channel = input.channel === 'sms' ? 'sms' : 'email';
  try {
    const recipients: SendRecipient[] = [];
    const seen = new Set<string>();
    let skipped = 0;
    let page = 1;
    // listUsers는 pageSize 최대 100 → 활성 호텔리어 전체를 끝까지 페이지네이션 (MAX_RECIPIENTS 도달 시 중단).
    for (let guard = 0; guard < 50 && recipients.length < MAX_RECIPIENTS; guard += 1) {
      const res = await listUsers({ role: 'hotelier', isActive: true, page, pageSize: 100 });
      if (res.items.length === 0) break;
      for (const u of res.items) {
        if (recipients.length >= MAX_RECIPIENTS) break;
        const address = channel === 'email' ? (u.email ?? '') : (u.phone ?? '').replace(/[^0-9]/g, '');
        if (!address) {
          skipped += 1;
          continue;
        }
        if (channel === 'email' && !EMAIL_RE.test(address)) {
          skipped += 1;
          continue;
        }
        if (channel === 'sms' && (address.length < 9 || address.length > 11)) {
          skipped += 1;
          continue;
        }
        if (seen.has(address)) continue;
        seen.add(address);
        const hotel = u.hotelName ?? null;
        recipients.push({
          address,
          company: hotel,
          auto: {
            업체명: hotel ?? '',
            호텔명: hotel ?? '',
            담당자명: u.name ?? '',
            연락처: u.phone ?? '',
          },
        });
      }
      if (res.items.length < 100) break;
      page += 1;
    }
    return { ok: true, recipients, count: recipients.length, skipped };
  } catch (err) {
    console.error('[listHoteliersAsRecipientsAction] 실패:', err);
    return { ok: false, message: '호텔리어 조회 실패' };
  }
}
