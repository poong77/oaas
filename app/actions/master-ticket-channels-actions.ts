'use server';

/**
 * Server Actions — ticket_channels 마스터 CRUD.
 *
 * 권한: 어드민만 (matrix Design §7.1).
 * 캐시: 모든 쓰기에서 revalidateTag('ticket-channels') 호출 (Design §9.2).
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireRole } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import {
  activateTicketChannel,
  createTicketChannel,
  deactivateTicketChannel,
  updateTicketChannel,
} from '@/lib/services/master-ticket-channels';

const ChannelSchema = z.object({
  code: z
    .string()
    .min(1, '코드를 입력하세요')
    .max(40, '40자 이내')
    .regex(/^[a-z][a-z0-9_]*$/, 'snake_case 영문 소문자/숫자만 사용 가능합니다'),
  label: z.string().min(1, '라벨을 입력하세요').max(40, '40자 이내'),
  description: z.string().max(200, '200자 이내').optional().nullable(),
  icon: z.string().max(40).optional().nullable(),
  selectableInAgentForm: z.boolean(),
  isAgentDefault: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export type ChannelActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

function shapeFieldErrors(err: z.ZodError<unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.') || '_';
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}

function extractChannelFromForm(formData: FormData) {
  return {
    code: (formData.get('code') ?? '').toString().trim(),
    label: (formData.get('label') ?? '').toString().trim(),
    description: ((formData.get('description') ?? '').toString().trim() || null) as
      | string
      | null,
    icon: ((formData.get('icon') ?? '').toString().trim() || null) as
      | string
      | null,
    selectableInAgentForm: formData.get('selectableInAgentForm') === 'on',
    isAgentDefault: formData.get('isAgentDefault') === 'on',
    sortOrder: (formData.get('sortOrder') ?? '0').toString().trim(),
  };
}

// ─────────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────────

export async function createTicketChannelAction(
  _prev: ChannelActionState | undefined,
  formData: FormData,
): Promise<ChannelActionState> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = ChannelSchema.safeParse(extractChannelFromForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }
  const result = await createTicketChannel(parsed.data);
  if (!result.ok) {
    if (result.message === 'DUPLICATE_CODE') {
      return {
        ok: false,
        message: '이미 존재하는 코드입니다',
        fieldErrors: { code: '이미 존재하는 코드입니다' },
      };
    }
    return { ok: false, message: '저장 실패' };
  }
  logActivity({
    userId: user.id,
    action: 'master.ticket_channel.create',
    targetType: 'ticket_channel',
    targetId: result.id!,
    payload: parsed.data,
  });
  revalidateTag('ticket-channels', 'default');
  revalidatePath('/admin/master/inquiry-classification');
  redirect('/admin/master/inquiry-classification?tab=channels');
}

// ─────────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────────

export async function updateTicketChannelAction(
  channelId: string,
  _prev: ChannelActionState | undefined,
  formData: FormData,
): Promise<ChannelActionState> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = ChannelSchema.safeParse(extractChannelFromForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }
  const result = await updateTicketChannel(channelId, parsed.data);
  if (!result.ok) {
    if (result.message === 'DUPLICATE_CODE') {
      return {
        ok: false,
        message: '이미 존재하는 코드입니다',
        fieldErrors: { code: '이미 존재하는 코드입니다' },
      };
    }
    if (result.message === 'SYSTEM_CODE_LOCKED') {
      return {
        ok: false,
        message: '시스템 채널의 코드는 변경할 수 없습니다',
        fieldErrors: { code: '시스템 채널 코드 잠금' },
      };
    }
    return { ok: false, message: '저장 실패' };
  }
  logActivity({
    userId: user.id,
    action: 'master.ticket_channel.update',
    targetType: 'ticket_channel',
    targetId: channelId,
    payload: parsed.data,
  });
  revalidateTag('ticket-channels', 'default');
  revalidatePath('/admin/master/inquiry-classification');
  revalidatePath(`/admin/master/ticket-channels/${channelId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────
// Activate / Deactivate (soft delete)
// ─────────────────────────────────────────────────────────────────

export async function toggleTicketChannelAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const id = (formData.get('id') ?? '').toString().trim();
  const action = (formData.get('action') ?? '').toString().trim();
  if (!id) return { ok: false, message: 'ID 누락' };

  if (action === 'deactivate') {
    const result = await deactivateTicketChannel(id);
    if (!result.ok) {
      if (result.message === 'SYSTEM_CHANNEL_LOCKED') {
        return {
          ok: false,
          message: '시스템 채널(웹/챗봇)은 비활성화할 수 없습니다',
        };
      }
      if (result.message === 'NOT_FOUND') {
        return { ok: false, message: '채널을 찾을 수 없습니다' };
      }
      return { ok: false, message: '비활성화 실패' };
    }
    logActivity({
      userId: user.id,
      action: 'master.ticket_channel.deactivate',
      targetType: 'ticket_channel',
      targetId: id,
    });
  } else if (action === 'activate') {
    await activateTicketChannel(id);
    logActivity({
      userId: user.id,
      action: 'master.ticket_channel.activate',
      targetType: 'ticket_channel',
      targetId: id,
    });
  } else {
    return { ok: false, message: '알 수 없는 액션' };
  }

  revalidateTag('ticket-channels', 'default');
  revalidatePath('/admin/master/inquiry-classification');
  return { ok: true };
}
