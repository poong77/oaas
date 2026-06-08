'use server';

/**
 * 어드민 마스터DB Server Actions (Phase 9).
 *
 * 도메인별 액션을 한 파일에 정리 (단순 CRUD라 분리 비용 > 이득).
 * 권한:
 *   - 기본: 매니저+어드민
 *   - system-settings: 어드민 only
 * 모든 액션은 fire-and-forget audit log + revalidate.
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

import { requireRole } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import { CATEGORIES_CACHE_TAG } from '@/lib/services/categories';
import * as MC from '@/lib/services/master-categories';
import * as MT from '@/lib/services/master-templates';
import * as MQR from '@/lib/services/master-quick-replies';
import * as MQA from '@/lib/services/master-quick-actions';
import * as MRS from '@/lib/services/master-role-starters';
import * as MPK from '@/lib/services/master-popular-keywords';
import * as MSL from '@/lib/services/master-solution-links';
import * as MSS from '@/lib/services/master-system-settings';
import * as MFF from '@/lib/services/master-form-fields';
import { setManagerMenuAccess } from '@/lib/services/master-menu-access';

export type ActionResult = {
  ok: boolean;
  id?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};

function getStr(fd: FormData, k: string): string {
  return (fd.get(k) ?? '').toString().trim();
}
function getOptStr(fd: FormData, k: string): string | null {
  const v = (fd.get(k) ?? '').toString().trim();
  return v === '' ? null : v;
}
function getInt(fd: FormData, k: string, def = 0): number {
  const v = (fd.get(k) ?? '').toString().trim();
  if (!v) return def;
  const n = parseInt(v, 10);
  return isNaN(n) ? def : n;
}
function getBool(fd: FormData, k: string): boolean {
  const v = (fd.get(k) ?? '').toString();
  return v === 'on' || v === 'true' || v === '1';
}

function revalidateAdminMaster(...subPaths: string[]) {
  revalidatePath('/admin/master');
  for (const p of subPaths) {
    revalidatePath(p);
    // 홈/공개 화면이 unstable_cache로 캐싱하는 마스터DB는 path가 아닌 tag로만
    // 무효화된다. 해당 도메인 변경 시 캐시 태그도 함께 만료시킨다.
    if (p === '/admin/master/categories') {
      revalidateTag(CATEGORIES_CACHE_TAG, 'default');
    } else if (p === '/admin/master/quick-actions') {
      revalidateTag(MQA.QUICK_ACTIONS_CACHE_TAG, 'default');
    } else if (p === '/admin/master/role-starters') {
      revalidateTag(MRS.ROLE_STARTERS_CACHE_TAG, 'default');
    } else if (p === '/admin/master/popular-keywords') {
      revalidateTag(MPK.POPULAR_KEYWORDS_CACHE_TAG, 'default');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// 1. categories
// ─────────────────────────────────────────────────────────────────────

const CategorySchema = z.object({
  type: z.enum(['product', 'issue_type', 'urgency', 'impact']),
  code: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  icon: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export async function createCategoryAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['manager', 'admin']);
  const raw = {
    type: getStr(formData, 'type'),
    code: getStr(formData, 'code'),
    label: getStr(formData, 'label'),
    icon: getOptStr(formData, 'icon'),
    sortOrder: getInt(formData, 'sortOrder', 0),
  };
  const parsed = CategorySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: '입력값 확인' };
  }
  const result = await MC.createCategory(parsed.data);
  if (!result.ok || !result.id) {
    return { ok: false, message: result.message ?? '생성 실패' };
  }
  logActivity({
    userId: user.id,
    action: 'master.category.create',
    targetType: 'category',
    targetId: result.id,
    payload: { type: parsed.data.type, code: parsed.data.code },
  });
  revalidateAdminMaster('/admin/master/categories', '/');
  return { ok: true, id: result.id };
}

export async function updateCategoryAction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['manager', 'admin']);
  const result = await MC.updateCategory(id, {
    code: getStr(formData, 'code') || undefined,
    label: getStr(formData, 'label') || undefined,
    icon: getOptStr(formData, 'icon'),
    sortOrder: getInt(formData, 'sortOrder', 0),
  });
  if (!result.ok) return { ok: false, message: result.message };
  logActivity({
    userId: user.id,
    action: 'master.category.update',
    targetType: 'category',
    targetId: id,
  });
  revalidateAdminMaster('/admin/master/categories', '/');
  return { ok: true };
}

export async function setCategoryActiveAction(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const result = await MC.setCategoryActive(id, isActive);
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: isActive ? 'master.category.restore' : 'master.category.archive',
      targetType: 'category',
      targetId: id,
    });
    revalidateAdminMaster('/admin/master/categories', '/');
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────
// 2. notification_templates
// ─────────────────────────────────────────────────────────────────────

const TemplateSchema = z.object({
  channel: z.enum(['sms', 'email', 'slack']),
  eventKey: z.string().min(1).max(80),
  subject: z.string().max(200).nullable().optional(),
  bodyTemplate: z.string().min(1),
  description: z.string().max(500).nullable().optional(),
});

export async function upsertTemplateAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['manager', 'admin']);
  const raw = {
    channel: getStr(formData, 'channel'),
    eventKey: getStr(formData, 'eventKey'),
    subject: getOptStr(formData, 'subject'),
    bodyTemplate: getStr(formData, 'bodyTemplate'),
    description: getOptStr(formData, 'description'),
  };
  const parsed = TemplateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: '입력값 확인 (channel/eventKey/body 필수)' };
  }
  const result = await MT.upsertTemplate(parsed.data);
  if (!result.ok || !result.id) {
    return { ok: false, message: result.message };
  }
  logActivity({
    userId: user.id,
    action: 'master.template.upsert',
    targetType: 'notification_template',
    targetId: result.id,
    payload: {
      channel: parsed.data.channel,
      eventKey: parsed.data.eventKey,
    },
  });
  revalidateAdminMaster('/admin/master/notification-templates');
  return { ok: true, id: result.id };
}

export async function updateTemplateAction(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['manager', 'admin']);
  const result = await MT.updateTemplateById(id, {
    subject: getOptStr(formData, 'subject'),
    bodyTemplate: getStr(formData, 'bodyTemplate') || undefined,
    description: getOptStr(formData, 'description'),
  });
  if (!result.ok) return { ok: false, message: result.message };
  logActivity({
    userId: user.id,
    action: 'master.template.update',
    targetType: 'notification_template',
    targetId: id,
  });
  revalidateAdminMaster('/admin/master/notification-templates');
  return { ok: true };
}

export async function setTemplateActiveAction(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const result = await MT.setTemplateActive(id, isActive);
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: isActive ? 'master.template.restore' : 'master.template.archive',
      targetType: 'notification_template',
      targetId: id,
    });
    revalidateAdminMaster('/admin/master/notification-templates');
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────
// 3. quick_reply_templates
// ─────────────────────────────────────────────────────────────────────

const QuickReplySchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1),
  category: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export async function upsertQuickReplyAction(
  id: string | null,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['manager', 'admin']);
  const raw = {
    title: getStr(formData, 'title'),
    content: getStr(formData, 'content'),
    category: getOptStr(formData, 'category'),
    sortOrder: getInt(formData, 'sortOrder', 0),
  };
  const parsed = QuickReplySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: '입력값 확인' };
  if (id) {
    const r = await MQR.updateQuickReply(id, parsed.data);
    if (!r.ok) return { ok: false, message: r.message };
    logActivity({
      userId: user.id,
      action: 'master.quick_reply.update',
      targetType: 'quick_reply',
      targetId: id,
    });
    revalidateAdminMaster('/admin/master/quick-replies');
    return { ok: true, id };
  }
  const r = await MQR.createQuickReply(parsed.data);
  if (!r.ok || !r.id) return { ok: false, message: r.message };
  logActivity({
    userId: user.id,
    action: 'master.quick_reply.create',
    targetType: 'quick_reply',
    targetId: r.id,
  });
  revalidateAdminMaster('/admin/master/quick-replies');
  return { ok: true, id: r.id };
}

export async function setQuickReplyActiveAction(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const r = await MQR.setQuickReplyActive(id, isActive);
  if (r.ok) {
    logActivity({
      userId: user.id,
      action: isActive
        ? 'master.quick_reply.restore'
        : 'master.quick_reply.archive',
      targetType: 'quick_reply',
      targetId: id,
    });
    revalidateAdminMaster('/admin/master/quick-replies');
  }
  return r;
}

// ─────────────────────────────────────────────────────────────────────
// 4. quick_actions (홈 노출)
// ─────────────────────────────────────────────────────────────────────

const QuickActionSchema = z.object({
  label: z.string().min(1).max(50),
  description: z.string().max(200).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  linkUrl: z.string().min(1).max(500),
  sortOrder: z.number().int().default(0),
  visible: z.boolean().default(true),
});

export async function upsertQuickActionAction(
  id: string | null,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['manager', 'admin']);
  const raw = {
    label: getStr(formData, 'label'),
    description: getOptStr(formData, 'description'),
    icon: getOptStr(formData, 'icon'),
    linkUrl: getStr(formData, 'linkUrl'),
    sortOrder: getInt(formData, 'sortOrder', 0),
    visible: getBool(formData, 'visible'),
  };
  const parsed = QuickActionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: '입력값 확인' };
  if (id) {
    const r = await MQA.updateQuickAction(id, parsed.data);
    if (!r.ok) return { ok: false, message: r.message };
    logActivity({
      userId: user.id,
      action: 'master.quick_action.update',
      targetType: 'quick_action',
      targetId: id,
    });
    revalidateAdminMaster('/admin/master/quick-actions', '/');
    return { ok: true, id };
  }
  const r = await MQA.createQuickAction(parsed.data);
  if (!r.ok || !r.id) return { ok: false, message: r.message };
  logActivity({
    userId: user.id,
    action: 'master.quick_action.create',
    targetType: 'quick_action',
    targetId: r.id,
  });
  revalidateAdminMaster('/admin/master/quick-actions', '/');
  return { ok: true, id: r.id };
}

export async function setQuickActionActiveAction(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const r = await MQA.setQuickActionActive(id, isActive);
  if (r.ok) {
    logActivity({
      userId: user.id,
      action: isActive
        ? 'master.quick_action.restore'
        : 'master.quick_action.archive',
      targetType: 'quick_action',
      targetId: id,
    });
    revalidateAdminMaster('/admin/master/quick-actions', '/');
  }
  return r;
}

// ─────────────────────────────────────────────────────────────────────
// 5. role_starters (홈 노출)
// ─────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RoleStarterSchema = z.object({
  roleKey: z.string().min(1).max(30),
  label: z.string().min(1).max(50),
  description: z.string().max(300).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().default(0),
  /**
   * D3 — 매핑된 articleIds (순서 보존). FormData.getAll('articleIds')에서 수신.
   * uuid 형식만 허용 + 30개 cap (대시보드 무한 확장 방지).
   */
  articleIds: z
    .array(z.string().regex(UUID_RE))
    .max(30)
    .default([]),
  /** 매핑된 faqIds (순서 보존). FormData.getAll('faqIds')에서 수신. */
  faqIds: z
    .array(z.string().regex(UUID_RE))
    .max(30)
    .default([]),
});

