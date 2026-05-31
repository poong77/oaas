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
  getArticleById,
  incrementViewCount,
  publishArticleById,
  recordFeedback,
  restoreArticleById,
  slugExists,
  togglePublishArticleById,
  unpublishArticleById,
  updateArticleById,
  type ArticleWriteInput,
} from '@/lib/services/articles';
import { upsertRedirect } from '@/lib/services/article-redirects';
import {
  validateBody,
  validateTitle,
  validateSummary,
} from '@/lib/articles/body-validator';
import { articleSaveSchema } from '@/lib/articles/zod-schemas';
import {
  getMenuTaxonomyTreeByProduct,
  type MenuTaxonomyTreeNode,
} from '@/lib/services/master-menu-taxonomies';
import {
  resolveArticleTemplate,
  type ResolvedTemplate,
} from '@/lib/services/master-article-templates';
import { generateOpsIdSlug, isOpsIdSlug } from '@/lib/articles/ops-id-slug';
import {
  recommendKeywords,
  recommendRelatedArticles,
  type KeywordRecommendation,
  type RelatedArticleRecommendation,
} from '@/lib/articles/recommend';
import type { ArticleContentType } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────
// knowledge-base-overhaul Phase 1 (A2/B1) — 메뉴 트리 조회
// ─────────────────────────────────────────────────────────────────────

/**
 * 매니저/어드민용 메뉴 트리 조회 (캐스케이딩 드롭다운 + /help 사이드바 공용).
 *
 * 200ms 내 응답 목표 (단일 productCode + 캐시 적용된 raw 활용).
 */
export async function getMenuTaxonomyTreeAction(
  productCode: string,
): Promise<MenuTaxonomyTreeNode[]> {
  await requireRole(['manager', 'admin']);
  if (!productCode?.trim()) return [];
  return getMenuTaxonomyTreeByProduct(productCode.trim());
}

/**
 * A7 — 운영 ID slug 채번 (atomic UPSERT).
 *
 * 형식: `{productCode}-{contentType}-{seq3}` 예: `pms-howto-042`.
 * 매니저가 "자동 생성" 버튼 클릭 시 호출.
 */
export async function generateOpsIdSlugAction(
  productCode: string,
  contentType: ArticleContentType,
): Promise<{ ok: true; slug: string; seq: number } | { ok: false; message: string }> {
  await requireRole(['manager', 'admin']);
  if (!productCode?.trim()) return { ok: false, message: '제품 코드가 비어 있습니다.' };
  try {
    const { slug, seq } = await generateOpsIdSlug(productCode, contentType);
    return { ok: true, slug, seq };
  } catch (err) {
    console.error('[generateOpsIdSlugAction] 실패:', err);
    return { ok: false, message: 'slug 생성에 실패했습니다.' };
  }
}

/**
 * A1+ — content_type별 본문 골격 fetch (DB 우선, 코드 폴백).
 *
 * 어드민에서 골격 편집해도 매니저 에디터에 자동 반영됨 (캐시 적용).
 */
export async function resolveArticleTemplateAction(
  contentType: ArticleContentType,
): Promise<ResolvedTemplate> {
  await requireRole(['manager', 'admin']);
  return resolveArticleTemplate(contentType);
}

/**
 * A3 — 키워드 추천 (동의어 그룹 + 본문 빈도 토큰).
 */
export async function recommendKeywordsAction(input: {
  title: string;
  body: string;
  productCode: string;
  existing: string[];
}): Promise<KeywordRecommendation[]> {
  await requireRole(['manager', 'admin']);
  return recommendKeywords({
    title: input.title ?? '',
    body: input.body ?? '',
    productCode: input.productCode ?? '',
    existing: input.existing ?? [],
  });
}

/**
 * A4 — 관련 문서 추천 (같은 카테고리 + 키워드 교집합 + 본문 링크).
 */
