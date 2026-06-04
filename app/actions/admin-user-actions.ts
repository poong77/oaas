'use server';

/**
 * 어드민 사용자 관리 Server Actions.
 *
 * AC-06: 리스트 조회 (페이지에서 직접 호출)
 * AC-07: 사용자 생성
 * AC-08: 편집 (호텔 매핑·권한·정보)
 * AC-09: 비밀번호 초기화
 * AC-10: 활성·비활성 토글
 */

import { revalidatePath } from 'next/cache';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db';
import { hotels, users, type UserRole } from '@/db/schema';
import { withAuthorizedAction } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import { normalizeKoreanPhone } from '@/lib/text/phone';
import {
  generateTempPassword,
  hashPassword,
} from '@/lib/services/users';
import { sendEmail } from '@/lib/notifications/ses';
import { sendSms } from '@/lib/notifications/solapi';
import {
  buildAccountInvite,
  buildPasswordReset,
} from '@/lib/notifications/templates';
import { getPublicBaseUrl } from '@/lib/env';

type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fields?: Record<string, string> };

const phoneRegex = /^[0-9\-+\s()]{7,20}$/;
const RoleEnum = z.enum(['hotelier', 'manager', 'admin']);

/** 신규 계정 초기 비밀번호 (고정). 첫 로그인 시 변경 권고. */
const DEFAULT_INITIAL_PASSWORD = '123456';

/** 아이디 허용 문자: 영문/숫자/. _ - @ + (이메일형 아이디 허용) */
const usernameRegex = /^[A-Za-z0-9._@+-]{2,100}$/;

const CreateUserSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100),
  username: z
    .string()
    .trim()
    .min(2, '아이디는 2자 이상이어야 합니다')
    .max(100)
    .regex(usernameRegex, '영문·숫자와 . _ - @ 만 사용 가능합니다'),
  // 이메일은 선택값. 미입력 시 아이디 기반으로 자동 생성(@as.local).
  email: z
    .string()
    .max(200)
    .optional()
    .or(z.literal(''))
    .refine(
      (v) => !v || z.string().email().safeParse(v).success,
      '올바른 이메일이 아닙니다',
    ),
  title: z.string().max(100).optional().or(z.literal('')),
  phone: z
    .string()
    .max(30)
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || phoneRegex.test(v), '올바른 연락처 형식이 아닙니다'),
  role: RoleEnum,
  hotelId: z.string().uuid().optional().or(z.literal('')),
});

