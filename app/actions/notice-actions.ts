'use server';

/**
 * notices 관련 Server Actions (Phase 7).
 *
 * public:
 *   - bumpNoticeViewCount (fire-and-forget)
 *
 * 어드민 (매니저+어드민):
 *   - createNoticeAction / updateNoticeAction
 *   - togglePublishNoticeAction / archiveNoticeAction / restoreNoticeAction
 *
 * activity_logs:
 *   - notice.create / notice.update / notice.publish / notice.unpublish
 *   - notice.archive / notice.restore
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import {
  archiveNoticeById,
  createNotice,
  incrementNoticeViewCount,
  restoreNoticeById,
  togglePublishNoticeById,
  updateNoticeById,
  type NoticeWriteInput,
} from '@/lib/services/notices';

// ─────────────────────────────────────────────────────────────────────
// public — 조회수
// ─────────────────────────────────────────────────────────────────────

/** 페이지 진입 시 호출. fire-and-forget. */
export async function bumpNoticeViewCount(noticeId: string): Promise<void> {
  if (!noticeId || typeof noticeId !== 'string') return;
  incrementNoticeViewCount(noticeId);
}

// ─────────────────────────────────────────────────────────────────────
// 어드민 CRUD
// ─────────────────────────────────────────────────────────────────────

const NoticeWriteSchema = z.object({
  kind: z.enum(['notice', 'release', 'incident']),
  productCode: z.string().min(1).max(50).optional().nullable(),
  title: z.string().min(1, '제목을 입력하세요').max(200),
  bodyMarkdown: z.string().min(1, '본문을 입력하세요'),
  pinned: z.boolean().optional(),
  banner: z.boolean().optional(),
  /** ISO string from datetime-local input — '' / undefined / 'null' 모두 null로 변환 */
  bannerUntilIso: z.string().optional().nullable(),
  // NT-04 홈 팝업 배너
  popupEnabled: z.boolean().optional(),
  popupImageUrl: z.string().url('유효한 이미지 URL이 아닙니다').optional().nullable(),
  popupSize: z.enum(['small', 'medium', 'large']).optional(),
  popupUntilIso: z.string().optional().nullable(),
  publish: z.boolean().optional(),
});

export type NoticeFormState = {
  ok: boolean;
  id?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};

function parseFormDataInput(formData: FormData): {
  raw: Record<string, unknown>;
  publishMode: 'draft' | 'publish';
} {
  const get = (k: string) => (formData.get(k) ?? '').toString();
  const getBool = (k: string) => {
    const v = get(k);
    return v === 'on' || v === 'true' || v === '1';
  };
  const publishMode =
    (get('publishMode') as 'draft' | 'publish') === 'publish'
      ? 'publish'
      : 'draft';
  const productCodeRaw = get('productCode').trim();
  const bannerUntilRaw = get('bannerUntil').trim();
  const popupImageUrlRaw = get('popupImageUrl').trim();
  const popupSizeRaw = get('popupSize').trim();
  const popupUntilRaw = get('popupUntil').trim();

  const raw: Record<string, unknown> = {
    kind: get('kind'),
    productCode: productCodeRaw || null,
    title: get('title').trim(),
    bodyMarkdown: get('bodyMarkdown'),
    pinned: getBool('pinned'),
    banner: getBool('banner'),
    bannerUntilIso: bannerUntilRaw || null,
    popupEnabled: getBool('popupEnabled'),
    popupImageUrl: popupImageUrlRaw || null,
    popupSize: popupSizeRaw || undefined,
    popupUntilIso: popupUntilRaw || null,
    publish: publishMode === 'publish',
  };
  return { raw, publishMode };
}

function shapeFieldErrors(err: z.ZodError<unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.') || '_';
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}