export async function recommendRelatedArticlesAction(input: {
  productCode: string;
  categoryPath: string[];
  keywords: string[];
  body: string;
  excludeId?: string;
}): Promise<RelatedArticleRecommendation[]> {
  await requireRole(['manager', 'admin']);
  if (!input.productCode?.trim()) return [];
  return recommendRelatedArticles({
    productCode: input.productCode.trim(),
    categoryPath: input.categoryPath ?? [],
    keywords: input.keywords ?? [],
    body: input.body ?? '',
    excludeId: input.excludeId,
  });
}

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

/**
 * 어드민 폼 검증 스키마 — `articleSaveSchema`(lib/articles/zod-schemas.ts) 기반.
 *
 * 통합 (P1-1, 2026-05-30):
 *   - SLUG_PATTERN·길이 제약은 `articleSaveSchema`에 일원화
 *   - 폼 전용 어댑터 필드 추가: `categoryPath`(메뉴 경로 어댑터), `publish`(발행 토글),
 *     `relatedArticleIds`(레거시 uuid 호환), `summary30s`(레거시 컬럼 호환)
 *   - title/summary/menu_path 검증은 `articleSaveSchema`에서 그대로 상속
 *
 * v1.1 (Design D-4): summary 2000자 hard limit, 200자 권장 워닝은 body-validator로.
 */
