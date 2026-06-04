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

const CreateStaffSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100),
  title: z.string().max(100).optional().or(z.literal('')),
  email: z.string().email('올바른 이메일이 아닙니다').max(200),
  phone: z
    .string()
    .min(1, '연락처를 입력해주세요')
    .max(30)
    .refine((v) => phoneRegex.test(v), '올바른 연락처 형식이 아닙니다'),
});

export async function createStaffAction(
  formData: FormData,
): Promise<ActionResult<{ tempPassword: string; smsSent: boolean; emailSent: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다' };
  if (!user.hotelId)
    return { ok: false, error: '호텔이 매핑되지 않은 계정입니다' };
  if (!db) return { ok: false, error: 'DB 미연결' };

  const parsed = CreateStaffSchema.safeParse({
    name: formData.get('name'),
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
    if (await emailExists(parsed.data.email)) {
      return {
        ok: false,
        error: '이미 사용 중인 이메일입니다',
        fields: { email: '이미 사용 중인 이메일입니다' },
      };
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const [created] = await db
      .insert(users)
      .values({
        name: parsed.data.name,
        title: parsed.data.title || null,
        email: parsed.data.email,
        phone: parsed.data.phone,
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
      payload: { mode: 'staff_invite', role: 'hotelier' },
    });

    // 초대 SMS/이메일 (실패해도 계정 생성은 성공으로 처리)
    const loginUrl = getPublicBaseUrl() + '/login';
    const tpl = buildAccountInvite({
      name: parsed.data.name,
      email: parsed.data.email,
      tempPassword,
      loginUrl,
      invitedByName: user.name ?? undefined,
    });
    const emailResult = await sendEmail({
      to: parsed.data.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    const smsResult = await sendSms({ to: parsed.data.phone, text: tpl.sms });

    revalidatePath('/profile/staff');
    return {
      ok: true,
      data: {
        tempPassword,
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

  try {
    await db
      .update(users)
      .set({
        name: parsed.data.name,
        title: parsed.data.title || null,
        phone: parsed.data.phone || null,
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