export async function upsertRoleStarterAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['manager', 'admin']);
  // articleIds·faqIds는 hidden input 여러 개로 직렬화돼서 옴 (순서 보존)
  const rawArticleIds = formData
    .getAll('articleIds')
    .map((v) => v.toString().trim())
    .filter(Boolean);
  const rawFaqIds = formData
    .getAll('faqIds')
    .map((v) => v.toString().trim())
    .filter(Boolean);
  const raw = {
    roleKey: getStr(formData, 'roleKey'),
    label: getStr(formData, 'label'),
    description: getOptStr(formData, 'description'),
    icon: getOptStr(formData, 'icon'),
    sortOrder: getInt(formData, 'sortOrder', 0),
    articleIds: rawArticleIds,
    faqIds: rawFaqIds,
  };
  const parsed = RoleStarterSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: '입력값 확인' };
  const r = await MRS.upsertRoleStarter(parsed.data);
  if (!r.ok || !r.id) return { ok: false, message: r.message };
  logActivity({
    userId: user.id,
    action: 'master.role_starter.upsert',
    targetType: 'role_starter',
    targetId: r.id,
    payload: {
      roleKey: parsed.data.roleKey,
      articleCount: parsed.data.articleIds.length,
      faqCount: parsed.data.faqIds.length,
    },
  });
  revalidateAdminMaster('/admin/master/role-starters', '/');
  // /role/[key] 페이지도 즉시 반영
  revalidateAdminMaster(`/role/${parsed.data.roleKey}`, '/');
  return { ok: true, id: r.id };
}

