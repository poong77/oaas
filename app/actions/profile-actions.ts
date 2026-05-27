'use server';

/**
 * 프로필 / 비밀번호 / 솔루션 링크 Server Actions.
 *
 * 호텔리어 본인 데이터만 수정 가능. 어드민은 별도 액션(admin-user-actions)에서.
 */

import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db';
import { hotels, hotelSolutionLinks, users } from '@/db/schema';
import { getCurrentUser } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import {
  MAX_SOLUTION_LINKS_PER_HOTEL,
  hashPassword,
  verifyPassword,
} from '@/lib/services/users';
import { sendEmail } from '@/lib/notifications/ses';
import { sendSms } from '@/lib/notifications/solapi';

type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fields?: Record<string, string> };

const phoneRegex = /^[0-9\-+\s()]{7,20}$/;

// ─────────────────────────────────────────────────────────────────────
// AC-01: 호텔리어 프로필 수정
// ─────────────────────────────────────────────────────────────────────

const UpdateProfileSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100),
  title: z.string().max(100).optional().or(z.literal('')),
  phone: z
    .string()
    .max(30)
    .optional()
    .or(z.literal(''))
    .refine(
      (v) => !v || phoneRegex.test(v),
      '올바른 연락처 형식이 아닙니다',
    ),
  // email은 본인 변경 가능. 어드민이 변경하는 케이스는 admin actions에.
  email: z.string().email('올바른 이메일이 아닙니다').max(200),
  hotelName: z.string().max(200).optional(),
  hotelPhone: z.string().max(30).optional(),
  hotelAddress: z.string().max(500).optional(),
});

export async function updateProfileAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다' };
  if (!db) return { ok: false, error: 'DB 미연결 (임시값 상태)' };

  const parsed = UpdateProfileSchema.safeParse({
    name: formData.get('name'),
    title: formData.get('title') ?? '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email'),
    hotelName: formData.get('hotelName') ?? '',
    hotelPhone: formData.get('hotelPhone') ?? '',
    hotelAddress: formData.get('hotelAddress') ?? '',
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
    // 이메일 중복 확인 (본인 제외)
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);
    if (existing[0] && existing[0].id !== user.id) {
      return {
        ok: false,
        error: '이미 사용 중인 이메일입니다',
        fields: { email: '이미 사용 중인 이메일입니다' },
      };
    }

    await db
      .update(users)
      .set({
        name: parsed.data.name,
        title: parsed.data.title || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email,
      })
      .where(eq(users.id, user.id));

    // 호텔리어이고 hotel이 있으면 일부 호텔 정보 업데이트 권한 부여
    if (user.role === 'hotelier' && user.hotelId) {
      await db
        .update(hotels)
        .set({
          name: parsed.data.hotelName || undefined,
          phone: parsed.data.hotelPhone || null,
          address: parsed.data.hotelAddress || null,
        })
        .where(eq(hotels.id, user.hotelId));
    }

    logActivity({
      userId: user.id,
      action: 'user.update',
      targetType: 'user',
      targetId: user.id,
      payload: { fields: ['name', 'title', 'phone', 'email'] },
    });

    revalidatePath('/profile');
    return { ok: true };
  } catch (err) {
    console.error('[updateProfileAction] 실패:', err);
    return { ok: false, error: '프로필 업데이트 중 오류가 발생했습니다' };
  }
}

// ─────────────────────────────────────────────────────────────────────
// AC-03: 비밀번호 변경
// ─────────────────────────────────────────────────────────────────────

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '현재 비밀번호를 입력해주세요'),
    newPassword: z
      .string()
      .min(8, '비밀번호는 8자 이상이어야 합니다')
      .max(72, '비밀번호는 72자 이하여야 합니다')
      .regex(/[a-zA-Z]/, '영문을 포함해야 합니다')
      .regex(/[0-9]/, '숫자를 포함해야 합니다'),
    newPasswordConfirm: z.string(),
  })
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    message: '비밀번호 확인이 일치하지 않습니다',
    path: ['newPasswordConfirm'],
  });

export async function changePasswordAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다' };
  if (!db) return { ok: false, error: 'DB 미연결' };

  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    newPasswordConfirm: formData.get('newPasswordConfirm'),
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
    const rows = await db
      .select({
        passwordHash: users.passwordHash,
        phone: users.phone,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    const current = rows[0];
    if (!current?.passwordHash) {
      return {
        ok: false,
        error:
          'SSO 전용 계정이거나 비밀번호가 설정되지 않았습니다. 관리자에게 문의하세요.',
      };
    }
    const matches = await verifyPassword(
      parsed.data.currentPassword,
      current.passwordHash,
    );
    if (!matches) {
      return {
        ok: false,
        error: '현재 비밀번호가 일치하지 않습니다',
        fields: { currentPassword: '비밀번호가 일치하지 않습니다' },
      };
    }

    const newHash = await hashPassword(parsed.data.newPassword);
    await db
      .update(users)
      .set({
        passwordHash: newHash,
        mustChangePassword: false,
      })
      .where(eq(users.id, user.id));

    logActivity({
      userId: user.id,
      action: 'user.password_change',
      targetType: 'user',
      targetId: user.id,
    });

    // 변경 알림 SMS (등록된 경우만)
    if (current.phone) {
      void sendSms({
        to: current.phone,
        text: `[OA 통합 AS] ${current.name}님, 비밀번호가 변경되었습니다. 본인이 아니라면 관리자에게 즉시 알려주세요.`,
      });
    }

    return { ok: true };
  } catch (err) {
    console.error('[changePasswordAction] 실패:', err);
    return { ok: false, error: '비밀번호 변경 중 오류가 발생했습니다' };
  }
}

