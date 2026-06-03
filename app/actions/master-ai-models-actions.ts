'use server';

/**
 * ai-reply-assist — AI 모델 마스터 어드민 액션 (admin 전용).
 *
 * 목록/기본값/ON·OFF/정렬/라벨 편집. 모든 액션 requireRole(['admin']) + activity_logs.
 * 모델 단가 변동·신모델 추가 시 코드 배포 없이 여기서 관리(CLAUDE.md 8번 원칙).
 *
 * @see docs/02-design/features/ai-reply-assist.design.md §7.3 §8
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import {
  createModel,
  updateModel,
  toggleModelActive,
  setDefaultModel,
  reorderModels,
} from '@/lib/services/ai-models';

type ActionResult = { ok: true } | { ok: false; message: string };

const providerEnum = z.enum(['anthropic', 'openai']);
const tierEnum = z.enum(['economy', 'balanced', 'premium']);

function revalidate() {
  revalidatePath('/admin/master/ai-models');
}

const createSchema = z.object({
  provider: providerEnum,
  code: z.string().trim().min(1, 'code 필수'),
  label: z.string().trim().min(1, 'label 필수'),
  description: z.string().trim().optional(),
  tier: tierEnum.default('balanced'),
  sortOrder: z.number().int().optional(),
});

export async function createAiModelAction(
  input: z.input<typeof createSchema>,
): Promise<ActionResult> {
  const user = await requireRole(['admin']);
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: '입력값 확인 (provider/code/label 필수)' };

  const row = await createModel({
    provider: parsed.data.provider,
    code: parsed.data.code,
    label: parsed.data.label,
    description: parsed.data.description ?? null,
    tier: parsed.data.tier,
    sortOrder: parsed.data.sortOrder ?? 0,
    isDefault: false,
  });
  if (!row) return { ok: false, message: '생성 실패' };

  logActivity({
    userId: user.id,
    action: 'ai_model.create',
    targetType: 'ai_model',
    targetId: row.id,
    payload: { provider: parsed.data.provider, code: parsed.data.code },
  });
  revalidate();
  return { ok: true };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  provider: providerEnum.optional(),
  code: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  tier: tierEnum.optional(),
});

export async function updateAiModelAction(
  input: z.input<typeof updateSchema>,
): Promise<ActionResult> {
  const user = await requireRole(['admin']);
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: '입력값 확인' };

  const { id, ...patch } = parsed.data;
  await updateModel(id, patch);
  logActivity({
    userId: user.id,
    action: 'ai_model.update',
    targetType: 'ai_model',
    targetId: id,
    payload: patch,
  });
  revalidate();
  return { ok: true };
}

export async function toggleAiModelActiveAction(input: {
  id: string;
  isActive: boolean;
}): Promise<ActionResult> {
  const user = await requireRole(['admin']);
  if (!input?.id) return { ok: false, message: 'id 필요' };
  await toggleModelActive(input.id, Boolean(input.isActive));
  logActivity({
    userId: user.id,
    action: 'ai_model.toggle_active',
    targetType: 'ai_model',
    targetId: input.id,
    payload: { isActive: Boolean(input.isActive) },
  });
  revalidate();
  return { ok: true };
}

export async function setAiModelDefaultAction(input: {
  id: string;
}): Promise<ActionResult> {
  const user = await requireRole(['admin']);
  if (!input?.id) return { ok: false, message: 'id 필요' };
  await setDefaultModel(input.id);
  logActivity({
    userId: user.id,
    action: 'ai_model.set_default',
    targetType: 'ai_model',
    targetId: input.id,
  });
  revalidate();
  return { ok: true };
}

export async function reorderAiModelsAction(input: {
  order: { id: string; sortOrder: number }[];
}): Promise<ActionResult> {
  await requireRole(['admin']);
  if (!Array.isArray(input?.order)) return { ok: false, message: 'order 필요' };
  await reorderModels(input.order);
  revalidate();
  return { ok: true };
}
