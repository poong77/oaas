'use server';

/**
 * 아티클 관련 Server Actions.
 *
 * Phase 3:
 *   - submitArticleFeedback (public, 로그인이면 user 1회 제약)
 *   - bumpArticleViewCount (public, fire-and-forget)
 *   - 어드민: createArticleAction / updateArticleAction / togglePublishArticleAction / archiveArticleAction
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import slugify from 'slugify';

import { getCurrentUser, requireRole } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import {
  archiveArticleById,
  createArticle,
  incrementViewCount,
  recordFeedback,
  restoreArticleById,
  slugExists,
  togglePublishArticleById,
  updateArticleById,
  type ArticleWriteInput,
} from '@/lib/services/articles';

// ─────────────────────────────────────────────────────────────────────
// public — 도움됨 / 조회수
// ─────────────────────────────────────────────────────────────────────

const FeedbackSchema = z.object({
  articleId: z.string().uuid(),
  helpful: z.boolean(),
  comment: z.string().max(500).optional().nullable(),
});

export async function submitArticleFeedback(
  input: z.input<typeof FeedbackSchema>,
): Promise<{
  ok: boolean;
  message?: string;
  helpfulYes?: number;
  helpfulNo?: number;
  loggedIn?: boolean;
}> {
  const parsed = FeedbackSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: '입력값 오류' };
  }
  const user = await getCurrentUser();
  const result = await recordFeedback({
    articleId: parsed.data.articleId,
    helpful: parsed.data.helpful,
    comment: parsed.data.comment ?? null,
    userId: user?.id ?? null,
  });
  return { ...result, loggedIn: Boolean(user) };
}

/** 페이지 진입 시 호출. fire-and-forget. */
export async function bumpArticleViewCount(articleId: string): Promise<void> {
  if (!articleId || typeof articleId !== 'string') return;
  incrementViewCount(articleId);
}

// ─────────────────────────────────────────────────────────────────────
// 어드민 CRUD
// ─────────────────────────────────────────────────────────────────────

const ArticleWriteSchema = z.object({
  productCode: z.string().min(1, '제품을 선택하세요'),
  categoryPath: z.array(z.string()).optional().nullable(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'slug는 영문 소문자/숫자/하이픈만 가능합니다'),
  title: z.string().min(1, '제목을 입력하세요').max(200),
  summary30s: z.string().max(500).optional().nullable(),
  bodyMarkdown: z.string().min(1, '본문을 입력하세요'),
  relatedArticleIds: z.array(z.string().uuid()).optional().nullable(),
  publish: z.boolean().optional(),
});

export type ArticleFormState = {
  ok: boolean;
  id?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};

/** slug 자동 생성 (한글은 빈 결과 → fallback). */
export async function generateArticleSlug(
  title: string,
): Promise<{ slug: string }> {
  const base = slugify(title, {
    lower: true,
    strict: true,
    locale: 'ko',
    trim: true,
  });
  if (base && /^[a-z0-9-]+$/.test(base)) {
    return { slug: base.slice(0, 80) };
  }
  // fallback: title을 영문화하지 못한 경우 timestamp 6자리 suffix
  const suffix = Date.now().toString(36).slice(-6);
  return { slug: `article-${suffix}` };
}

export async function checkSlugAvailable(
  slug: string,
  excludeId?: string,
): Promise<{ available: boolean }> {
  const exists = await slugExists(slug, excludeId);
  return { available: !exists };
}