// ─────────────────────────────────────────────────────────────────────
// AC-02: 솔루션 링크 (호텔리어 본인 호텔만)
// ─────────────────────────────────────────────────────────────────────

const SolutionLinkSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1, '라벨을 입력해주세요').max(50),
  url: z
    .string()
    .url('올바른 URL이 아닙니다 (https://...)')
    .max(500),
});

export async function upsertSolutionLinkAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다' };
  if (!user.hotelId)
    return { ok: false, error: '호텔이 매핑되지 않은 계정입니다' };
  if (!db) return { ok: false, error: 'DB 미연결' };

  const parsed = SolutionLinkSchema.safeParse({
    id: (formData.get('id') as string) || undefined,
    label: formData.get('label'),
    url: formData.get('url'),
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
    if (parsed.data.id) {
      // 수정 — 해당 호텔의 링크인지 확인
      const existing = await db
        .select({ hotelId: hotelSolutionLinks.hotelId })
        .from(hotelSolutionLinks)
        .where(eq(hotelSolutionLinks.id, parsed.data.id))
        .limit(1);
      if (!existing[0] || existing[0].hotelId !== user.hotelId) {
        return { ok: false, error: '권한이 없습니다' };
      }
      await db
        .update(hotelSolutionLinks)
        .set({ label: parsed.data.label, url: parsed.data.url })
        .where(eq(hotelSolutionLinks.id, parsed.data.id));
      logActivity({
        userId: user.id,
        action: 'solution_link.upsert',
        targetType: 'hotel_solution_link',
        targetId: parsed.data.id,
        payload: { mode: 'update' },
      });
    } else {
      // 새 추가 — 5개 제한
      const existing = await db
        .select()
        .from(hotelSolutionLinks)
        .where(
          and(
            eq(hotelSolutionLinks.hotelId, user.hotelId),
            eq(hotelSolutionLinks.isActive, true),
          ),
        );
      if (existing.length >= MAX_SOLUTION_LINKS_PER_HOTEL) {
        return {
          ok: false,
          error: `최대 ${MAX_SOLUTION_LINKS_PER_HOTEL}개까지만 등록 가능합니다`,
        };
      }
      const [inserted] = await db
        .insert(hotelSolutionLinks)
        .values({
          hotelId: user.hotelId,
          label: parsed.data.label,
          url: parsed.data.url,
          sortOrder: existing.length * 10,
        })
        .returning({ id: hotelSolutionLinks.id });
      logActivity({
        userId: user.id,
        action: 'solution_link.upsert',
        targetType: 'hotel_solution_link',
        targetId: inserted?.id,
        payload: { mode: 'create' },
      });
    }

    revalidatePath('/profile');
    return { ok: true };
  } catch (err) {
    console.error('[upsertSolutionLinkAction] 실패:', err);
    return { ok: false, error: '솔루션 링크 저장 중 오류가 발생했습니다' };
  }
}

export async function deleteSolutionLinkAction(
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

  try {
    const existing = await db
      .select({ hotelId: hotelSolutionLinks.hotelId })
      .from(hotelSolutionLinks)
      .where(eq(hotelSolutionLinks.id, id))
      .limit(1);
    if (!existing[0] || existing[0].hotelId !== user.hotelId) {
      return { ok: false, error: '권한이 없습니다' };
    }
    // soft delete
    await db
      .update(hotelSolutionLinks)
      .set({ isActive: false })
      .where(eq(hotelSolutionLinks.id, id));
    logActivity({
      userId: user.id,
      action: 'solution_link.delete',
      targetType: 'hotel_solution_link',
      targetId: id,
    });
    revalidatePath('/profile');
    return { ok: true };
  } catch (err) {
    console.error('[deleteSolutionLinkAction] 실패:', err);
    return { ok: false, error: '삭제 중 오류가 발생했습니다' };
  }
}

// ─────────────────────────────────────────────────────────────────────
// 헬퍼: 발신 (호출부에서 await 가능하게)
// ─────────────────────────────────────────────────────────────────────

export async function _sendTestNotification(to: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return { ok: false, error: '권한이 없습니다' };
  }
  const result = await sendEmail({
    to,
    subject: '[OA 통합 AS] 발송 테스트',
    html: '<p>발송 테스트 메일입니다. 정상 수신되면 SES 연동이 동작 중입니다.</p>',
    text: '발송 테스트 메일입니다.',
  });
  return result.ok
    ? { ok: true, data: { messageId: result.messageId, stub: result.stub } }
    : { ok: false, error: result.error };
}
