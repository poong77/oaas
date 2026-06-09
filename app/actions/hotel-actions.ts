'use server';

/**
 * 호텔 상세(정보 보강) Server Actions.
 *
 * - updateHotelProfileAction        : 사업자 정보 + 연락처(복수) + 슬랙 + 메모 일괄 저장
 * - addHotelSolutionAction          : 이용중 솔루션 추가 (PW는 AES 암호화 저장)
 * - updateHotelSolutionAction       : 솔루션 수정 (PW 빈값=기존 유지)
 * - deleteHotelSolutionAction       : 솔루션 삭제 (soft delete)
 * - revealSolutionPasswordAction    : 솔루션 PW 복호화 (어드민, 화면 표시, 감사 로그)
 * - copySolutionPasswordAction      : 솔루션 PW 복호화 (어드민+매니저, 클립보드 복사용, 감사 로그)
 * - addManagedHotelAction           : 멀티관리 호텔 연결 (양방향)
 * - removeManagedHotelAction        : 멀티관리 호텔 해제 (양방향)
 * - linkHotelSlackChannelAction     : 슬랙 채널 연동 (공개채널 봇 자동입장 + 첫 메시지)
 * - unlinkHotelSlackChannelAction   : 슬랙 채널 연동 해제 (soft delete)
 * - toggleHotelSlackChannelNotifyAction : 채널별 접수 알림 발송 on/off 토글
 * - sendTestHotelSlackChannelAction : 연동 채널 테스트 메시지 발송
 * - refreshHotelSlackChannelAction  : 채널 봇 참여 상태·채널명 재조회 갱신
 */

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db';
import {
  hotelManagedLinks,
  hotelSlackChannels,
  hotelSolutionLinks,
  hotels,
} from '@/db/schema';
import { withAuthorizedAction } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import { normalizeKoreanPhone } from '@/lib/text/phone';
import { decryptSecret, encryptSecret } from '@/lib/crypto/secret';
import {
  getSlackChannelInfo,
  joinSlackChannel,
  looksLikeChannelId,
} from '@/lib/notifications/slack-admin';
import { notifySlack } from '@/lib/notifications';
import {
  buildHotelSlackLinkedBlocks,
  buildHotelSlackTestBlocks,
} from '@/lib/notifications/slack';

type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fields?: Record<string, string> };

const uuidSchema = z.string().uuid();
const phoneRegex = /^[0-9\-+\s()]{7,20}$/;

/** URL 정규화: 프로토콜 없으면 https:// 부여. 빈값은 그대로 빈값. */
function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

/** 추가 연락처/이메일 JSON 파싱 (안전). */
function parseExtraContacts(raw: string): { name: string; phone: string }[] {
  try {
    const arr = JSON.parse(raw || '[]');
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({
        name: String(x?.name ?? '').trim(),
        phone: String(x?.phone ?? '').trim(),
      }))
      .filter((x) => x.name || x.phone)
      .slice(0, 20);
  } catch {
    return [];
  }
}
function parseExtraEmails(raw: string): string[] {
  try {
    const arr = JSON.parse(raw || '[]');
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
      .slice(0, 20);
  } catch {
    return [];
  }
}

// ─── 사업자 정보 + 연락처 + 메모 ────────────────────────────────────

const HotelProfileSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, '호텔명을 입력해주세요').max(200),
  // 사업자 정보
  businessNo: z.string().max(30).optional().or(z.literal('')),
  representativeName: z.string().max(100).optional().or(z.literal('')),
  corporateName: z.string().max(200).optional().or(z.literal('')),
  hotelType: z
    .enum(['direct', 'operator', 'chain', 'distributor'])
    .optional()
    .or(z.literal('')),
  contractYear: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (v) => !v || (/^\d{4}$/.test(v) && Number(v) >= 1990 && Number(v) <= 2100),
      '연도는 1990~2100 사이 4자리로 입력해주세요',
    ),
  contractMonth: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (v) => !v || (Number(v) >= 1 && Number(v) <= 12),
      '월은 1~12 사이로 입력해주세요',
    ),
  address: z.string().max(500).optional().or(z.literal('')),
  // 연락처
  phone: z
    .string()
    .max(30)
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || phoneRegex.test(v), '올바른 연락처 형식이 아닙니다'),
  managerName: z.string().max(100).optional().or(z.literal('')),
  extraContactsJson: z.string().optional().or(z.literal('')),
  extraEmailsJson: z.string().optional().or(z.literal('')),
  // 메모
  note: z.string().max(2000).optional().or(z.literal('')),
});