export async function setRoleStarterActiveAction(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const r = await MRS.setRoleStarterActive(id, isActive);
  if (r.ok) {
    logActivity({
      userId: user.id,
      action: isActive
        ? 'master.role_starter.restore'
        : 'master.role_starter.archive',
      targetType: 'role_starter',
      targetId: id,
    });
    revalidateAdminMaster('/admin/master/role-starters', '/');
  }
  return r;
}

// ─────────────────────────────────────────────────────────────────────
// 6. solution_link_presets
// ─────────────────────────────────────────────────────────────────────

const SolutionLinkSchema = z.object({
  label: z.string().min(1).max(50),
  defaultUrlTemplate: z.string().max(500).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export async function upsertSolutionLinkPresetAction(
  id: string | null,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['manager', 'admin']);
  const raw = {
    label: getStr(formData, 'label'),
    defaultUrlTemplate: getOptStr(formData, 'defaultUrlTemplate'),
    icon: getOptStr(formData, 'icon'),
    sortOrder: getInt(formData, 'sortOrder', 0),
  };
  const parsed = SolutionLinkSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: '입력값 확인' };
  if (id) {
    const r = await MSL.updateSolutionLinkPreset(id, parsed.data);
    if (!r.ok) return { ok: false, message: r.message };
    logActivity({
      userId: user.id,
      action: 'master.solution_link.update',
      targetType: 'solution_link_preset',
      targetId: id,
    });
    revalidateAdminMaster('/admin/master/solution-links');
    return { ok: true, id };
  }
  const r = await MSL.createSolutionLinkPreset(parsed.data);
  if (!r.ok || !r.id) return { ok: false, message: r.message };
  logActivity({
    userId: user.id,
    action: 'master.solution_link.create',
    targetType: 'solution_link_preset',
    targetId: r.id,
  });
  revalidateAdminMaster('/admin/master/solution-links');
  return { ok: true, id: r.id };
}

