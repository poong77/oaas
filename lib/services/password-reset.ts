/**
 * AC-11 셀프 비밀번호 찾기 — 서버 전용 서비스.
 *
 * 흐름:
 *   1. searchHotelsForReset(q)        호텔 검색 (국문/영문/띄어쓰기 무시)
 *   2. listAccountsForReset(hotelId)  해당 호텔의 재설정 가능 계정 (마스킹)
 *   3. createResetRequest(...)        이메일 링크 또는 문자 코드 발급·발송
 *   4. verifyResetCode(token, code)   문자 코드 검증 (5회 제한)
 *   5. getResetGrant(token)           reset 페이지 접근 검증
 *   6. completeReset(token, pw)       새 비밀번호 저장 + 토큰 소멸
 *
 * 보안: 토큰/코드는 sha256 해시로만 저장. 임시비밀번호를 발급하지 않는다.
 */

import 'server-only';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { and, desc, eq, gt, isNull, sql, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import { collapseSpacing } from '@/lib/text/normalize';
import { logActivity } from '@/lib/audit';
import { getPublicBaseUrl } from '@/lib/env';
import { sendEmail } from '@/lib/notifications/ses';
import { sendSms } from '@/lib/notifications/solapi';
import {
  buildPasswordResetCode,
  buildPasswordResetLink,
  buildPasswordChanged,
} from '@/lib/notifications/templates';
import { hashPassword } from '@/lib/services/users';
import {
  hotels,
  passwordResetTokens,
  users,
  type PasswordResetToken,
} from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────────────────────────────

/** 호텔 검색 최소 글자 수 (collapseSpacing 후 기준). 클라이언트 MIN_QUERY_LEN과 동일. */
const MIN_SEARCH_LEN = 3;
const EMAIL_TOKEN_TTL_MIN = 30;
const SMS_CODE_TTL_MIN = 10;
const MAX_CODE_ATTEMPTS = 5;
/** @as.local 등 placeholder 이메일은 발송 채널로 노출하지 않는다 (AS 이관 더미). */
const PLACEHOLDER_EMAIL_DOMAINS = ['as.local', 'oa.local', 'example.com'];

// ─────────────────────────────────────────────────────────────────────
// 내부 헬퍼
// ─────────────────────────────────────────────────────────────────────

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** 상수시간 hex 비교 (타이밍 공격 완화). */
function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function isUsableEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  const at = email.lastIndexOf('@');
  if (at <= 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  if (!domain.includes('.')) return false;
  return !PLACEHOLDER_EMAIL_DOMAINS.includes(domain);
}

function isUsablePhone(phone: string | null | undefined): phone is string {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10;
}

/** 이름 마스킹: 홍길동 → 홍*동, 김철 → 김*, a → * */
export function maskName(name: string): string {
  const s = name.trim();
  if (s.length <= 1) return '*';
  if (s.length === 2) return `${s[0]}*`;
  return `${s[0]}${'*'.repeat(s.length - 2)}${s[s.length - 1]}`;
}

/** 이메일 마스킹: marclee@gmail.com → ma***@g***.com */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const dname = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : '';
  const maskLocal =
    local.length <= 2 ? `${local[0] ?? '*'}***` : `${local.slice(0, 2)}***`;
  const maskDomain = `${dname[0] ?? '*'}***`;
  return `${maskLocal}@${maskDomain}${tld}`;
}

/** 전화 마스킹: 01012345678 → 010-****-5678 (발송 후 본인 확인용) */
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length < 7) return '***';
  const head = d.slice(0, 3);
  const tail = d.slice(-4);
  return `${head}-****-${tail}`;
}

/**
 * 공개 목록(미인증 노출)용 강한 마스킹 — 어뷰징/피싱 재료 최소화.
 * 이메일 도메인 숨김: marclee@gmail.com → ma***@***
 */
export function maskEmailLight(email: string): string {
  const at = email.lastIndexOf('@');
  const local = at > 0 ? email.slice(0, at) : email;
  const head = local.slice(0, Math.min(2, local.length)) || '*';
  return `${head}***@***`;
}