export const updateHotelProfileAction = withAuthorizedAction<
  FormData,
  ActionResult
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };

  const parsed = HotelProfileSchema.safeParse({
    id: (formData.get('id') as string) ?? '',
    name: formData.get('name') ?? '',
    businessNo: formData.get('businessNo') ?? '',
    representativeName: formData.get('representativeName') ?? '',
    corporateName: formData.get('corporateName') ?? '',
    hotelType: formData.get('hotelType') ?? '',
    contractYear: formData.get('contractYear') ?? '',
    contractMonth: formData.get('contractMonth') ?? '',
    address: formData.get('address') ?? '',
    phone: formData.get('phone') ?? '',
    managerName: formData.get('managerName') ?? '',
    extraContactsJson: formData.get('extraContactsJson') ?? '',
    extraEmailsJson: formData.get('extraEmailsJson') ?? '',
    note: formData.get('note') ?? '',
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      ok: false,
      error: '입력값을 확인해주세요',
      fields: Object.fromEntries(
        Object.entries(flat.fieldErrors).map(([k, v]) => [k, v?.[0] ?? '']),
      ),
    };
  }
  const d = parsed.data;
  const normalizedPhone =
    normalizeKoreanPhone(d.phone) ?? (d.phone || null);

  try {
    await db
      .update(hotels)
      .set({
        name: d.name,
        businessNo: d.businessNo || null,
        representativeName: d.representativeName || null,
        corporateName: d.corporateName || null,
        hotelType: d.hotelType ? d.hotelType : null,
        contractYear: d.contractYear ? Number(d.contractYear) : null,
        contractMonth: d.contractMonth ? Number(d.contractMonth) : null,
        address: d.address || null,
        phone: normalizedPhone,
        managerName: d.managerName || null,
        extraContacts: parseExtraContacts(d.extraContactsJson ?? ''),
        extraEmails: parseExtraEmails(d.extraEmailsJson ?? ''),
        note: d.note || null,
      })
      .where(eq(hotels.id, d.id));

    logActivity({
      userId: ctx.user.id,
      action: 'hotel.update',
      targetType: 'hotel',
      targetId: d.id,
    });
    revalidatePath(`/admin/hotels/${d.id}`);
    revalidatePath('/admin/hotels');
    return { ok: true };
  } catch (err) {
    console.error('[updateHotelProfileAction] 실패:', err);
    return { ok: false, error: '호텔 정보 저장 중 오류가 발생했습니다' };
  }
});

// ─── 이용중 솔루션 ──────────────────────────────────────────────

const SolutionSchema = z.object({
  hotelId: uuidSchema,
  presetId: z.string().uuid().optional().or(z.literal('')),
  label: z.string().min(1, '솔루션명을 입력해주세요').max(100),
  url: z.string().max(500).optional().or(z.literal('')),
  loginId: z.string().max(200).optional().or(z.literal('')),
  password: z.string().max(500).optional().or(z.literal('')),
});