function parseFormDataInput(formData: FormData): {
  raw: Record<string, unknown>;
  publishMode: 'draft' | 'publish';
} {
  const get = (k: string) => (formData.get(k) ?? '').toString();
  const publishMode =
    (get('publishMode') as 'draft' | 'publish') === 'publish'
      ? 'publish'
      : 'draft';
  const categoryPathRaw = get('categoryPath').trim();
  const categoryPath = categoryPathRaw
    ? categoryPathRaw
        .split('>')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
  const relatedRaw = get('relatedArticleIds').trim();
  const relatedArticleIds = relatedRaw
    ? relatedRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  const raw: Record<string, unknown> = {
    productCode: get('productCode'),
    categoryPath,
    slug: get('slug').toLowerCase().trim(),
    title: get('title').trim(),
    summary30s: get('summary30s').trim() || null,
    bodyMarkdown: get('bodyMarkdown'),
    relatedArticleIds,
    publish: publishMode === 'publish',
  };
  return { raw, publishMode };
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

export async function createArticleAction(
  _prev: ArticleFormState | undefined,
  formData: FormData,
): Promise<ArticleFormState> {
  const user = await requireRole(['manager', 'admin']);
  const { raw } = parseFormDataInput(formData);
  const parsed = ArticleWriteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }
  const input: ArticleWriteInput = parsed.data;
  // slug 중복 사전 확인
  if (await slugExists(input.slug)) {
    return {
      ok: false,
      message: '같은 slug 아티클이 이미 존재합니다',
      fieldErrors: { slug: '중복된 slug입니다. 다른 값을 사용하세요.' },
    };
  }
  const result = await createArticle(input, user.id);
  if (!result.ok || !result.id) {
    return {
      ok: false,
      message:
        result.message === 'SLUG_DUPLICATE'
          ? '같은 slug 아티클이 이미 존재합니다'
          : '아티클 생성 실패',
    };
  }
  logActivity({
    userId: user.id,
    action: input.publish ? 'article.publish' : 'article.create',
    targetType: 'article',
    targetId: result.id,
    payload: { slug: input.slug, title: input.title, publish: !!input.publish },
  });
  revalidatePath('/admin/articles');
  revalidatePath('/help');
  revalidatePath(`/help/${input.productCode}`);
  if (input.publish) {
    revalidatePath(`/help/${input.productCode}/${input.slug}`);
  }
  return { ok: true, id: result.id };
}

export async function updateArticleAction(
  id: string,
  _prev: ArticleFormState | undefined,
  formData: FormData,
): Promise<ArticleFormState> {
  const user = await requireRole(['manager', 'admin']);
  const { raw } = parseFormDataInput(formData);
  const parsed = ArticleWriteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }
  const input: ArticleWriteInput = parsed.data;
  if (await slugExists(input.slug, id)) {
    return {
      ok: false,
      message: '같은 slug 아티클이 이미 존재합니다',
      fieldErrors: { slug: '중복된 slug입니다.' },
    };
  }
  const result = await updateArticleById(id, input);
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.message === 'SLUG_DUPLICATE'
          ? '같은 slug 아티클이 이미 존재합니다'
          : '아티클 갱신 실패',
    };
  }
  logActivity({
    userId: user.id,
    action: 'article.update',
    targetType: 'article',
    targetId: id,
    payload: { slug: input.slug, title: input.title },
  });
  revalidatePath('/admin/articles');
  revalidatePath(`/admin/articles/${id}`);
  revalidatePath('/help');
  revalidatePath(`/help/${input.productCode}`);
  revalidatePath(`/help/${input.productCode}/${input.slug}`);
  return { ok: true, id };
}

export async function togglePublishArticleAction(
  id: string,
  publish: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const result = await togglePublishArticleById(id, publish);
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: publish ? 'article.publish' : 'article.unpublish',
      targetType: 'article',
      targetId: id,
      payload: { publish },
    });
    revalidatePath('/admin/articles');
    revalidatePath('/help');
  }
  return result;
}

export async function archiveArticleAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const result = await archiveArticleById(id);
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'article.archive',
      targetType: 'article',
      targetId: id,
    });
    revalidatePath('/admin/articles');
    revalidatePath('/help');
  }
  return result;
}

export async function restoreArticleAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const result = await restoreArticleById(id);
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'article.restore',
      targetType: 'article',
      targetId: id,
    });
    revalidatePath('/admin/articles');
    revalidatePath('/help');
  }
  return result;
}