const ArticleWriteSchema = articleSaveSchema
  // 폼에서는 일부 필드를 다른 이름/제약으로 받으므로 어댑터 처리
  .omit({ menuPath: true, keywords: true, contentType: true })
  .extend({
    /** 폼 default 'howto' (카드 선택 UI). */
    contentType: z
      .enum(['howto', 'feature', 'troubleshoot'])
      .default('howto'),
    /** 어댑터: 폼에서는 categoryPath라는 이름 사용. 1~3단계 (Plan §2.3). */
    categoryPath: z
      .array(z.string().trim().min(1).max(60))
      .max(3, '메뉴 경로는 최대 3단계까지')
      .optional()
      .nullable(),
    /** 폼은 draft 저장 허용 — keywords 빈 배열 가능. 발행 시 body-validator에서 워닝. */
    keywords: z
      .array(z.string().trim().min(1).max(60))
      .max(30, '키워드는 최대 30개')
      .optional()
      .nullable(),
    /** v1.1 status — draft/published 명시. 미지정 시 publish 플래그로 결정. */
    status: z.enum(['draft', 'published']).optional(),
    /** 레거시 summary_30s 컬럼 호환 (마이그레이션 기간 동안만, Q-13). */
    summary30s: z.string().max(2000).optional().nullable(),
    /** 레거시 relatedArticleIds (uuid[]) 호환 (P1-2 마이그레이션 후 제거 예정, Q-14). */
    relatedArticleIds: z.array(z.string().uuid()).optional().nullable(),
    /** 폼 발행 토글 — true 시 createArticle/updateArticle이 status='published'로 처리. */
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
  const relatedSlugsRaw = get('relatedSlugs').trim();
  const relatedSlugs = relatedSlugsRaw
    ? relatedSlugsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
  const keywordsRaw = get('keywords').trim();
  const keywords = keywordsRaw
    ? keywordsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
  const appliesToRaw = get('appliesTo').trim();
  let appliesTo: { feature?: string; models?: string[] } | null = null;
  if (appliesToRaw) {
    try {
      appliesTo = JSON.parse(appliesToRaw);
    } catch {
      appliesTo = null;
    }
  }
  const summary = get('summary').trim() || null;

  const raw: Record<string, unknown> = {
    productCode: get('productCode'),
    contentType: (get('contentType') || 'howto') as
      | 'howto'
      | 'feature'
      | 'troubleshoot',
    categoryPath,
    slug: get('slug').toLowerCase().trim(),
    title: get('title').trim(),
    summary,
    // 호환: summary 비어 있고 summary30s 들어오면 summary로 통합 (Q-13)
    summary30s: get('summary30s').trim() || summary,
    keywords,
    appliesTo,
    bodyMarkdown: get('bodyMarkdown'),
    relatedSlugs,
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
  // 발행 차단 가드 — Plan Q-9, Design §6.3
  if (input.publish && input.contentType) {
    const { errors } = validateBody(input.bodyMarkdown, input.contentType);
    if (errors.length > 0) {
      return {
        ok: false,
        message: `발행 차단: ${errors[0]} (총 ${errors.length}건)`,
        fieldErrors: { bodyMarkdown: errors.join(' / ') },
      };
    }
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
  // 발행 상태로 전환되는 경우 검증 (Q-9)
  const willPublish = input.publish === true || input.status === 'published';
  if (willPublish && input.contentType) {
    const { errors } = validateBody(input.bodyMarkdown, input.contentType);
    if (errors.length > 0) {
      return {
        ok: false,
        message: `발행 차단: ${errors[0]} (총 ${errors.length}건)`,
        fieldErrors: { bodyMarkdown: errors.join(' / ') },
      };
    }
  }
  // content_type 또는 slug 변경 시 옛 URL → 새 slug 리다이렉트 (Design §5.3)
  const existing = await getArticleById(id);
  if (existing) {
    const slugChanged = existing.slug !== input.slug;
    const ctChanged = existing.contentType !== input.contentType;
    if (slugChanged || ctChanged) {
      // 옛 URL 1개: /help/[productCode]/[contentType]/[slug]
      await upsertRedirect({
        fromPath: `/help/${existing.productCode}/${existing.contentType}/${existing.slug}`,
        toSlug: input.slug,
        reason: slugChanged ? 'slug_rename' : 'content_type_change',
      });
      // 레거시 URL: /help/[productCode]/[slug]
      if (slugChanged) {
        await upsertRedirect({
          fromPath: `/help/${existing.productCode}/${existing.slug}`,
          toSlug: input.slug,
          reason: 'slug_rename',
        });
      }
    }
  }
  const result = await updateArticleById(id, input, user.id);
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

/**
 * v1.1 — 명시적 발행 액션.
 * body-validator 차단 (Q-9). content_type별 필수 H2 누락 시 errors 반환.
 */
export async function publishArticleAction(
  id: string,
): Promise<{
  ok: boolean;
  message?: string;
  errors?: string[];
  warnings?: string[];
}> {
  const user = await requireRole(['manager', 'admin']);
  const article = await getArticleById(id);
  if (!article) return { ok: false, message: '아티클을 찾을 수 없습니다' };

  const { errors, warnings } = validateBody(
    article.bodyMarkdown,
    article.contentType,
  );
  const titleW = validateTitle(article.title).warnings;
  const summaryW = validateSummary(article.summary).warnings;
  const allWarnings = [...warnings, ...titleW, ...summaryW];

  if (errors.length > 0) {
    return {
      ok: false,
      message: `발행 차단 (${errors.length}건)`,
      errors,
      warnings: allWarnings,
    };
  }

  const result = await publishArticleById(id, user.id);
  if (!result.ok) {
    return { ok: false, message: result.message ?? '발행 실패' };
  }
  logActivity({
    userId: user.id,
    action: 'article.publish',
    targetType: 'article',
    targetId: id,
    payload: { slug: article.slug, contentType: article.contentType },
  });
  revalidatePath('/admin/articles');
  revalidatePath(`/admin/articles/${id}`);
  revalidatePath('/help');
  revalidatePath(`/help/${article.productCode}`);
  revalidatePath(
    `/help/${article.productCode}/${article.contentType}/${article.slug}`,
  );
  return { ok: true, warnings: allWarnings };
}

/** v1.1 — 명시적 비공개 액션. */
export async function unpublishArticleAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const article = await getArticleById(id);
  if (!article) return { ok: false, message: '아티클을 찾을 수 없습니다' };
  const result = await unpublishArticleById(id, user.id);
  if (!result.ok) return result;
  logActivity({
    userId: user.id,
    action: 'article.unpublish',
    targetType: 'article',
    targetId: id,
    payload: { slug: article.slug },
  });
  revalidatePath('/admin/articles');
  revalidatePath(`/admin/articles/${id}`);
  revalidatePath('/help');
  revalidatePath(
    `/help/${article.productCode}/${article.contentType}/${article.slug}`,
  );
  return { ok: true };
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