export async function setSolutionLinkActiveAction(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const r = await MSL.setSolutionLinkPresetActive(id, isActive);
  if (r.ok) {
    logActivity({
      userId: user.id,
      action: isActive
        ? 'master.solution_link.restore'
        : 'master.solution_link.archive',
      targetType: 'solution_link_preset',
      targetId: id,
    });
    revalidateAdminMaster('/admin/master/solution-links');
  }
  return r;
}

// ─────────────────────────────────────────────────────────────────────
// 7. system_settings (어드민 only)
// ─────────────────────────────────────────────────────────────────────

const SystemSettingSchema = z.object({
  key: z.string().min(1).max(80),
  value: z.unknown(),
  description: z.string().max(500).nullable().optional(),
});

/** value는 JSON 문자열로 전달받아 파싱 시도. 실패 시 raw string으로 저장. */
function parseJsonOrString(s: string): unknown {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export async function upsertSystemSettingAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['admin']);
  const valueRaw = getStr(formData, 'value');
  const raw = {
    key: getStr(formData, 'key'),
    value: parseJsonOrString(valueRaw),
    description: getOptStr(formData, 'description'),
  };
  const parsed = SystemSettingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: '입력값 확인 (key 필수)' };
  const r = await MSS.upsertSystemSetting(
    {
      key: parsed.data.key,
      value: parsed.data.value ?? null,
      description: parsed.data.description,
    },
    user.id,
  );
  if (!r.ok || !r.id) return { ok: false, message: r.message };
  logActivity({
    userId: user.id,
    action: 'master.system_setting.upsert',
    targetType: 'system_setting',
    targetId: r.id,
    payload: { key: parsed.data.key },
  });
  revalidateAdminMaster('/admin/master/system-settings');
  return { ok: true, id: r.id };
}