export const addHotelSolutionAction = withAuthorizedAction<
  FormData,
  ActionResult
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };
  const parsed = SolutionSchema.safeParse({
    hotelId: (formData.get('hotelId') as string) ?? '',
    presetId: formData.get('presetId') ?? '',
    label: formData.get('label') ?? '',
    url: formData.get('url') ?? '',
    loginId: formData.get('loginId') ?? '',
    password: formData.get('password') ?? '',
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      ok: false,
      error: '입력값을 확인해주세요',
      fields: Object.fromEntries(
        Object.entries(flat.fieldErrors).map(([k, v]) => [k, v?.[0] ?? '']),
      ),
    };
  }
  const d = parsed.data;
  try {
    // 정렬값: 현재 활성 솔루션 수 기반으로 끝에 추가
    const existing = await db
      .select({ id: hotelSolutionLinks.id })
      .from(hotelSolutionLinks)
      .where(
        and(
          eq(hotelSolutionLinks.hotelId, d.hotelId),
          eq(hotelSolutionLinks.isActive, true),
        ),
      );
    await db.insert(hotelSolutionLinks).values({
      hotelId: d.hotelId,
      presetId: d.presetId || null,
      label: d.label,
      url: normalizeUrl(d.url ?? ''),
      loginId: d.loginId || null,
      passwordEnc: d.password ? encryptSecret(d.password) : null,
      sortOrder: existing.length * 10,
    });
    logActivity({
      userId: ctx.user.id,
      action: 'hotel.solution.create',
      targetType: 'hotel',
      targetId: d.hotelId,
      payload: { label: d.label },
    });
    revalidatePath(`/admin/hotels/${d.hotelId}`);
    return { ok: true };
  } catch (err) {
    console.error('[addHotelSolutionAction] 실패:', err);
    return { ok: false, error: '솔루션 추가 중 오류가 발생했습니다' };
  }
});

const SolutionUpdateSchema = SolutionSchema.extend({
  id: uuidSchema,
  clearPassword: z.string().optional().or(z.literal('')),
});

export const updateHotelSolutionAction = withAuthorizedAction<
  FormData,
  ActionResult
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };
  const parsed = SolutionUpdateSchema.safeParse({
    id: (formData.get('id') as string) ?? '',
    hotelId: (formData.get('hotelId') as string) ?? '',
    presetId: formData.get('presetId') ?? '',
    label: formData.get('label') ?? '',
    url: formData.get('url') ?? '',
    loginId: formData.get('loginId') ?? '',
    password: formData.get('password') ?? '',
    clearPassword: formData.get('clearPassword') ?? '',
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      ok: false,
      error: '입력값을 확인해주세요',
      fields: Object.fromEntries(
        Object.entries(flat.fieldErrors).map(([k, v]) => [k, v?.[0] ?? '']),
      ),
    };
  }
  const d = parsed.data;
  try {
    // password: 빈값이면 기존 유지, 값 있으면 교체, clearPassword=1이면 제거
    const set: Record<string, unknown> = {
      presetId: d.presetId || null,
      label: d.label,
      url: normalizeUrl(d.url ?? ''),
      loginId: d.loginId || null,
    };
    if (d.clearPassword === '1') set.passwordEnc = null;
    else if (d.password) set.passwordEnc = encryptSecret(d.password);

    await db
      .update(hotelSolutionLinks)
      .set(set)
      .where(
        and(
          eq(hotelSolutionLinks.id, d.id),
          eq(hotelSolutionLinks.hotelId, d.hotelId),
        ),
      );
    logActivity({
      userId: ctx.user.id,
      action: 'hotel.solution.update',
      targetType: 'hotel',
      targetId: d.hotelId,
      payload: { solutionId: d.id, label: d.label },
    });
    revalidatePath(`/admin/hotels/${d.hotelId}`);
    return { ok: true };
  } catch (err) {
    console.error('[updateHotelSolutionAction] 실패:', err);
    return { ok: false, error: '솔루션 수정 중 오류가 발생했습니다' };
  }
});

export const deleteHotelSolutionAction = withAuthorizedAction<
  FormData,
  ActionResult
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };
  const id = (formData.get('id') as string) ?? '';
  const hotelId = (formData.get('hotelId') as string) ?? '';
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(hotelId).success)
    return { ok: false, error: '잘못된 요청' };
  try {
    await db
      .update(hotelSolutionLinks)
      .set({ isActive: false })
      .where(
        and(
          eq(hotelSolutionLinks.id, id),
          eq(hotelSolutionLinks.hotelId, hotelId),
        ),
      );
    logActivity({
      userId: ctx.user.id,
      action: 'hotel.solution.delete',
      targetType: 'hotel',
      targetId: hotelId,
      payload: { solutionId: id },
    });
    revalidatePath(`/admin/hotels/${hotelId}`);
    return { ok: true };
  } catch (err) {
    console.error('[deleteHotelSolutionAction] 실패:', err);
    return { ok: false, error: '솔루션 삭제 중 오류가 발생했습니다' };
  }
});

