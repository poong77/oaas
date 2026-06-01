'use server';

/**
 * FAQ Server Actions — Phase 4 SF-01, SF-04.
 *
 * Public:
 *   - bumpFaqViewAction(faqId)          — 펼침 시 fire-and-forget
 *   - submitFaqHelpfulAction(faqId, helpful) — 도움됨/아니에요 counter
 *
 * Admin (매니저+어드민):
 *   - createFaqAction
 *   - updateFaqAction
 *   - archiveFaqAction / restoreFaqAction
 *   - moveFaqOrderAction
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import { rateLimitOrThrow, RateLimitExceededError } from '@/lib/ai/rate-limiter';
import { suggestFaqKeywords } from '@/lib/services/llm';
import {
  archiveFaqById,
  createFaq,
  incrementFaqView,
  moveFaqOrder,
  recordFaqHelpful,
  restoreFaqById,
  updateFaqById,
  type FaqWriteInput,
} from '@/lib/services/faqs';

// ─────────────────────────────────────────────────────────────────────
// Public
// ─────────────────────────────────────────────────────────────────────

export async function bumpFaqViewAction(faqId: string): Promise<void> {
  if (!faqId || typeof faqId !== 'string') return;
  incrementFaqView(faqId);
}

const HelpfulSchema = z.object({
  faqId: z.string().uuid(),
  helpful: z.boolean(),
});

export async function submitFaqHelpfulAction(
  input: z.input<typeof HelpfulSchema>,
): Promise<{ ok: boolean; helpfulYes?: number; helpfulNo?: number; message?: string }> {
  const parsed = HelpfulSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: '입력값 오류' };
  return await recordFaqHelpful(parsed.data.faqId, parsed.data.helpful);
}

// ─────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────

const FaqWriteSchema = z.object({
  productCode: z.string().min(1, '제품을 선택하세요'),
  issueType: z.string().min(1).optional().nullable(),
  question: z.string().min(1, '질문을 입력하세요').max(300),
  answerMarkdown: z.string().min(1, '답변을 입력하세요'),
  // v1.7 — 검색 보강 키워드 (선택). 칩 입력을 쉼표 구분 문자열로 전송.
  keywords: z
    .array(z.string().trim().min(1).max(60))
    .max(30, '키워드는 최대 30개')
    .optional()
    .nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export type FaqFormState = {
  ok: boolean;
  id?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};

function parseFaqForm(formData: FormData): Record<string, unknown> {
  const get = (k: string) => (formData.get(k) ?? '').toString();
  const issueRaw = get('issueType').trim();
  // keywords는 칩 폼이 쉼표 구분 문자열로 직렬화해 보낸다 (articles와 동일).
  const keywordsRaw = get('keywords').trim();
  const keywords = keywordsRaw
    ? keywordsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
  return {
    productCode: get('productCode').trim(),
    issueType: issueRaw || null,
    question: get('question').trim(),
    answerMarkdown: get('answerMarkdown'),
    keywords,
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

/**
 * v1.7 — FAQ 검색 키워드 AI 제안. question+answer → 한글 키워드 후보.
 * 에디터의 "AI 추천" 버튼에서 호출. graceful: 키 미설정 시 빈 배열.
 */
export async function suggestFaqKeywordsAction(input: {
  question: string;
  answer?: string;
  existing?: string[];
}): Promise<{ ok: boolean; keywords?: string[]; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const question = (input.question ?? '').trim();
  if (question.length < 2) {
    return { ok: false, message: '질문을 먼저 입력하세요' };
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
  const keywords = await suggestFaqKeywords(
    { question, answer: input.answer ?? '' },
    Array.isArray(input.existing) ? input.existing : [],
  );
  if (keywords.length === 0) {
    return { ok: false, message: 'AI 제안을 가져오지 못했어요 (키 미설정/일시 오류)' };
  }
  return { ok: true, keywords };
}

export async function createFaqAction(
  _prev: FaqFormState | undefined,
  formData: FormData,
): Promise<FaqFormState> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = FaqWriteSchema.safeParse(parseFaqForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }
  const input: FaqWriteInput = parsed.data;
  const result = await createFaq(input);
  if (!result.ok || !result.id) {
    return { ok: false, message: result.message ?? 'FAQ 생성 실패' };
  }
  logActivity({
    userId: user.id,
    action: 'faq.create',
    targetType: 'faq',
    targetId: result.id,
    payload: { productCode: input.productCode, question: input.question },
  });
  revalidatePath('/admin/faqs');
  revalidatePath('/faq');
  return { ok: true, id: result.id };
}

export async function updateFaqAction(
  id: string,
  _prev: FaqFormState | undefined,
  formData: FormData,
): Promise<FaqFormState> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = FaqWriteSchema.safeParse(parseFaqForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }
  const input: FaqWriteInput = parsed.data;
  const result = await updateFaqById(id, input);
  if (!result.ok) {
    return { ok: false, message: result.message ?? 'FAQ 갱신 실패' };
  }
  logActivity({
    userId: user.id,
    action: 'faq.update',
    targetType: 'faq',
    targetId: id,
    payload: { productCode: input.productCode, question: input.question },
  });
  revalidatePath('/admin/faqs');
  revalidatePath(`/admin/faqs/${id}`);
  revalidatePath('/faq');
  return { ok: true, id };
}

export async function archiveFaqAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const result = await archiveFaqById(id);
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'faq.archive',
      targetType: 'faq',
      targetId: id,
    });
    revalidatePath('/admin/faqs');
    revalidatePath('/faq');
  }
  return result;
}

export async function restoreFaqAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const result = await restoreFaqById(id);
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'faq.restore',
      targetType: 'faq',
      targetId: id,
    });
    revalidatePath('/admin/faqs');
    revalidatePath('/faq');
  }
  return result;
}

export async function moveFaqOrderAction(
  id: string,
  direction: 'up' | 'down',
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const result = await moveFaqOrder(id, direction);
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'faq.move_order',
      targetType: 'faq',
      targetId: id,
      payload: { direction },
    });
    revalidatePath('/admin/faqs');
    revalidatePath('/faq');
  }
  return result;
}