export async function setSystemSettingActiveAction(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['admin']);
  const r = await MSS.setSystemSettingActive(id, isActive);
  if (r.ok) {
    logActivity({
      userId: user.id,
      action: isActive
        ? 'master.system_setting.restore'
        : 'master.system_setting.archive',
      targetType: 'system_setting',
      targetId: id,
    });
    revalidateAdminMaster('/admin/master/system-settings');
  }
  return r;
}

// ─────────────────────────────────────────────────────────────────────
// 8. ticket_form_fields
// ─────────────────────────────────────────────────────────────────────

const FormFieldSchema = z.object({
  productCode: z.string().max(50).nullable().optional(),
  fieldKey: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  inputType: z.enum(['text', 'textarea', 'select', 'number', 'date', 'file']),
  required: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  helpText: z.string().max(300).nullable().optional(),
});

/** options는 JSON 텍스트로 입력받음 ([{value, label}, ...]). */
function parseFormFieldOptions(
  s: string,
): Array<{ value: string; label: string }> {
  if (!s.trim()) return [];
  try {
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (it: unknown): it is { value: string; label: string } =>
          typeof it === 'object' &&
          it !== null &&
          'value' in it &&
          'label' in it,
      )
      .map((it) => ({ value: String(it.value), label: String(it.label) }));
  } catch {
    return [];
  }
}

export async function upsertFormFieldAction(
  id: string | null,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['manager', 'admin']);
  const raw = {
    productCode: getOptStr(formData, 'productCode'),
    fieldKey: getStr(formData, 'fieldKey'),
    label: getStr(formData, 'label'),
    inputType: getStr(formData, 'inputType') || 'text',
    required: getBool(formData, 'required'),
    sortOrder: getInt(formData, 'sortOrder', 0),
    helpText: getOptStr(formData, 'helpText'),
  };
  const parsed = FormFieldSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: '입력값 확인' };
  const options =
    parsed.data.inputType === 'select'
      ? parseFormFieldOptions(getStr(formData, 'optionsJson'))
      : [];
  if (id) {
    const r = await MFF.updateFormField(id, { ...parsed.data, options });
    if (!r.ok) return { ok: false, message: r.message };
    logActivity({
      userId: user.id,
      action: 'master.form_field.update',
      targetType: 'ticket_form_field',
      targetId: id,
    });
    revalidateAdminMaster('/admin/master/form-fields');
    return { ok: true, id };
  }
  const r = await MFF.createFormField({ ...parsed.data, options });
  if (!r.ok || !r.id) return { ok: false, message: r.message };
  logActivity({
    userId: user.id,
    action: 'master.form_field.create',
    targetType: 'ticket_form_field',
    targetId: r.id,
    payload: {
      productCode: parsed.data.productCode ?? null,
      fieldKey: parsed.data.fieldKey,
    },
  });
  revalidateAdminMaster('/admin/master/form-fields');
  return { ok: true, id: r.id };
}