/** 솔루션 비밀번호 복호화 — '보기' 클릭 시에만. 감사 로그 기록. */
export const revealSolutionPasswordAction = withAuthorizedAction<
  FormData,
  ActionResult<{ password: string }>
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };
  const id = (formData.get('id') as string) ?? '';
  const hotelId = (formData.get('hotelId') as string) ?? '';
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(hotelId).success)
    return { ok: false, error: '잘못된 요청' };
  try {
    const rows = await db
      .select({ passwordEnc: hotelSolutionLinks.passwordEnc })
      .from(hotelSolutionLinks)
      .where(
        and(
          eq(hotelSolutionLinks.id, id),
          eq(hotelSolutionLinks.hotelId, hotelId),
        ),
      )
      .limit(1);
    if (!rows[0]) return { ok: false, error: '대상을 찾을 수 없습니다' };
    const plain = decryptSecret(rows[0].passwordEnc);
    if (plain === null) return { ok: false, error: '저장된 비밀번호가 없습니다' };
    logActivity({
      userId: ctx.user.id,
      action: 'hotel.solution.reveal_password',
      targetType: 'hotel',
      targetId: hotelId,
      payload: { solutionId: id },
    });
    return { ok: true, data: { password: plain } };
  } catch (err) {
    console.error('[revealSolutionPasswordAction] 실패:', err);
    return { ok: false, error: '비밀번호 조회 중 오류가 발생했습니다' };
  }
});

/**
 * 솔루션 비밀번호 복호화 — '바로가기' 자동입력(클립보드 복사)용.
 * reveal과 달리 매니저까지 허용한다 (티켓 처리 중 솔루션 직접 로그인 필요).
 * 화면에 평문을 그리지 않고 클립보드 복사 목적으로만 사용한다. 감사 로그 기록.
 */
export const copySolutionPasswordAction = withAuthorizedAction<
  FormData,
  ActionResult<{ password: string }>
>(['admin', 'manager'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };
  const id = (formData.get('id') as string) ?? '';
  const hotelId = (formData.get('hotelId') as string) ?? '';
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(hotelId).success)
    return { ok: false, error: '잘못된 요청' };
  try {
    const rows = await db
      .select({ passwordEnc: hotelSolutionLinks.passwordEnc })
      .from(hotelSolutionLinks)
      .where(
        and(
          eq(hotelSolutionLinks.id, id),
          eq(hotelSolutionLinks.hotelId, hotelId),
        ),
      )
      .limit(1);
    if (!rows[0]) return { ok: false, error: '대상을 찾을 수 없습니다' };
    const plain = decryptSecret(rows[0].passwordEnc);
    if (plain === null) return { ok: false, error: '저장된 비밀번호가 없습니다' };
    logActivity({
      userId: ctx.user.id,
      action: 'hotel.solution.copy_password',
      targetType: 'hotel',
      targetId: hotelId,
      payload: { solutionId: id },
    });
    return { ok: true, data: { password: plain } };
  } catch (err) {
    console.error('[copySolutionPasswordAction] 실패:', err);
    return { ok: false, error: '비밀번호 조회 중 오류가 발생했습니다' };
  }
});

// ─── 멀티관리 호텔 (양방향) ─────────────────────────────────────