/**
 * 공개 목록(미인증 노출)용 강한 마스킹 — 끝 2자리만.
 * 01012345678 → 010-****-**78
 */
export function maskPhoneLight(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length < 4) return '***';
  const head = d.slice(0, 3);
  const tail = d.slice(-2);
  return `${head}-****-**${tail}`;
}

// ─────────────────────────────────────────────────────────────────────
// 1. 호텔 검색
// ─────────────────────────────────────────────────────────────────────

export type ResetHotelMatch = { hotelId: string; hotelName: string };

export async function searchHotelsForReset(
  q: string,
  limit = 10,
): Promise<ResetHotelMatch[]> {
  if (!db) return [];
  const raw = q.trim();
  const collapsed = collapseSpacing(raw);
  // 너무 짧은 검색어는 전체 노출/스크래핑 방지 차원에서 차단 (공백·기호 제외 3글자 이상).
  if (collapsed.length < MIN_SEARCH_LEN) return [];

  // 호텔명·법인명을 띄어쓰기·하이픈·점 무시하고 매칭.
  const pattern = `%${collapsed}%`;
  const match: SQL = sql`(
    translate(lower(${hotels.name}), ' -_.·', '') LIKE ${pattern}
    OR translate(lower(coalesce(${hotels.corporateName}, '')), ' -_.·', '') LIKE ${pattern}
  )`;

  try {
    const rows = await db
      .select({ hotelId: hotels.id, hotelName: hotels.name })
      .from(hotels)
      .where(and(eq(hotels.isActive, true), match))
      .orderBy(hotels.name)
      .limit(Math.min(20, Math.max(1, limit)));
    return rows;
  } catch (err) {
    console.error('[password-reset.searchHotelsForReset] 실패:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// 2. 호텔별 재설정 가능 계정 (마스킹)
// ─────────────────────────────────────────────────────────────────────

export type ResetAccount = {
  userId: string;
  maskedName: string;
  hasEmail: boolean;
  maskedEmail: string | null;
  hasPhone: boolean;
  maskedPhone: string | null;
};

/**
 * 호텔별 재설정 가능 계정 — 미인증 공개 노출이므로 강한 마스킹.
 * 직책(조직도 단서) 미포함, 이메일 도메인 숨김, 전화 끝 2자리만.
 */
export async function listAccountsForReset(
  hotelId: string,
): Promise<ResetAccount[]> {
  if (!db) return [];
  try {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
      })
      .from(users)
      .where(and(eq(users.hotelId, hotelId), eq(users.isActive, true)))
      .orderBy(users.name);

    return rows
      .map((r) => {
        const hasEmail = isUsableEmail(r.email);
        const hasPhone = isUsablePhone(r.phone);
        if (!hasEmail && !hasPhone) return null;
        return {
          userId: r.id,
          maskedName: maskName(r.name),
          hasEmail,
          maskedEmail: hasEmail ? maskEmailLight(r.email) : null,
          hasPhone,
          maskedPhone: hasPhone ? maskPhoneLight(r.phone!) : null,
        } satisfies ResetAccount;
      })
      .filter((x): x is ResetAccount => x !== null);
  } catch (err) {
    console.error('[password-reset.listAccountsForReset] 실패:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// 3. 재설정 요청 발급·발송
// ─────────────────────────────────────────────────────────────────────

export type ResetChannel = 'email' | 'sms';

export type CreateResetResult =
  | { ok: true; channel: 'email'; maskedTarget: string }
  | { ok: true; channel: 'sms'; token: string; maskedTarget: string }
  | { ok: false; error: string };

/** 동일 사용자의 기존 활성 토큰 일괄 무효화. */
async function invalidateActiveTokens(userId: string): Promise<void> {
  if (!db) return;
  await db
    .update(passwordResetTokens)
    .set({ isActive: false })
    .where(
      and(
        eq(passwordResetTokens.userId, userId),
        eq(passwordResetTokens.isActive, true),
      ),
    );
}

export async function createResetRequest(
  userId: string,
  channel: ResetChannel,
  ip: string | null,
): Promise<CreateResetResult> {
  if (!db) return { ok: false, error: 'DB_NOT_CONFIGURED' };

  try {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.isActive, true)))
      .limit(1);
    const user = rows[0];
    if (!user) return { ok: false, error: 'NOT_FOUND' };

    // 채널 가용성 확인
    if (channel === 'email' && !isUsableEmail(user.email)) {
      return { ok: false, error: 'CHANNEL_UNAVAILABLE' };
    }
    if (channel === 'sms' && !isUsablePhone(user.phone)) {
      return { ok: false, error: 'CHANNEL_UNAVAILABLE' };
    }

    await invalidateActiveTokens(userId);

    const token = randomBytes(32).toString('base64url');

    if (channel === 'email') {
      const expiresAt = new Date(Date.now() + EMAIL_TOKEN_TTL_MIN * 60_000);
      await db.insert(passwordResetTokens).values({
        userId,
        channel: 'email',
        tokenHash: sha256(token),
        expiresAt,
        ip,
      });

      const resetUrl = `${getPublicBaseUrl()}/reset-password?token=${token}`;
      const tpl = buildPasswordResetLink({
        name: user.name,
        resetUrl,
        expiresMinutes: EMAIL_TOKEN_TTL_MIN,
      });
      await sendEmail({
        to: user.email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });

      logActivity({
        userId,
        action: 'user.password_reset_requested',
        targetType: 'user',
        targetId: userId,
        payload: { channel: 'email' },
        ip,
      });

      return { ok: true, channel: 'email', maskedTarget: maskEmail(user.email) };
    }

    // sms
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + SMS_CODE_TTL_MIN * 60_000);
    await db.insert(passwordResetTokens).values({
      userId,
      channel: 'sms',
      tokenHash: sha256(token),
      codeHash: sha256(code),
      expiresAt,
      ip,
    });

    const tpl = buildPasswordResetCode({
      name: user.name,
      code,
      expiresMinutes: SMS_CODE_TTL_MIN,
    });
    await sendSms({ to: user.phone!, text: tpl.sms });

    logActivity({
      userId,
      action: 'user.password_reset_requested',
      targetType: 'user',
      targetId: userId,
      payload: { channel: 'sms' },
      ip,
    });

    return {
      ok: true,
      channel: 'sms',
      token,
      maskedTarget: maskPhone(user.phone!),
    };
  } catch (err) {
    console.error('[password-reset.createResetRequest] 실패:', err);
    return { ok: false, error: 'INTERNAL_ERROR' };
  }
}