export async function setFormFieldActiveAction(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const r = await MFF.setFormFieldActive(id, isActive);
  if (r.ok) {
    logActivity({
      userId: user.id,
      action: isActive
        ? 'master.form_field.restore'
        : 'master.form_field.archive',
      targetType: 'ticket_form_field',
      targetId: id,
    });
    revalidateAdminMaster('/admin/master/form-fields');
  }
  return r;
}

// ─────────────────────────────────────────────────────────────────────
// 9. popular_keywords (인기검색어 하이브리드 — pin/block)
// ─────────────────────────────────────────────────────────────────────

const PopularKeywordSchema = z.object({
  keyword: z.string().min(1).max(50),
  kind: z.enum(['pin', 'block']),
  sortOrder: z.number().int().default(0),
});

export async function upsertPopularKeywordAction(
  id: string | null,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['manager', 'admin']);
  const raw = {
    keyword: getStr(formData, 'keyword'),
    kind: getStr(formData, 'kind'),
    sortOrder: getInt(formData, 'sortOrder', 0),
  };
  const parsed = PopularKeywordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: '입력값 확인' };
  if (id) {
    const r = await MPK.updatePopularKeyword(id, parsed.data);
    if (!r.ok) return { ok: false, message: r.message };
    logActivity({
      userId: user.id,
      action: 'master.popular_keyword.update',
      targetType: 'popular_keyword',
      targetId: id,
    });
    revalidateAdminMaster('/admin/master/popular-keywords', '/', '/search');
    return { ok: true, id };
  }
  const r = await MPK.createPopularKeyword(parsed.data);
  if (!r.ok || !r.id) return { ok: false, message: r.message };
  logActivity({
    userId: user.id,
    action: 'master.popular_keyword.create',
    targetType: 'popular_keyword',
    targetId: r.id,
  });
  revalidateAdminMaster('/admin/master/popular-keywords', '/', '/search');
  return { ok: true, id: r.id };
}

export async function setPopularKeywordActiveAction(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const r = await MPK.setPopularKeywordActive(id, isActive);
  if (r.ok) {
    logActivity({
      userId: user.id,
      action: isActive
        ? 'master.popular_keyword.restore'
        : 'master.popular_keyword.archive',
      targetType: 'popular_keyword',
      targetId: id,
    });
    revalidateAdminMaster('/admin/master/popular-keywords', '/', '/search');
  }
  return r;
}

export async function deletePopularKeywordAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const r = await MPK.deletePopularKeyword(id);
  if (r.ok) {
    logActivity({
      userId: user.id,
      action: 'master.popular_keyword.delete',
      targetType: 'popular_keyword',
      targetId: id,
    });
    revalidateAdminMaster('/admin/master/popular-keywords', '/', '/search');
  }
  return r;
}

// ─────────────────────────────────────────────────────────────────────
// 10. master menu access (어드민 only) — 개별 메뉴의 매니저 접근 토글
// ─────────────────────────────────────────────────────────────────────

export async function setMasterMenuAccessAction(
  menuKey: string,
  allow: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['admin']);
  const r = await setManagerMenuAccess(menuKey, allow, user.id);
  if (r.ok) {
    logActivity({
      userId: user.id,
      action: allow
        ? 'master.menu_access.manager_allow'
        : 'master.menu_access.manager_block',
      targetType: 'master_menu',
      targetId: menuKey,
      payload: { menuKey, allow },
    });
    // 접근 맵 변경 → 마스터 인덱스(카드 노출) + 해당 메뉴 트리(layout 가드) 무효화
    revalidateAdminMaster(
      '/admin/master/menu-access',
      `/admin/master/${menuKey}`,
    );
  }
  return r;
}