export const addManagedHotelAction = withAuthorizedAction<
  FormData,
  ActionResult
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };
  const hotelId = (formData.get('hotelId') as string) ?? '';
  const linkedHotelId = (formData.get('linkedHotelId') as string) ?? '';
  if (
    !uuidSchema.safeParse(hotelId).success ||
    !uuidSchema.safeParse(linkedHotelId).success
  )
    return { ok: false, error: '잘못된 요청' };
  if (hotelId === linkedHotelId)
    return { ok: false, error: '같은 호텔은 연결할 수 없습니다' };
  try {
    // 양방향: 두 행을 upsert (이미 있으면 재활성화)
    await db
      .insert(hotelManagedLinks)
      .values([
        { hotelId, linkedHotelId },
        { hotelId: linkedHotelId, linkedHotelId: hotelId },
      ])
      .onConflictDoUpdate({
        target: [hotelManagedLinks.hotelId, hotelManagedLinks.linkedHotelId],
        set: { isActive: true, updatedAt: new Date() },
      });
    logActivity({
      userId: ctx.user.id,
      action: 'hotel.managed.link',
      targetType: 'hotel',
      targetId: hotelId,
      payload: { linkedHotelId },
    });
    revalidatePath(`/admin/hotels/${hotelId}`);
    revalidatePath(`/admin/hotels/${linkedHotelId}`);
    return { ok: true };
  } catch (err) {
    console.error('[addManagedHotelAction] 실패:', err);
    return { ok: false, error: '멀티관리 연결 중 오류가 발생했습니다' };
  }
});

export const removeManagedHotelAction = withAuthorizedAction<
  FormData,
  ActionResult
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };
  const hotelId = (formData.get('hotelId') as string) ?? '';
  const linkedHotelId = (formData.get('linkedHotelId') as string) ?? '';
  if (
    !uuidSchema.safeParse(hotelId).success ||
    !uuidSchema.safeParse(linkedHotelId).success
  )
    return { ok: false, error: '잘못된 요청' };
  try {
    // 양방향 해제 (soft delete)
    await db
      .update(hotelManagedLinks)
      .set({ isActive: false })
      .where(
        and(
          eq(hotelManagedLinks.hotelId, hotelId),
          eq(hotelManagedLinks.linkedHotelId, linkedHotelId),
        ),
      );
    await db
      .update(hotelManagedLinks)
      .set({ isActive: false })
      .where(
        and(
          eq(hotelManagedLinks.hotelId, linkedHotelId),
          eq(hotelManagedLinks.linkedHotelId, hotelId),
        ),
      );
    logActivity({
      userId: ctx.user.id,
      action: 'hotel.managed.unlink',
      targetType: 'hotel',
      targetId: hotelId,
      payload: { linkedHotelId },
    });
    revalidatePath(`/admin/hotels/${hotelId}`);
    revalidatePath(`/admin/hotels/${linkedHotelId}`);
    return { ok: true };
  } catch (err) {
    console.error('[removeManagedHotelAction] 실패:', err);
    return { ok: false, error: '멀티관리 해제 중 오류가 발생했습니다' };
  }
});

// ─── 슬랙 채널 연동 (N:N, 2026-06-09) ───────────────────────────────
//
// 어드민 호텔 상세 `슬랙 채널 연동` 섹션. 채널 검색 후 연동(봇 자동입장)·
// 해제(soft delete)·테스트 발송·상태 새로고침을 담당.

const channelIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((v) => looksLikeChannelId(v), '올바른 Slack 채널 ID가 아닙니다');

/**
 * 호텔에 Slack 채널을 연동한다.
 * - 공개 채널: `conversations.join`으로 봇 자동입장 → bot_joined=true.
 * - 비공개 채널/입장 실패: 매핑은 저장하되 bot_joined=false ('봇 미초대').
 * - bot_joined=true가 되면 채널에 '연동 완료' 첫 메시지를 자동 게시.
 */