// AC-07: 사용자 생성 (어드민)
export const createUserAdminAction = withAuthorizedAction<
  FormData,
  ActionResult<{ tempPassword: string; emailSent: boolean; smsSent: boolean }>
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };

  const parsed = CreateUserSchema.safeParse({
    name: formData.get('name'),
    username: formData.get('username'),
    email: formData.get('email') ?? '',
    title: formData.get('title') ?? '',
    phone: formData.get('phone') ?? '',
    role: formData.get('role'),
    hotelId: formData.get('hotelId') ?? '',
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

  // 호텔리어인데 hotelId 없으면 거절
  if (parsed.data.role === 'hotelier' && !parsed.data.hotelId) {
    return {
      ok: false,
      error: '호텔리어는 호텔 매핑이 필요합니다',
      fields: { hotelId: '호텔을 선택해주세요' },
    };
  }

  const username = parsed.data.username.trim();

  // 아이디 중복 확인 (username 은 유니크)
  const dupe = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (dupe.length > 0) {
    return {
      ok: false,
      error: '이미 사용 중인 아이디입니다',
      fields: { username: '이미 사용 중인 아이디입니다' },
    };
  }

  // 이메일 결정: 입력값(실이메일) 우선 → 없으면 아이디 기반.
  const rawEmail = (parsed.data.email ?? '').trim().toLowerCase();
  const hasRealEmail = !!rawEmail;
  const email = hasRealEmail
    ? rawEmail
    : username.includes('@')
      ? username.toLowerCase()
      : `${username.toLowerCase()}@as.local`;

  try {
    const tempPassword = DEFAULT_INITIAL_PASSWORD;
    const passwordHash = await hashPassword(tempPassword);

    const [created] = await db
      .insert(users)
      .values({
        name: parsed.data.name,
        username,
        email,
        title: parsed.data.title || null,
        phone: parsed.data.phone || null,
        passwordHash,
        role: parsed.data.role,
        hotelId: parsed.data.hotelId || null,
        mustChangePassword: true,
        invitedBy: ctx.user.id,
      })
      .returning({ id: users.id });

    logActivity({
      userId: ctx.user.id,
      action: 'user.create',
      targetType: 'user',
      targetId: created?.id,
      payload: { role: parsed.data.role, hotelId: parsed.data.hotelId || null },
    });

    // 실이메일이 있을 때만 초대 메일 발송 (더미 @as.local 은 발송 안 함)
    const loginUrl = getPublicBaseUrl() + '/login';
    const tpl = buildAccountInvite({
      name: parsed.data.name,
      email,
      tempPassword,
      loginUrl,
      invitedByName: ctx.user.name ?? undefined,
    });
    let emailSent = false;
    if (hasRealEmail) {
      const r = await sendEmail({
        to: email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
      emailSent = r.ok;
    }
    const smsResult = parsed.data.phone
      ? await sendSms({ to: parsed.data.phone, text: tpl.sms })
      : { ok: false as const, error: 'no phone' };

    revalidatePath('/admin/users');
    return {
      ok: true,
      data: {
        tempPassword,
        emailSent,
        smsSent: smsResult.ok,
      },
    };
  } catch (err) {
    console.error('[createUserAdminAction] 실패:', err);
    return { ok: false, error: '사용자 생성 중 오류가 발생했습니다' };
  }
});

const UpdateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  title: z.string().max(100).optional().or(z.literal('')),
  phone: z
    .string()
    .max(30)
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || phoneRegex.test(v), '올바른 연락처 형식이 아닙니다'),
  role: RoleEnum,
  hotelId: z.string().uuid().optional().or(z.literal('')),
});

// AC-08: 사용자 편집 (어드민)
export const updateUserAdminAction = withAuthorizedAction<
  FormData,
  ActionResult
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };

  const parsed = UpdateUserSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    title: formData.get('title') ?? '',
    phone: formData.get('phone') ?? '',
    role: formData.get('role'),
    hotelId: formData.get('hotelId') ?? '',
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

  if (parsed.data.role === 'hotelier' && !parsed.data.hotelId) {
    return {
      ok: false,
      error: '호텔리어는 호텔 매핑이 필요합니다',
      fields: { hotelId: '호텔을 선택해주세요' },
    };
  }

  try {
    const before = await db
      .select({ role: users.role, hotelId: users.hotelId })
      .from(users)
      .where(eq(users.id, parsed.data.id))
      .limit(1);
    if (!before[0]) return { ok: false, error: '대상을 찾을 수 없습니다' };

    await db
      .update(users)
      .set({
        name: parsed.data.name,
        title: parsed.data.title || null,
        phone: parsed.data.phone || null,
        role: parsed.data.role as UserRole,
        hotelId: parsed.data.hotelId || null,
      })
      .where(eq(users.id, parsed.data.id));

    if (before[0].role !== parsed.data.role) {
      logActivity({
        userId: ctx.user.id,
        action: 'user.role_change',
        targetType: 'user',
        targetId: parsed.data.id,
        payload: { before: before[0].role, after: parsed.data.role },
      });
    }
    logActivity({
      userId: ctx.user.id,
      action: 'user.update',
      targetType: 'user',
      targetId: parsed.data.id,
      payload: { mode: 'admin_edit' },
    });

    revalidatePath('/admin/users');
    revalidatePath(`/admin/users/${parsed.data.id}`);
    return { ok: true };
  } catch (err) {
    console.error('[updateUserAdminAction] 실패:', err);
    return { ok: false, error: '편집 중 오류가 발생했습니다' };
  }
});

