'use server';

/**
 * 호텔리어가 본인 숙소 직원을 관리하는 Server Actions.
 *
 * AC-04: 직원 추가 (초대 SMS/이메일 자동)
 * AC-05: 편집·비활성화·재활성화
 *
 * 권한: 본인 hotel_id와 동일한 직원만 접근 가능.
 */

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db';
import { users } from '@/db/schema';
import { getCurrentUser } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import {
  emailExists,
  generateTempPassword,
  hashPassword,
} from '@/lib/services/users';
import { sendEmail } from '@/lib/notifications/ses';
import { sendSms } from '@/lib/notifications/solapi';
import { buildAccountInvite } from '@/lib/notifications/templates';
import { getPublicBaseUrl } from '@/lib/env';

type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fields?: Record<string, string> };

const phoneRegex = /^[0-9\-+\s()]{7,20}$/;

const usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;

const CreateStaffSchema = z
  .object({
    name: z.string().min(1, '이름을 입력해주세요').max(100),
    username: z
      .string()
      .min(1, '로그인 ID를 입력해주세요')
      .refine(
        (v) => usernameRegex.test(v),
        '로그인 ID는 영문/숫자/._- 3~30자입니다',
      ),
    title: z.string().max(100).optional().or(z.literal('')),
    // 이메일·연락처는 택일(둘 중 하나 이상). 각각은 선택 입력.
    email: z
      .union([
        z.string().email('올바른 이메일이 아닙니다').max(200),
        z.literal(''),
      ])
      .optional(),
    phone: z
      .union([
        z
          .string()
          .max(30)
          .refine((v) => phoneRegex.test(v), '올바른 연락처 형식이 아닙니다'),
        z.literal(''),
      ])
      .optional(),
  })
  .refine((d) => !!d.email?.trim() || !!d.phone?.trim(), {
    message: '이메일 또는 연락처 중 하나는 입력해주세요',
    path: ['email'],
  });

/** 로그인 ID(username) 중복 검사. */
async function usernameTaken(username: string): Promise<boolean> {
  const rows = await db!
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return rows.length > 0;
}

/** 로그인 ID 실시간 사용가능 여부 (직원 추가 폼 인라인 체크). */
export async function checkUsernameAvailableAction(
  username: string,
): Promise<{ ok: boolean; available: boolean; reason?: 'invalid' | 'taken' }> {
  const user = await getCurrentUser();
  if (!user || !user.hotelId || !db) return { ok: false, available: false };
  const u = (username ?? '').trim();
  if (!usernameRegex.test(u)) {
    return { ok: true, available: false, reason: 'invalid' };
  }
  const taken = await usernameTaken(u);
  return { ok: true, available: !taken, reason: taken ? 'taken' : undefined };
}

export async function createStaffAction(
  formData: FormData,
): Promise<
  ActionResult<{
    tempPassword: string;
    username: string;
    smsSent: boolean;
    emailSent: boolean;
  }>
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다' };
  if (!user.hotelId)
    return { ok: false, error: '호텔이 매핑되지 않은 계정입니다' };
  if (!db) return { ok: false, error: 'DB 미연결' };

  const parsed = CreateStaffSchema.safeParse({
    name: formData.get('name'),
    username: (formData.get('username') ?? '').toString().trim(),
    title: formData.get('title') ?? '',
    email: formData.get('email'),
    phone: formData.get('phone'),
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

  try {
    const realEmail = parsed.data.email?.trim() || null;
    const phone = parsed.data.phone?.trim() || null;

    const username = parsed.data.username;

    // 로그인 ID(username) 중복 검사 — 수기 입력·필수.
    if (await usernameTaken(username)) {
      return {
        ok: false,
        error: '이미 사용 중인 로그인 ID입니다',
        fields: { username: '이미 사용 중인 로그인 ID입니다' },
      };
    }

    if (realEmail && (await emailExists(realEmail))) {
      return {
        ok: false,
        error: '이미 사용 중인 이메일입니다',
        fields: { email: '이미 사용 중인 이메일입니다' },
      };
    }

    // 이메일 미입력(연락처만)이면 NULL 저장. 더미 플레이스홀더 생성 금지.
    const emailToStore = realEmail;

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const [created] = await db
      .insert(users)
      .values({
        name: parsed.data.name,
        title: parsed.data.title || null,
        username,
        email: emailToStore,
        phone,
        passwordHash,
        role: 'hotelier',
        hotelId: user.hotelId,
        mustChangePassword: true,
        invitedBy: user.id,
      })
      .returning({ id: users.id });

    logActivity({
      userId: user.id,
      action: 'user.create',
      targetType: 'user',
      targetId: created?.id,
      payload: { mode: 'staff_invite', role: 'hotelier', username },
    });

    // 초대 — 실제 이메일 있으면 메일, 연락처 있으면 SMS (실패해도 생성은 성공).
    const loginUrl = getPublicBaseUrl() + '/login';
    const tpl = buildAccountInvite({
      name: parsed.data.name,
      email: realEmail ?? '',
      tempPassword,
      loginUrl,
      invitedByName: user.name ?? undefined,
    });
    const emailResult = realEmail
      ? await sendEmail({
          to: realEmail,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        })
      : { ok: false };
    const smsResult = phone
      ? await sendSms({ to: phone, text: tpl.sms })
      : { ok: false };

    revalidatePath('/profile/staff');
    return {
      ok: true,
      data: {
        tempPassword,
        username,
        emailSent: emailResult.ok,
        smsSent: smsResult.ok,
      },
    };
  } catch (err) {
    console.error('[createStaffAction] 실패:', err);
    return { ok: false, error: '직원 추가 중 오류가 발생했습니다' };
  }
}

const UpdateStaffSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  title: z.string().max(100).optional().or(z.literal('')),
  email: z
    .union([z.string().email('올바른 이메일이 아닙니다').max(200), z.literal('')])
    .optional(),
  phone: z
    .string()
    .max(30)
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || phoneRegex.test(v), '올바른 연락처 형식이 아닙니다'),
});

