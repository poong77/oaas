'use server';

/**
 * Server Actions — 메뉴 구조 마스터 CRUD (menu-taxonomies).
 *
 * 권한: 어드민만 (Plan §10 Q-11, 메뉴 마스터는 admin-only 정책).
 * 캐시: 모든 쓰기에서 revalidateTag('menu-taxonomies') 호출.
 * 감사 로그: 모든 액션은 activity_logs에 기록.
 *
 * @see docs/01-plan/features/아티클관리시스템.plan.md §5.2, P0-D
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireRole } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import {
  createMenuTaxonomy,
  deactivateMenuTaxonomy,
  restoreMenuTaxonomy,
  updateMenuTaxonomy,
} from '@/lib/services/master-menu-taxonomies';

const MENU_TAX_CACHE_TAG = 'menu-taxonomies';

const MenuTaxonomySchema = z.object({
  productCode: z
    .string()
    .trim()
    .min(1, '제품을 선택하세요')
    .max(40, '40자 이내'),
  parentId: z
    .string()
    .uuid('부모 노드 ID가 올바르지 않습니다')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  label: z
    .string()
    .trim()
    .min(1, '메뉴 라벨을 입력하세요')
    .max(60, '60자 이내'),
  description: z
    .string()
    .max(500, '500자 이내')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export type MenuTaxonomyActionState = {
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

function extractFromForm(formData: FormData) {
  const parentIdRaw = (formData.get('parentId') ?? '').toString().trim();
  return {
    productCode: (formData.get('productCode') ?? '').toString().trim(),
    parentId: parentIdRaw === '' ? null : parentIdRaw,
    label: (formData.get('label') ?? '').toString().trim(),
    description:
      ((formData.get('description') ?? '').toString().trim() || null) as
        | string
        | null,
    sortOrder: (formData.get('sortOrder') ?? '100').toString().trim(),
  };
}

function messageOf(code: string): string {
  switch (code) {
    case 'DUPLICATE_LABEL':
      return '같은 부모 아래에 동일한 라벨이 이미 있습니다';
    case 'DEPTH_EXCEEDED':
      return '메뉴 깊이는 최대 3단(0~2)까지 가능합니다';
    case 'PARENT_NOT_FOUND':
      return '부모 노드를 찾을 수 없습니다';
    case 'CYCLE_DETECTED':
      return '자기 자신 또는 후손을 부모로 지정할 수 없습니다';
    case 'INVALID_INPUT':
      return '입력값이 올바르지 않습니다';
    case 'DB_NOT_READY':
      return 'DB 연결이 준비되지 않았습니다';
    default:
      return '저장 실패';
  }
}

// ─────────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────────

export async function createMenuTaxonomyAction(
  _prev: MenuTaxonomyActionState | undefined,
  formData: FormData,
): Promise<MenuTaxonomyActionState> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = MenuTaxonomySchema.safeParse(extractFromForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }

  const result = await createMenuTaxonomy(parsed.data);
  if (!result.ok) {
    const msg = messageOf(result.message);
    return {
      ok: false,
      message: msg,
      fieldErrors:
        result.message === 'DUPLICATE_LABEL'
          ? { label: msg }
          : result.message === 'DEPTH_EXCEEDED'
            ? { parentId: msg }
            : undefined,
    };
  }
  logActivity({
    userId: user.id,
    action: 'master.menu_taxonomy.create',
    targetType: 'menu_taxonomy',
    targetId: result.id,
    payload: parsed.data,
  });
  revalidateTag(MENU_TAX_CACHE_TAG, 'default');
  revalidatePath('/admin/master/menu-taxonomies');
  redirect(`/admin/master/menu-taxonomies/${result.id}`);
}

// ─────────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────────

export async function updateMenuTaxonomyAction(
  nodeId: string,
  _prev: MenuTaxonomyActionState | undefined,
  formData: FormData,
): Promise<MenuTaxonomyActionState> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = MenuTaxonomySchema.safeParse(extractFromForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }
  const result = await updateMenuTaxonomy(nodeId, parsed.data);
  if (!result.ok) {
    const msg = messageOf(result.message);
    return {
      ok: false,
      message: msg,
      fieldErrors:
        result.message === 'DUPLICATE_LABEL'
          ? { label: msg }
          : result.message === 'DEPTH_EXCEEDED' ||
              result.message === 'CYCLE_DETECTED'
            ? { parentId: msg }
            : undefined,
    };
  }
  logActivity({
    userId: user.id,
    action: 'master.menu_taxonomy.update',
    targetType: 'menu_taxonomy',
    targetId: nodeId,
    payload: parsed.data,
  });
  revalidateTag(MENU_TAX_CACHE_TAG, 'default');
  revalidatePath('/admin/master/menu-taxonomies');
  revalidatePath(`/admin/master/menu-taxonomies/${nodeId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────
// Activate / Deactivate (cascade 자식 비활성)
// ─────────────────────────────────────────────────────────────────

export async function toggleMenuTaxonomyAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string; affectedCount?: number }> {
  const user = await requireRole(['manager', 'admin']);
  const id = (formData.get('id') ?? '').toString().trim();
  const action = (formData.get('action') ?? '').toString().trim();
  if (!id) return { ok: false, message: 'ID 누락' };

  if (action === 'deactivate') {
    const result = await deactivateMenuTaxonomy(id);
    if (!result.ok) return { ok: false, message: '비활성화 실패' };
    logActivity({
      userId: user.id,
      action: 'master.menu_taxonomy.deactivate',
      targetType: 'menu_taxonomy',
      targetId: id,
      payload: { affectedCount: result.affectedCount },
    });
    revalidateTag(MENU_TAX_CACHE_TAG, 'default');
    revalidatePath('/admin/master/menu-taxonomies');
    revalidatePath(`/admin/master/menu-taxonomies/${id}`);
    return { ok: true, affectedCount: result.affectedCount };
  } else if (action === 'activate') {
    const result = await restoreMenuTaxonomy(id);
    if (!result.ok) return { ok: false, message: '활성화 실패' };
    logActivity({
      userId: user.id,
      action: 'master.menu_taxonomy.activate',
      targetType: 'menu_taxonomy',
      targetId: id,
    });
    revalidateTag(MENU_TAX_CACHE_TAG, 'default');
    revalidatePath('/admin/master/menu-taxonomies');
    revalidatePath(`/admin/master/menu-taxonomies/${id}`);
    return { ok: true };
  }

  return { ok: false, message: '알 수 없는 액션' };
}