export const linkHotelSlackChannelAction = withAuthorizedAction<
  FormData,
  ActionResult
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };
  const hotelId = (formData.get('hotelId') as string) ?? '';
  const rawChannel = (formData.get('channelId') as string) ?? '';
  const fallbackName = ((formData.get('channelName') as string) ?? '').trim();

  if (!uuidSchema.safeParse(hotelId).success)
    return { ok: false, error: '잘못된 요청' };
  const parsedChannel = channelIdSchema.safeParse(rawChannel);
  if (!parsedChannel.success)
    return { ok: false, error: parsedChannel.error.issues[0]?.message ?? '잘못된 채널 ID' };
  const channelId = parsedChannel.data;

  try {
    // 호텔 존재 확인 (이름은 연동 완료 메시지에 사용)
    const hotelRow = await db
      .select({ name: hotels.name })
      .from(hotels)
      .where(eq(hotels.id, hotelId))
      .limit(1);
    if (hotelRow.length === 0) return { ok: false, error: '호텔을 찾을 수 없습니다' };
    const hotelName = hotelRow[0].name;

    // 권위 있는 채널 메타 조회 (토큰/스코프 없으면 null → 폴백)
    const info = await getSlackChannelInfo(channelId);
    const channelName = info?.name ?? (fallbackName || null);
    const channelIsPrivate = info?.isPrivate ?? false;

    // 봇 멤버 여부 결정: 이미 멤버면 true, 공개채널이면 join 시도, 비공개는 불가
    let botJoined = info?.isMember ?? false;
    if (!botJoined && !channelIsPrivate) {
      const joined = await joinSlackChannel(channelId);
      botJoined = joined.botJoined;
    }

    await db
      .insert(hotelSlackChannels)
      .values({
        hotelId,
        channelId,
        channelName,
        channelIsPrivate,
        botJoined,
        linkedByUserId: ctx.user.id,
      })
      .onConflictDoUpdate({
        target: [hotelSlackChannels.hotelId, hotelSlackChannels.channelId],
        set: {
          isActive: true,
          channelName,
          channelIsPrivate,
          botJoined,
          // 재연동(해제 후 다시 연동) 시 알림은 기본 재개 상태로 복귀.
          notifyEnabled: true,
          linkedByUserId: ctx.user.id,
          updatedAt: new Date(),
        },
      });

    // 연동 성공(봇 참여) 시 채널에 첫 메시지 자동 게시
    if (botJoined) {
      await notifySlack(
        {
          channel: { rawId: channelId },
          fallbackText: `${hotelName} 접수 알림이 이 채널에 연동되었습니다.`,
          blocks: buildHotelSlackLinkedBlocks(hotelName),
        },
        { eventKey: 'hotel.slack_linked' },
      );
    }

    logActivity({
      userId: ctx.user.id,
      action: 'hotel.slack.link',
      targetType: 'hotel',
      targetId: hotelId,
      payload: { channelId, channelName, botJoined, channelIsPrivate },
    });
    revalidatePath(`/admin/hotels/${hotelId}`);
    return {
      ok: true,
      data: { botJoined, channelIsPrivate, channelName },
    };
  } catch (err) {
    console.error('[linkHotelSlackChannelAction] 실패:', err);
    return { ok: false, error: '슬랙 채널 연동 중 오류가 발생했습니다' };
  }
});

/** 호텔-슬랙 채널 연동 해제 (soft delete). */
export const unlinkHotelSlackChannelAction = withAuthorizedAction<
  FormData,
  ActionResult
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };
  const hotelId = (formData.get('hotelId') as string) ?? '';
  const channelId = ((formData.get('channelId') as string) ?? '').trim();
  if (!uuidSchema.safeParse(hotelId).success || !channelId)
    return { ok: false, error: '잘못된 요청' };
  try {
    await db
      .update(hotelSlackChannels)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(hotelSlackChannels.hotelId, hotelId),
          eq(hotelSlackChannels.channelId, channelId),
        ),
      );
    logActivity({
      userId: ctx.user.id,
      action: 'hotel.slack.unlink',
      targetType: 'hotel',
      targetId: hotelId,
      payload: { channelId },
    });
    revalidatePath(`/admin/hotels/${hotelId}`);
    return { ok: true };
  } catch (err) {
    console.error('[unlinkHotelSlackChannelAction] 실패:', err);
    return { ok: false, error: '연동 해제 중 오류가 발생했습니다' };
  }
});

/**
 * 연동 채널의 신규 접수 알림 발송 on/off 토글.
 * 연동(매핑)은 유지한 채 알림만 일시 정지/재개한다 (테스트 발송은 영향 없음).
 */