// ─────────────────────────────────────────────────────────────────────
// 4. 문자 코드 검증
// ─────────────────────────────────────────────────────────────────────

export type VerifyCodeResult =
  | { ok: true; token: string }
  | { ok: false; error: 'EXPIRED' | 'TOO_MANY' | 'MISMATCH'; remaining?: number };

async function findActiveTokenRow(
  token: string,
): Promise<PasswordResetToken | null> {
  if (!db) return null;
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, sha256(token)),
        eq(passwordResetTokens.isActive, true),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(passwordResetTokens.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function verifyResetCode(
  token: string,
  code: string,
): Promise<VerifyCodeResult> {
  if (!db) return { ok: false, error: 'EXPIRED' };
  try {
    const row = await findActiveTokenRow(token);
    if (!row || row.channel !== 'sms' || !row.codeHash) {
      return { ok: false, error: 'EXPIRED' };
    }
    if (row.attempts >= MAX_CODE_ATTEMPTS) {
      await db
        .update(passwordResetTokens)
        .set({ isActive: false })
        .where(eq(passwordResetTokens.id, row.id));
      return { ok: false, error: 'TOO_MANY' };
    }

    const inputHash = sha256(code.trim());
    if (!safeEqualHex(inputHash, row.codeHash)) {
      const attempts = row.attempts + 1;
      const exhausted = attempts >= MAX_CODE_ATTEMPTS;
      await db
        .update(passwordResetTokens)
        .set({ attempts, isActive: exhausted ? false : true })
        .where(eq(passwordResetTokens.id, row.id));
      return exhausted
        ? { ok: false, error: 'TOO_MANY' }
        : { ok: false, error: 'MISMATCH', remaining: MAX_CODE_ATTEMPTS - attempts };
    }

    await db
      .update(passwordResetTokens)
      .set({ codeVerifiedAt: new Date() })
      .where(eq(passwordResetTokens.id, row.id));
    return { ok: true, token };
  } catch (err) {
    console.error('[password-reset.verifyResetCode] 실패:', err);
    return { ok: false, error: 'EXPIRED' };
  }
}

// ─────────────────────────────────────────────────────────────────────
// 5. reset 페이지 접근 검증
// ─────────────────────────────────────────────────────────────────────

export type ResetGrant = { userId: string; name: string };

export async function getResetGrant(token: string): Promise<ResetGrant | null> {
  if (!db) return null;
  try {
    const row = await findActiveTokenRow(token);
    if (!row) return null;
    // sms 채널은 코드 검증을 통과해야만 접근 허용.
    if (row.channel === 'sms' && !row.codeVerifiedAt) return null;

    const userRows = await db
      .select({ name: users.name })
      .from(users)
      .where(and(eq(users.id, row.userId), eq(users.isActive, true)))
      .limit(1);
    const name = userRows[0]?.name;
    if (!name) return null;
    return { userId: row.userId, name };
  } catch (err) {
    console.error('[password-reset.getResetGrant] 실패:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 6. 비밀번호 변경 완료
// ─────────────────────────────────────────────────────────────────────

export type CompleteResetResult =
  | { ok: true }
  | { ok: false; error: 'INVALID_TOKEN' | 'WEAK_PASSWORD' | 'INTERNAL_ERROR' };

/** 비밀번호 정책: 8자 이상, 영문+숫자 포함 (AC-03 changePassword와 동일). */
export function isStrongPassword(pw: string): boolean {
  return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
}

export async function completeReset(
  token: string,
  newPassword: string,
  ip: string | null,
): Promise<CompleteResetResult> {
  if (!db) return { ok: false, error: 'INTERNAL_ERROR' };
  if (!isStrongPassword(newPassword)) {
    return { ok: false, error: 'WEAK_PASSWORD' };
  }
  try {
    const row = await findActiveTokenRow(token);
    if (!row) return { ok: false, error: 'INVALID_TOKEN' };
    if (row.channel === 'sms' && !row.codeVerifiedAt) {
      return { ok: false, error: 'INVALID_TOKEN' };
    }

    const userRows = await db
      .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
      .from(users)
      .where(and(eq(users.id, row.userId), eq(users.isActive, true)))
      .limit(1);
    const user = userRows[0];
    if (!user) return { ok: false, error: 'INVALID_TOKEN' };

    const passwordHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({ passwordHash, mustChangePassword: false })
      .where(eq(users.id, user.id));

    // 사용 처리 + 동일 사용자 잔여 활성 토큰 무효화
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date(), isActive: false })
      .where(eq(passwordResetTokens.id, row.id));
    await invalidateActiveTokens(user.id);

    logActivity({
      userId: user.id,
      action: 'user.password_self_reset',
      targetType: 'user',
      targetId: user.id,
      payload: { channel: row.channel },
      ip,
    });

    // 변경 완료 알림 (best-effort)
    try {
      const tpl = buildPasswordChanged({ name: user.name });
      if (isUsableEmail(user.email)) {
        await sendEmail({
          to: user.email,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        });
      }
      if (isUsablePhone(user.phone)) {
        await sendSms({ to: user.phone!, text: tpl.sms });
      }
    } catch (notifyErr) {
      console.warn('[password-reset.completeReset] 완료 알림 실패:', notifyErr);
    }

    return { ok: true };
  } catch (err) {
    console.error('[password-reset.completeReset] 실패:', err);
    return { ok: false, error: 'INTERNAL_ERROR' };
  }
}
