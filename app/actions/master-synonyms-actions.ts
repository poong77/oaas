'use server';

/**
 * Server Actions — 동의어 사전 마스터 CRUD.
 *
 * 권한: 어드민만 (synonyms-master Design §5.1).
 * 캐시: 모든 쓰기에서 revalidateTag('synonyms') 호출 (loadSynonymIndex 즉시 무효화).
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireRole } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import { rateLimitOrThrow, RateLimitExceededError } from '@/lib/ai/rate-limiter';
import { suggestSynonyms } from '@/lib/services/llm';
import {
  dismissKeywordGap,
  restoreKeywordGap,
} from '@/lib/services/keyword-gap';
import {
  addSynonym,
  createTermGroup,
  deactivateTermGroup,
  removeSynonym,
  reorderSynonyms,
  restoreTermGroup,
  updateTermGroup,
} from '@/lib/services/master-synonyms';

const TERM_GROUP_CATEGORIES = [
  'operation',
  'housekeeping',
  'fnb',
  'frontdesk',
  'pms',
  'product',
  'issue',
  'role',
  'misc',
] as const;

const GroupSchema = z.object({
  canonicalTerm: z
    .string()
    .trim()
    .min(1, '대표어를 입력하세요')
    .max(60, '60자 이내'),
  category: z.enum(TERM_GROUP_CATEGORIES),
  description: z.string().max(500, '500자 이내').optional().nullable(),
  suggestedCategoryId: z.string().max(80).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

const SynonymSchema = z.object({
  groupId: z.string().uuid('그룹 ID가 올바르지 않습니다'),
  term: z.string().trim().min(1, '동의어를 입력하세요').max(60, '60자 이내'),
  language: z.enum(['ko', 'en']).default('ko'),
});

export type GroupActionState = {
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

function extractGroupFromForm(formData: FormData) {
  return {
    canonicalTerm: (formData.get('canonicalTerm') ?? '').toString().trim(),
    category: (formData.get('category') ?? 'misc').toString().trim(),
    description:
      ((formData.get('description') ?? '').toString().trim() || null) as
        | string
        | null,
    suggestedCategoryId:
      ((formData.get('suggestedCategoryId') ?? '').toString().trim() ||
        null) as string | null,
    sortOrder: (formData.get('sortOrder') ?? '100').toString().trim(),
  };
}

// ─────────────────────────────────────────────────────────────────
// 그룹 — Create
// ─────────────────────────────────────────────────────────────────

export async function createTermGroupAction(
  _prev: GroupActionState | undefined,
  formData: FormData,
): Promise<GroupActionState> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = GroupSchema.safeParse(extractGroupFromForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }
  const result = await createTermGroup(parsed.data);
  if (!result.ok) {
    if (result.message === 'DUPLICATE_CANONICAL') {
      return {
        ok: false,
        message: '이미 등록된 대표어입니다',
        fieldErrors: { canonicalTerm: '이미 등록된 대표어입니다' },
      };
    }
    return { ok: false, message: '저장 실패' };
  }
  logActivity({
    userId: user.id,
    action: 'master.term_group.create',
    targetType: 'term_group',
    targetId: result.id,
    payload: parsed.data,
  });
  revalidateTag('synonyms', 'default');
  revalidatePath('/admin/master/synonyms');
  redirect(`/admin/master/synonyms/${result.id}`);
}

// ─────────────────────────────────────────────────────────────────
// 원페이지 — 대표어 + 동의어 한 번에 생성
// ─────────────────────────────────────────────────────────────────

export async function createGroupWithSynonymsAction(input: {
  canonicalTerm: string;
  synonyms: string[];
}): Promise<{ ok: boolean; id?: string; message?: string; added?: number }> {
  const user = await requireRole(['manager', 'admin']);
  const canonicalTerm = (input.canonicalTerm ?? '').trim();
  if (canonicalTerm.length < 1 || canonicalTerm.length > 60) {
    return { ok: false, message: '대표어를 1~60자로 입력하세요' };
  }

  // category/sortOrder 등은 기본값(misc/0). 원페이지는 대표어+동의어만 받는다.
  const created = await createTermGroup({
    canonicalTerm,
    category: 'misc',
    description: null,
    suggestedCategoryId: null,
    sortOrder: 0,
  });
  if (!created.ok) {
    if (created.message === 'DUPLICATE_CANONICAL') {
      return { ok: false, message: '이미 등록된 대표어입니다' };
    }
    return { ok: false, message: '저장 실패' };
  }

  logActivity({
    userId: user.id,
    action: 'master.term_group.create',
    targetType: 'term_group',
    targetId: created.id,
    payload: { canonicalTerm, via: 'one-page' },
  });

  // 동의어 일괄 추가 (대표어 자신/중복/공백 제외)
  let added = 0;
  const seen = new Set([canonicalTerm.toLowerCase()]);
  for (const raw of Array.isArray(input.synonyms) ? input.synonyms : []) {
    const term = (raw ?? '').trim();
    const key = term.toLowerCase();
    if (term.length < 1 || term.length > 60 || seen.has(key)) continue;
    seen.add(key);
    const r = await addSynonym({ groupId: created.id, term, language: 'ko' });
    if (r.ok) added += 1;
  }

  revalidateTag('synonyms', 'default');
  revalidatePath('/admin/master/synonyms');
  return { ok: true, id: created.id, added };
}

// ─────────────────────────────────────────────────────────────────
// 갭 키워드 — 무시 / 무시 해제
// ─────────────────────────────────────────────────────────────────

export async function dismissKeywordGapAction(
  term: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const t = (term ?? '').trim();
  if (!t) return { ok: false, message: '키워드 누락' };
  const result = await dismissKeywordGap(t, user.id);
  if (!result.ok) return { ok: false, message: result.message ?? '무시 실패' };
  logActivity({
    userId: user.id,
    action: 'master.keyword_gap.dismiss',
    targetType: 'keyword_gap',
    targetId: t,
  });
  revalidatePath('/admin/master/synonyms');
  return { ok: true };
}

export async function restoreKeywordGapAction(
  term: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const t = (term ?? '').trim();
  if (!t) return { ok: false, message: '키워드 누락' };
  const result = await restoreKeywordGap(t, user.id);
  if (!result.ok) return { ok: false, message: result.message ?? '복원 실패' };
  logActivity({
    userId: user.id,
    action: 'master.keyword_gap.restore',
    targetType: 'keyword_gap',
    targetId: t,
  });
  revalidatePath('/admin/master/synonyms');
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────
// 원페이지 — AI 동의어 추천 (숙박업계 기준)
// ─────────────────────────────────────────────────────────────────

export async function suggestSynonymsAction(input: {
  canonicalTerm: string;
  existing?: string[];
}): Promise<{ ok: boolean; synonyms?: string[]; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const canonicalTerm = (input.canonicalTerm ?? '').trim();
  if (canonicalTerm.length < 1) {
    return { ok: false, message: '대표어를 먼저 입력하세요' };
  }
  try {
    await rateLimitOrThrow(user.id, {
      perMin: 10,
      perDay: 200,
      bucket: 'ai-assist',
    });
  } catch (e) {
    if (e instanceof RateLimitExceededError) {
      return { ok: false, message: e.message };
    }
    throw e;
  }
  const synonyms = await suggestSynonyms(
    canonicalTerm,
    Array.isArray(input.existing) ? input.existing : [],
  );
  if (synonyms.length === 0) {
    return {
      ok: false,
      message: 'AI 제안을 가져오지 못했어요 (키 미설정/일시 오류)',
    };
  }
  return { ok: true, synonyms };
}

// ─────────────────────────────────────────────────────────────────
// 그룹 — Update
// ─────────────────────────────────────────────────────────────────

export async function updateTermGroupAction(
  groupId: string,
  _prev: GroupActionState | undefined,
  formData: FormData,
): Promise<GroupActionState> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = GroupSchema.safeParse(extractGroupFromForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }
  const result = await updateTermGroup(groupId, parsed.data);
  if (!result.ok) {
    if (result.message === 'DUPLICATE_CANONICAL') {
      return {
        ok: false,
        message: '이미 등록된 대표어입니다',
        fieldErrors: { canonicalTerm: '이미 등록된 대표어입니다' },
      };
    }
    return { ok: false, message: '저장 실패' };
  }
  logActivity({
    userId: user.id,
    action: 'master.term_group.update',
    targetType: 'term_group',
    targetId: groupId,
    payload: parsed.data,
  });
  revalidateTag('synonyms', 'default');
  revalidatePath('/admin/master/synonyms');
  revalidatePath(`/admin/master/synonyms/${groupId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────
// 그룹 — Activate / Deactivate
// ─────────────────────────────────────────────────────────────────

export async function toggleTermGroupAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const id = (formData.get('id') ?? '').toString().trim();
  const action = (formData.get('action') ?? '').toString().trim();
  if (!id) return { ok: false, message: 'ID 누락' };

  if (action === 'deactivate') {
    const result = await deactivateTermGroup(id);
    if (!result.ok) return { ok: false, message: '비활성화 실패' };
    logActivity({
      userId: user.id,
      action: 'master.term_group.deactivate',
      targetType: 'term_group',
      targetId: id,
    });
  } else if (action === 'activate') {
    const result = await restoreTermGroup(id);
    if (!result.ok) return { ok: false, message: '활성화 실패' };
    logActivity({
      userId: user.id,
      action: 'master.term_group.activate',
      targetType: 'term_group',
      targetId: id,
    });
  } else {
    return { ok: false, message: '알 수 없는 액션' };
  }

  revalidateTag('synonyms', 'default');
  revalidatePath('/admin/master/synonyms');
  revalidatePath(`/admin/master/synonyms/${id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────
// 동의어 — Add
// ─────────────────────────────────────────────────────────────────

export async function addSynonymAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string; synonymId?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = SynonymSchema.safeParse({
    groupId: (formData.get('groupId') ?? '').toString().trim(),
    term: (formData.get('term') ?? '').toString().trim(),
    language: (formData.get('language') ?? 'ko').toString().trim(),
  });
  if (!parsed.success) {
    return { ok: false, message: '입력값을 확인해주세요' };
  }
  const result = await addSynonym(parsed.data);
  if (!result.ok) {
    if (result.message === 'DUPLICATE_IN_GROUP') {
      return { ok: false, message: '이미 등록된 동의어입니다' };
    }
    if (result.message === 'GROUP_NOT_FOUND') {
      return { ok: false, message: '그룹을 찾을 수 없습니다' };
    }
    return { ok: false, message: '동의어 추가 실패' };
  }
  logActivity({
    userId: user.id,
    action: 'master.term_synonym.add',
    targetType: 'term_synonym',
    targetId: result.synonym.id,
    payload: parsed.data,
  });
  revalidateTag('synonyms', 'default');
  revalidatePath(`/admin/master/synonyms/${parsed.data.groupId}`);
  return { ok: true, synonymId: result.synonym.id };
}

// ─────────────────────────────────────────────────────────────────
// 동의어 — Remove (soft delete)
// ─────────────────────────────────────────────────────────────────

export async function removeSynonymAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const id = (formData.get('id') ?? '').toString().trim();
  const groupId = (formData.get('groupId') ?? '').toString().trim();
  if (!id) return { ok: false, message: 'ID 누락' };

  const result = await removeSynonym(id);
  if (!result.ok) return { ok: false, message: '삭제 실패' };
  logActivity({
    userId: user.id,
    action: 'master.term_synonym.remove',
    targetType: 'term_synonym',
    targetId: id,
  });
  revalidateTag('synonyms', 'default');
  if (groupId) {
    revalidatePath(`/admin/master/synonyms/${groupId}`);
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────
// 동의어 — Reorder
// ─────────────────────────────────────────────────────────────────

const ReorderItemSchema = z.object({
  id: z.string().uuid(),
  sortOrder: z.number().int().min(0).max(99999),
});

export async function reorderSynonymsAction(
  groupId: string,
  ordering: { id: string; sortOrder: number }[],
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = z.array(ReorderItemSchema).safeParse(ordering);
  if (!parsed.success) return { ok: false, message: '입력값 오류' };
  const result = await reorderSynonyms(groupId, parsed.data);
  if (!result.ok) return { ok: false, message: '순서 변경 실패' };
  logActivity({
    userId: user.id,
    action: 'master.term_synonym.reorder',
    targetType: 'term_group',
    targetId: groupId,
    payload: { count: parsed.data.length },
  });
  revalidateTag('synonyms', 'default');
  revalidatePath(`/admin/master/synonyms/${groupId}`);
  return { ok: true };
}