export const toggleHotelSlackChannelNotifyAction = withAuthorizedAction<
  FormData,
  ActionResult<{ notifyEnabled: boolean }>
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };
  const hotelId = (formData.get('hotelId') as string) ?? '';
  const channelId = ((formData.get('channelId') as string) ?? '').trim();
  const enabled = (formData.get('enabled') as string) === '1';
  if (!uuidSchema.safeParse(hotelId).success || !channelId)
    return { ok: false, error: '잘못된 요청' };
  try {
    await db
      .update(hotelSlackChannels)
      .set({ notifyEnabled: enabled, updatedAt: new Date() })
      .where(
        and(
          eq(hotelSlackChannels.hotelId, hotelId),
          eq(hotelSlackChannels.channelId, channelId),
        ),
      );
    logActivity({
      userId: ctx.user.id,
      action: 'hotel.slack.notify_toggle',
      targetType: 'hotel',
      targetId: hotelId,
      payload: { channelId, notifyEnabled: enabled },
    });
    revalidatePath(`/admin/hotels/${hotelId}`);
    return { ok: true, data: { notifyEnabled: enabled } };
  } catch (err) {
    console.error('[toggleHotelSlackChannelNotifyAction] 실패:', err);
    return { ok: false, error: '알림 설정 변경 중 오류가 발생했습니다' };
  }
});

/** 연동 채널로 테스트 메시지 발송. */
export const sendTestHotelSlackChannelAction = withAuthorizedAction<
  FormData,
  ActionResult
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };
  const hotelId = (formData.get('hotelId') as string) ?? '';
  const channelId = ((formData.get('channelId') as string) ?? '').trim();
  if (!uuidSchema.safeParse(hotelId).success || !channelId)
    return { ok: false, error: '잘못된 요청' };
  try {
    const hotelRow = await db
      .select({ name: hotels.name })
      .from(hotels)
      .where(eq(hotels.id, hotelId))
      .limit(1);
    const hotelName = hotelRow[0]?.name ?? '호텔';

    const result = await notifySlack(
      {
        channel: { rawId: channelId },
        fallbackText: `${hotelName} 연동 테스트 메시지`,
        blocks: buildHotelSlackTestBlocks(hotelName),
      },
      { eventKey: 'hotel.slack_test' },
    );
    logActivity({
      userId: ctx.user.id,
      action: 'hotel.slack.test',
      targetType: 'hotel',
      targetId: hotelId,
      payload: { channelId, ok: result.ok },
    });
    if (!result.ok) {
      return {
        ok: false,
        error: `발송 실패: ${result.error}. 봇이 채널에 없으면 /invite 후 다시 시도하세요.`,
      };
    }
    if ('stub' in result && result.stub) {
      return {
        ok: false,
        error: 'Slack 토큰/스코프 미설정 — 실제 발송되지 않았습니다 (stub).',
      };
    }
    return { ok: true };
  } catch (err) {
    console.error('[sendTestHotelSlackChannelAction] 실패:', err);
    return { ok: false, error: '테스트 발송 중 오류가 발생했습니다' };
  }
});

/** 연동 채널의 봇 참여 상태·채널명을 Slack에서 다시 조회해 갱신. */
export const refreshHotelSlackChannelAction = withAuthorizedAction<
  FormData,
  ActionResult
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };
  const hotelId = (formData.get('hotelId') as string) ?? '';
  const channelId = ((formData.get('channelId') as string) ?? '').trim();
  if (!uuidSchema.safeParse(hotelId).success || !channelId)
    return { ok: false, error: '잘못된 요청' };
  try {
    const info = await getSlackChannelInfo(channelId);
    if (!info) {
      return {
        ok: false,
        error: '채널 정보를 가져오지 못했습니다 (토큰/스코프 또는 채널 접근 확인).',
      };
    }
    await db
      .update(hotelSlackChannels)
      .set({
        channelName: info.name,
        channelIsPrivate: info.isPrivate,
        botJoined: info.isMember,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(hotelSlackChannels.hotelId, hotelId),
          eq(hotelSlackChannels.channelId, channelId),
        ),
      );
    revalidatePath(`/admin/hotels/${hotelId}`);
    return { ok: true, data: { botJoined: info.isMember } };
  } catch (err) {
    console.error('[refreshHotelSlackChannelAction] 실패:', err);
    return { ok: false, error: '상태 새로고침 중 오류가 발생했습니다' };
  }
});