// AC-10: 활성 토글
export const toggleUserActiveAdminAction = withAuthorizedAction<
  FormData,
  ActionResult
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };
  const id = (formData.get('id') as string) ?? '';
  if (!z.string().uuid().safeParse(id).success)
    return { ok: false, error: '잘못된 요청' };
  if (id === ctx.user.id)
    return { ok: false, error: '본인 계정은 비활성화할 수 없습니다' };

  try {
    const rows = await db
      .select({ isActive: users.isActive })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!rows[0]) return { ok: false, error: '대상을 찾을 수 없습니다' };
    const next = !rows[0].isActive;
    await db.update(users).set({ isActive: next }).where(eq(users.id, id));
    logActivity({
      userId: ctx.user.id,
      action: next ? 'user.activate' : 'user.deactivate',
      targetType: 'user',
      targetId: id,
    });
    revalidatePath('/admin/users');
    revalidatePath(`/admin/users/${id}`);
    return { ok: true };
  } catch (err) {
    console.error('[toggleUserActiveAdminAction] 실패:', err);
    return { ok: false, error: '변경 중 오류가 발생했습니다' };
  }
});

// AC-10b: 사용자 일괄 활성/비활성 (소프트 삭제 = 비활성화)
const BulkActiveSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  active: z.boolean(),
});

export const bulkSetUsersActiveAction = withAuthorizedAction<
  FormData,
  ActionResult<{ affected: number; skippedSelf: boolean }>
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };

  const rawIds = String(formData.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const active = String(formData.get('active') ?? '') === '1';

  const parsed = BulkActiveSchema.safeParse({ ids: rawIds, active });
  if (!parsed.success) return { ok: false, error: '잘못된 요청입니다' };

  // 비활성화 시 본인 계정은 제외(자기 잠금 방지).
  let ids = parsed.data.ids;
  let skippedSelf = false;
  if (!active) {
    const before = ids.length;
    ids = ids.filter((id) => id !== ctx.user.id);
    skippedSelf = ids.length !== before;
  }
  if (ids.length === 0)
    return { ok: false, error: '본인 계정은 비활성화할 수 없습니다' };

  try {
    const updated = await db
      .update(users)
      .set({ isActive: active, updatedAt: new Date() })
      .where(inArray(users.id, ids))
      .returning({ id: users.id });

    logActivity({
      userId: ctx.user.id,
      action: active ? 'user.activate' : 'user.deactivate',
      targetType: 'user',
      payload: { bulk: true, count: updated.length, ids },
    });

    revalidatePath('/admin/users');
    return {
      ok: true,
      data: { affected: updated.length, skippedSelf },
    };
  } catch (err) {
    console.error('[bulkSetUsersActiveAction] 실패:', err);
    return { ok: false, error: '일괄 변경 중 오류가 발생했습니다' };
  }
});