function buildWriteInput(
  parsed: z.infer<typeof NoticeWriteSchema>,
): NoticeWriteInput {
  let bannerUntil: Date | null = null;
  if (parsed.bannerUntilIso) {
    const d = new Date(parsed.bannerUntilIso);
    if (!isNaN(d.getTime())) bannerUntil = d;
  }
  // banner=false 면 banner_until 강제 null
  if (!parsed.banner) bannerUntil = null;

  // NT-04 팝업 배너
  let popupUntil: Date | null = null;
  if (parsed.popupUntilIso) {
    const d = new Date(parsed.popupUntilIso);
    if (!isNaN(d.getTime())) popupUntil = d;
  }
  const popupEnabled = parsed.popupEnabled ?? false;
  // popup_enabled=false 면 부속 필드 강제 초기화
  const popupImageUrl = popupEnabled ? (parsed.popupImageUrl ?? null) : null;
  const popupSize = popupEnabled ? (parsed.popupSize ?? 'medium') : 'medium';
  if (!popupEnabled) popupUntil = null;

  return {
    kind: parsed.kind,
    productCode: parsed.productCode ?? null,
    title: parsed.title,
    bodyMarkdown: parsed.bodyMarkdown,
    pinned: parsed.pinned ?? false,
    banner: parsed.banner ?? false,
    bannerUntil,
    popupEnabled,
    popupImageUrl,
    popupSize,
    popupUntil,
    publish: parsed.publish,
  };
}

export async function createNoticeAction(
  _prev: NoticeFormState | undefined,
  formData: FormData,
): Promise<NoticeFormState> {
  const user = await requireRole(['manager', 'admin']);
  const { raw } = parseFormDataInput(formData);
  const parsed = NoticeWriteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }
  const input = buildWriteInput(parsed.data);
  const result = await createNotice(input, user.id);
  if (!result.ok || !result.id) {
    return { ok: false, message: result.message ?? '공지 생성 실패' };
  }
  logActivity({
    userId: user.id,
    action: input.publish ? 'notice.publish' : 'notice.create',
    targetType: 'notice',
    targetId: result.id,
    payload: {
      kind: input.kind,
      title: input.title,
      publish: !!input.publish,
      pinned: !!input.pinned,
      banner: !!input.banner,
      popup: !!input.popupEnabled,
    },
  });
  revalidatePath('/admin/notices');
  revalidatePath('/notices');
  revalidatePath('/'); // 홈 위젯
  revalidatePath('/search'); // 검색 탭
  return { ok: true, id: result.id };
}

export async function updateNoticeAction(
  id: string,
  _prev: NoticeFormState | undefined,
  formData: FormData,
): Promise<NoticeFormState> {
  const user = await requireRole(['manager', 'admin']);
  const { raw } = parseFormDataInput(formData);
  const parsed = NoticeWriteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }
  const input = buildWriteInput(parsed.data);
  const result = await updateNoticeById(id, input);
  if (!result.ok) {
    return { ok: false, message: result.message ?? '공지 갱신 실패' };
  }
  logActivity({
    userId: user.id,
    action: 'notice.update',
    targetType: 'notice',
    targetId: id,
    payload: {
      kind: input.kind,
      title: input.title,
      pinned: !!input.pinned,
      banner: !!input.banner,
      popup: !!input.popupEnabled,
    },
  });
  revalidatePath('/admin/notices');
  revalidatePath(`/admin/notices/${id}`);
  revalidatePath('/notices');
  revalidatePath(`/notices/${id}`);
  revalidatePath('/');
  revalidatePath('/search');
  return { ok: true, id };
}

export async function togglePublishNoticeAction(
  id: string,
  publish: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const result = await togglePublishNoticeById(id, publish);
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: publish ? 'notice.publish' : 'notice.unpublish',
      targetType: 'notice',
      targetId: id,
      payload: { publish },
    });
    revalidatePath('/admin/notices');
    revalidatePath('/notices');
    revalidatePath(`/notices/${id}`);
    revalidatePath('/');
  }
  return result;
}

export async function archiveNoticeAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const result = await archiveNoticeById(id);
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'notice.archive',
      targetType: 'notice',
      targetId: id,
    });
    revalidatePath('/admin/notices');
    revalidatePath('/notices');
    revalidatePath('/');
  }
  return result;
}

export async function restoreNoticeAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const result = await restoreNoticeById(id);
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'notice.restore',
      targetType: 'notice',
      targetId: id,
    });
    revalidatePath('/admin/notices');
    revalidatePath('/notices');
  }
  return result;
}
