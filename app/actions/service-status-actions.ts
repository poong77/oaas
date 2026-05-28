'use server';

/**
 * 서비스 상태 변경 Server Action (LP-03, NT-03).
 *
 * 권한: manager 또는 admin.
 * 변경 시 activity_logs에 `service_status.update` 기록 (fire-and-forget).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { withAuthorizedAction } from '@/lib/permissions';
import { changeServiceStatus } from '@/lib/services/service-status';
import { logActivity } from '@/lib/audit';

const ChangeStatusSchema = z.object({
  status: z.enum(['normal', 'degraded', 'incident', 'maintenance']),
  message: z
    .string()
    .max(500, '메시지는 500자 이하로 입력해주세요.')
    .optional()
    .or(z.literal('')),
});

export type ChangeStatusInput = z.infer<typeof ChangeStatusSchema>;

export const updateServiceStatusAction = withAuthorizedAction(
  ['manager', 'admin'],
  async ({ user }, raw: ChangeStatusInput) => {
    const parsed = ChangeStatusSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false as const,
        reason: parsed.error.issues[0]?.message ?? '입력 형식이 올바르지 않습니다.',
      };
    }
    const result = await changeServiceStatus({
      status: parsed.data.status,
      message: parsed.data.message ?? null,
      userId: user.id,
    });

    if (result.ok) {
      logActivity({
        userId: user.id,
        action: 'service_status.update',
        targetType: 'service_status',
        targetId: result.id,
        payload: {
          status: parsed.data.status,
          message: parsed.data.message ?? null,
        },
      });
      // 홈, 상태페이지, 어드민 페이지 모두 RSC라 재검증
      revalidatePath('/');
      revalidatePath('/status');
      revalidatePath('/admin/service-status');
    }

    return result;
  },
);