// AC-09: 비밀번호 초기화
export const resetUserPasswordAdminAction = withAuthorizedAction<
  FormData,
  ActionResult<{ tempPassword: string; emailSent: boolean; smsSent: boolean }>
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };
  const id = (formData.get('id') as string) ?? '';
  if (!z.string().uuid().safeParse(id).success)
    return { ok: false, error: '잘못된 요청' };

  try {
    const rows = await db
      .select({
        email: users.email,
        phone: users.phone,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!rows[0]) return { ok: false, error: '대상을 찾을 수 없습니다' };

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    await db
      .update(users)
      .set({ passwordHash, mustChangePassword: true })
      .where(eq(users.id, id));

    logActivity({
      userId: ctx.user.id,
      action: 'user.password_reset',
      targetType: 'user',
      targetId: id,
    });

    const loginUrl = getPublicBaseUrl() + '/login';
    const tpl = buildPasswordReset({
      name: rows[0].name,
      tempPassword,
      loginUrl,
    });
    const emailResult = await sendEmail({
      to: rows[0].email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    const smsResult = rows[0].phone
      ? await sendSms({ to: rows[0].phone, text: tpl.sms })
      : { ok: false as const, error: 'no phone' };

    return {
      ok: true,
      data: {
        tempPassword,
        emailSent: emailResult.ok,
        smsSent: smsResult.ok,
      },
    };
  } catch (err) {
    console.error('[resetUserPasswordAdminAction] 실패:', err);
    return { ok: false, error: '비밀번호 초기화 중 오류가 발생했습니다' };
  }
});

// ─────────────────────────────────────────────────────────────────────
// 호텔 (어드민)
// ─────────────────────────────────────────────────────────────────────

const HotelSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, '호텔명을 입력해주세요').max(200),
  oaPmsHotelId: z.string().max(100).optional().or(z.literal('')),
  businessNo: z.string().max(30).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  phone: z
    .string()
    .max(30)
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || phoneRegex.test(v), '올바른 연락처 형식이 아닙니다'),
  managerName: z.string().max(100).optional().or(z.literal('')),
  note: z.string().max(2000).optional().or(z.literal('')),
});

export const upsertHotelAdminAction = withAuthorizedAction<
  FormData,
  ActionResult
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };

  const parsed = HotelSchema.safeParse({
    id: (formData.get('id') as string) || undefined,
    name: formData.get('name'),
    oaPmsHotelId: formData.get('oaPmsHotelId') ?? '',
    businessNo: formData.get('businessNo') ?? '',
    address: formData.get('address') ?? '',
    phone: formData.get('phone') ?? '',
    managerName: formData.get('managerName') ?? '',
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

  // 연락처는 한국 번호 표기로 통일. 전화번호가 아니면(빈값/이메일 등) 원본 유지.
  const normalizedPhone =
    normalizeKoreanPhone(parsed.data.phone) ?? (parsed.data.phone || null);

  try {
    if (parsed.data.id) {
      await db
        .update(hotels)
        .set({
          name: parsed.data.name,
          oaPmsHotelId: parsed.data.oaPmsHotelId || null,
          businessNo: parsed.data.businessNo || null,
          address: parsed.data.address || null,
          phone: normalizedPhone,
          managerName: parsed.data.managerName || null,
          note: parsed.data.note || null,
        })
        .where(eq(hotels.id, parsed.data.id));
      logActivity({
        userId: ctx.user.id,
        action: 'hotel.update',
        targetType: 'hotel',
        targetId: parsed.data.id,
      });
    } else {
      const [inserted] = await db
        .insert(hotels)
        .values({
          name: parsed.data.name,
          oaPmsHotelId: parsed.data.oaPmsHotelId || null,
          businessNo: parsed.data.businessNo || null,
          address: parsed.data.address || null,
          phone: normalizedPhone,
          managerName: parsed.data.managerName || null,
          note: parsed.data.note || null,
        })
        .returning({ id: hotels.id });
      logActivity({
        userId: ctx.user.id,
        action: 'hotel.create',
        targetType: 'hotel',
        targetId: inserted?.id,
      });
    }
    revalidatePath('/admin/hotels');
    return { ok: true };
  } catch (err) {
    console.error('[upsertHotelAdminAction] 실패:', err);
    return { ok: false, error: '호텔 저장 중 오류가 발생했습니다' };
  }
});

// 사용자 생성 화면의 '신규 호텔' 팝업 — 호텔명(필수) + 기타 정보로 즉시 생성하고 id 반환.
const QuickHotelSchema = z.object({
  name: z.string().min(1, '호텔명을 입력해주세요').max(200),
  phone: z
    .string()
    .max(30)
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || phoneRegex.test(v), '올바른 연락처 형식이 아닙니다'),
  address: z.string().max(500).optional().or(z.literal('')),
  businessNo: z.string().max(30).optional().or(z.literal('')),
  managerName: z.string().max(100).optional().or(z.literal('')),
  oaPmsHotelId: z.string().max(100).optional().or(z.literal('')),
});