export async function updateStaffAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !user.hotelId)
    return { ok: false, error: '권한이 없습니다' };
  if (!db) return { ok: false, error: 'DB 미연결' };

  const parsed = UpdateStaffSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    title: formData.get('title') ?? '',
    email: formData.get('email') ?? '',
    phone: formData.get('phone') ?? '',
  });
  if (!parsed.success) {
    return { ok: false, error: '입력값을 확인해주세요' };
  }

  // 본인 호텔 직원인지 확인 + 자기 자신 수정 차단(이건 /profile에서)
  const rows = await db
    .select({ hotelId: users.hotelId })
    .from(users)
    .where(eq(users.id, parsed.data.id))
    .limit(1);
  if (!rows[0] || rows[0].hotelId !== user.hotelId) {
    return { ok: false, error: '권한이 없습니다' };
  }

  // 이메일 변경 시 중복 검사(본인 제외). email은 NOT NULL이라 빈 값이면 변경하지 않음.
  const newEmail = parsed.data.email?.trim() || null;
  if (newEmail) {
    const dup = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, newEmail))
      .limit(1);
    if (dup[0] && dup[0].id !== parsed.data.id) {
      return {
        ok: false,
        error: '이미 사용 중인 이메일입니다',
        fields: { email: '이미 사용 중인 이메일입니다' },
      };
    }
  }

  try {
    await db
      .update(users)
      .set({
        name: parsed.data.name,
        title: parsed.data.title || null,
        phone: parsed.data.phone || null,
        ...(newEmail ? { email: newEmail } : {}),
      })
      .where(eq(users.id, parsed.data.id));
    logActivity({
      userId: user.id,
      action: 'user.update',
      targetType: 'user',
      targetId: parsed.data.id,
      payload: { mode: 'staff_edit' },
    });
    revalidatePath('/profile/staff');
    return { ok: true };
  } catch (err) {
    console.error('[updateStaffAction] 실패:', err);
    return { ok: false, error: '수정 중 오류가 발생했습니다' };
  }
}

export async function toggleStaffActiveAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !user.hotelId)
    return { ok: false, error: '권한이 없습니다' };
  if (!db) return { ok: false, error: 'DB 미연결' };

  const id = (formData.get('id') as string) ?? '';
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: '잘못된 요청' };
  }
  if (id === user.id) {
    return { ok: false, error: '본인 계정은 직원 페이지에서 변경할 수 없습니다' };
  }

  try {
    const rows = await db
      .select({ hotelId: users.hotelId, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!rows[0] || rows[0].hotelId !== user.hotelId) {
      return { ok: false, error: '권한이 없습니다' };
    }
    const next = !rows[0].isActive;
    await db.update(users).set({ isActive: next }).where(eq(users.id, id));
    logActivity({
      userId: user.id,
      action: next ? 'user.activate' : 'user.deactivate',
      targetType: 'user',
      targetId: id,
    });
    revalidatePath('/profile/staff');
    return { ok: true };
  } catch (err) {
    console.error('[toggleStaffActiveAction] 실패:', err);
    return { ok: false, error: '변경 중 오류가 발생했습니다' };
  }
}
