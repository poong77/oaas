'use server';

/**
 * Checklist Server Actions — Phase 4 SF-02, SF-04.
 *
 * Public:
 *   - bumpChecklistViewAction(id)
 *   - markChecklistResolvedAction(id)
 *   - markChecklistEscalatedAction(id)
 *
 * Admin (매니저+어드민):
 *   - createChecklistAction
 *   - updateChecklistAction
 *   - archiveChecklistAction / restoreChecklistAction
 *   - createStepAction / updateStepAction / archiveStepAction / restoreStepAction
 *   - moveStepOrderAction
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import {
  archiveChecklistById,
  archiveStepById,
  createChecklist,
  createStep,
  incrementChecklistEscalated,
  incrementChecklistResolved,
  incrementChecklistView,
  moveStepOrder,
  restoreChecklistById,
  restoreStepById,
  updateChecklistById,
  updateStepById,
  type ChecklistWriteInput,
  type StepWriteInput,
} from '@/lib/services/checklists';
import type { ChecklistStepAction } from '@/db/schema';

const STEP_ACTIONS: readonly ChecklistStepAction[] = [
  'next',
  'resolved',
  'escalate',
] as const;

// ─────────────────────────────────────────────────────────────────────
// Public — 진행 카운터
// ─────────────────────────────────────────────────────────────────────

export async function bumpChecklistViewAction(id: string): Promise<void> {
  if (!id || typeof id !== 'string') return;
  incrementChecklistView(id);
}

export async function markChecklistResolvedAction(
  id: string,
): Promise<{ ok: boolean }> {
  if (!id || typeof id !== 'string') return { ok: false };
  return await incrementChecklistResolved(id);
}

export async function markChecklistEscalatedAction(
  id: string,
): Promise<{ ok: boolean }> {
  if (!id || typeof id !== 'string') return { ok: false };
  return await incrementChecklistEscalated(id);
}

// ─────────────────────────────────────────────────────────────────────
// Admin — 체크리스트 CRUD
// ─────────────────────────────────────────────────────────────────────

const ChecklistWriteSchema = z.object({
  productCode: z.string().min(1, '제품을 선택하세요'),
  issueType: z.string().min(1).optional().nullable(),
  title: z.string().min(1, '제목을 입력하세요').max(200),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export type ChecklistFormState = {
  ok: boolean;
  id?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};

function parseChecklistForm(formData: FormData): Record<string, unknown> {
  const get = (k: string) => (formData.get(k) ?? '').toString();
  const issueRaw = get('issueType').trim();
  return {
    productCode: get('productCode').trim(),
    issueType: issueRaw || null,
    title: get('title').trim(),
    description: get('description').trim() || null,
    sortOrder: get('sortOrder').trim() || '0',
  };
}

function shapeFieldErrors(
  err: z.ZodError<unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.') || '_';
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}

export async function createChecklistAction(
  _prev: ChecklistFormState | undefined,
  formData: FormData,
): Promise<ChecklistFormState> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = ChecklistWriteSchema.safeParse(parseChecklistForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }
  const input: ChecklistWriteInput = parsed.data;
  const result = await createChecklist(input);
  if (!result.ok || !result.id) {
    return { ok: false, message: result.message ?? '체크리스트 생성 실패' };
  }
  logActivity({
    userId: user.id,
    action: 'checklist.create',
    targetType: 'checklist',
    targetId: result.id,
    payload: { productCode: input.productCode, title: input.title },
  });
  revalidatePath('/admin/checklists');
  revalidatePath('/troubleshoot');
  return { ok: true, id: result.id };
}

export async function updateChecklistAction(
  id: string,
  _prev: ChecklistFormState | undefined,
  formData: FormData,
): Promise<ChecklistFormState> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = ChecklistWriteSchema.safeParse(parseChecklistForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }
  const input: ChecklistWriteInput = parsed.data;
  const result = await updateChecklistById(id, input);
  if (!result.ok) {
    return { ok: false, message: result.message ?? '체크리스트 갱신 실패' };
  }
  logActivity({
    userId: user.id,
    action: 'checklist.update',
    targetType: 'checklist',
    targetId: id,
    payload: { productCode: input.productCode, title: input.title },
  });
  revalidatePath('/admin/checklists');
  revalidatePath(`/admin/checklists/${id}`);
  revalidatePath('/troubleshoot');
  revalidatePath(`/troubleshoot/${id}`);
  return { ok: true, id };
}

export async function archiveChecklistAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const result = await archiveChecklistById(id);
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'checklist.archive',
      targetType: 'checklist',
      targetId: id,
    });
    revalidatePath('/admin/checklists');
    revalidatePath('/troubleshoot');
  }
  return result;
}

export async function restoreChecklistAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const result = await restoreChecklistById(id);
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'checklist.restore',
      targetType: 'checklist',
      targetId: id,
    });
    revalidatePath('/admin/checklists');
    revalidatePath('/troubleshoot');
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────
// Admin — 단계 CRUD
// ─────────────────────────────────────────────────────────────────────

const StepActionSchema = z.enum(['next', 'resolved', 'escalate']);

const StepWriteSchema = z.object({
  title: z.string().min(1, '단계 제목을 입력하세요').max(200),
  bodyMarkdown: z.string().optional().nullable(),
  conditionYesAction: StepActionSchema,
  conditionNoAction: StepActionSchema,
  yesLabel: z.string().max(40).optional(),
  noLabel: z.string().max(40).optional(),
});

function parseStepInput(formData: FormData): StepWriteInput | null {
  const get = (k: string) => (formData.get(k) ?? '').toString();
  const raw = {
    title: get('title').trim(),
    bodyMarkdown: get('bodyMarkdown').trim() || null,
    conditionYesAction: get('conditionYesAction'),
    conditionNoAction: get('conditionNoAction'),
    yesLabel: get('yesLabel').trim() || undefined,
    noLabel: get('noLabel').trim() || undefined,
  };
  const parsed = StepWriteSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data;
}

export type StepActionResult = {
  ok: boolean;
  id?: string;
  stepNo?: number;
  message?: string;
};

export async function createStepAction(
  checklistId: string,
  formData: FormData,
): Promise<StepActionResult> {
  const user = await requireRole(['manager', 'admin']);
  const input = parseStepInput(formData);
  if (!input) {
    return { ok: false, message: '단계 입력값을 확인하세요' };
  }
  const result = await createStep(checklistId, input);
  if (result.ok && result.id) {
    logActivity({
      userId: user.id,
      action: 'checklist.step.create',
      targetType: 'checklist_step',
      targetId: result.id,
      payload: {
        checklistId,
        stepNo: result.stepNo,
        title: input.title,
      },
    });
    revalidatePath(`/admin/checklists/${checklistId}`);
    revalidatePath(`/troubleshoot/${checklistId}`);
  }
  return result;
}

export async function updateStepAction(
  stepId: string,
  checklistId: string,
  formData: FormData,
): Promise<StepActionResult> {
  const user = await requireRole(['manager', 'admin']);
  const input = parseStepInput(formData);
  if (!input) {
    return { ok: false, message: '단계 입력값을 확인하세요' };
  }
  const result = await updateStepById(stepId, input);
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'checklist.step.update',
      targetType: 'checklist_step',
      targetId: stepId,
      payload: { checklistId, title: input.title },
    });
    revalidatePath(`/admin/checklists/${checklistId}`);
    revalidatePath(`/troubleshoot/${checklistId}`);
  }
  return result;
}

export async function archiveStepAction(
  stepId: string,
  checklistId: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const result = await archiveStepById(stepId);
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'checklist.step.delete',
      targetType: 'checklist_step',
      targetId: stepId,
      payload: { checklistId },
    });
    revalidatePath(`/admin/checklists/${checklistId}`);
    revalidatePath(`/troubleshoot/${checklistId}`);
  }
  return result;
}

export async function restoreStepAction(
  stepId: string,
  checklistId: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const result = await restoreStepById(stepId);
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'checklist.step.restore',
      targetType: 'checklist_step',
      targetId: stepId,
      payload: { checklistId },
    });
    revalidatePath(`/admin/checklists/${checklistId}`);
    revalidatePath(`/troubleshoot/${checklistId}`);
  }
  return result;
}

export async function moveStepOrderAction(
  stepId: string,
  checklistId: string,
  direction: 'up' | 'down',
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const result = await moveStepOrder(stepId, direction);
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'checklist.step.move',
      targetType: 'checklist_step',
      targetId: stepId,
      payload: { checklistId, direction },
    });
    revalidatePath(`/admin/checklists/${checklistId}`);
    revalidatePath(`/troubleshoot/${checklistId}`);
  }
  return result;
}