export const quickCreateHotelAction = withAuthorizedAction<
  FormData,
  ActionResult<{ id: string; name: string }>
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };

  const parsed = QuickHotelSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') ?? '',
    address: formData.get('address') ?? '',
    businessNo: formData.get('businessNo') ?? '',
    managerName: formData.get('managerName') ?? '',
    oaPmsHotelId: formData.get('oaPmsHotelId') ?? '',
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

  const normalizedPhone =
    normalizeKoreanPhone(parsed.data.phone) ?? (parsed.data.phone || null);

  try {
    const [inserted] = await db
      .insert(hotels)
      .values({
        name: parsed.data.name.trim(),
        phone: normalizedPhone,
        address: parsed.data.address || null,
        businessNo: parsed.data.businessNo || null,
        managerName: parsed.data.managerName || null,
        oaPmsHotelId: parsed.data.oaPmsHotelId || null,
      })
      .returning({ id: hotels.id, name: hotels.name });

    logActivity({
      userId: ctx.user.id,
      action: 'hotel.create',
      targetType: 'hotel',
      targetId: inserted?.id,
    });
    revalidatePath('/admin/users');
    revalidatePath('/admin/hotels');
    return { ok: true, data: { id: inserted!.id, name: inserted!.name } };
  } catch (err) {
    console.error('[quickCreateHotelAction] 실패:', err);
    return { ok: false, error: '호텔 생성 중 오류가 발생했습니다' };
  }
});

export const toggleHotelActiveAdminAction = withAuthorizedAction<
  FormData,
  ActionResult
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };
  const id = (formData.get('id') as string) ?? '';
  if (!z.string().uuid().safeParse(id).success)
    return { ok: false, error: '잘못된 요청' };
  try {
    const rows = await db
      .select({ isActive: hotels.isActive })
      .from(hotels)
      .where(eq(hotels.id, id))
      .limit(1);
    if (!rows[0]) return { ok: false, error: '대상을 찾을 수 없습니다' };
    const next = !rows[0].isActive;
    await db.update(hotels).set({ isActive: next }).where(eq(hotels.id, id));
    logActivity({
      userId: ctx.user.id,
      action: next ? 'hotel.activate' : 'hotel.deactivate',
      targetType: 'hotel',
      targetId: id,
    });
    revalidatePath('/admin/hotels');
    return { ok: true };
  } catch (err) {
    console.error('[toggleHotelActiveAdminAction] 실패:', err);
    return { ok: false, error: '변경 중 오류가 발생했습니다' };
  }
});

// 호텔 일괄 활성/비활성 (소프트 삭제 = 비활성화)
export const bulkSetHotelsActiveAction = withAuthorizedAction<
  FormData,
  ActionResult<{ affected: number }>
>(['admin'], async (ctx, formData) => {
  if (!db) return { ok: false, error: 'DB 미연결' };

  const rawIds = String(formData.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const active = String(formData.get('active') ?? '') === '1';

  const parsed = BulkActiveSchema.safeParse({ ids: rawIds, active });
  if (!parsed.success) return { ok: false, error: '잘못된 요청입니다' };

  try {
    const updated = await db
      .update(hotels)
      .set({ isActive: active, updatedAt: new Date() })
      .where(inArray(hotels.id, parsed.data.ids))
      .returning({ id: hotels.id });

    logActivity({
      userId: ctx.user.id,
      action: active ? 'hotel.activate' : 'hotel.deactivate',
      targetType: 'hotel',
      payload: { bulk: true, count: updated.length, ids: parsed.data.ids },
    });

    revalidatePath('/admin/hotels');
    return { ok: true, data: { affected: updated.length } };
  } catch (err) {
    console.error('[bulkSetHotelsActiveAction] 실패:', err);
    return { ok: false, error: '일괄 변경 중 오류가 발생했습니다' };
  }
});
