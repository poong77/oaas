/**
 * 마스터 — notification_templates (Phase 9).
 *
 * 이벤트별 + 채널(sms/email)별 알림 템플릿.
 * (channel, event_key) unique. 동일 키 충돌 시 update.
 *
 * 운영:
 *   - body_template에 `{{변수}}` 치환자 사용.
 *   - DB에 row 없으면 `lib/notifications/templates.ts`의 하드코딩 빌더로 fallback.
 */

import 'server-only';
import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import {
  notificationTemplates,
  type NewNotificationTemplate,
  type NotificationChannel,
  type NotificationTemplate,
} from '@/db/schema';

/** 알려진 event_key 화이트리스트 (UI용 select 옵션 + 검증). */
export const KNOWN_EVENT_KEYS = [
  'ticket.received',
  'ticket.in_progress',
  'ticket.completed',
  'account.invite',
  'account.password_reset',
] as const;
export type KnownEventKey = (typeof KNOWN_EVENT_KEYS)[number];

export async function listTemplates(
  options: { channel?: NotificationChannel; includeInactive?: boolean } = {},
): Promise<NotificationTemplate[]> {
  if (!db) return [];
  try {
    const conditions = [];
    if (!options.includeInactive) {
      conditions.push(eq(notificationTemplates.isActive, true));
    }
    if (options.channel) {
      conditions.push(eq(notificationTemplates.channel, options.channel));
    }
    const where = conditions.length === 0 ? undefined : and(...conditions);
    return await db
      .select()
      .from(notificationTemplates)
      .where(where)
      .orderBy(
        asc(notificationTemplates.eventKey),
        asc(notificationTemplates.channel),
      );
  } catch (err) {
    console.error('[master-templates.listTemplates] 실패:', err);
    return [];
  }
}

export async function getTemplateById(
  id: string,
): Promise<NotificationTemplate | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[master-templates.getTemplateById] 실패:', err);
    return null;
  }
}

/** lib/notifications/templates.ts에서 호출. DB row 있으면 그것을 사용. */
export async function findTemplate(
  channel: NotificationChannel,
  eventKey: string,
): Promise<NotificationTemplate | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(notificationTemplates)
      .where(
        and(
          eq(notificationTemplates.channel, channel),
          eq(notificationTemplates.eventKey, eventKey),
          eq(notificationTemplates.isActive, true),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.warn('[master-templates.findTemplate] 조회 실패 (fallback 사용):', err);
    return null;
  }
}

export type TemplateWriteInput = {
  channel: NotificationChannel;
  eventKey: string;
  subject?: string | null;
  bodyTemplate: string;
  description?: string | null;
};

export async function upsertTemplate(
  input: TemplateWriteInput,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const row: NewNotificationTemplate = {
      channel: input.channel,
      eventKey: input.eventKey,
      subject: input.subject ?? null,
      bodyTemplate: input.bodyTemplate,
      description: input.description ?? null,
    };
    const [created] = await db
      .insert(notificationTemplates)
      .values(row)
      .onConflictDoUpdate({
        target: [
          notificationTemplates.channel,
          notificationTemplates.eventKey,
        ],
        set: {
          subject: row.subject,
          bodyTemplate: row.bodyTemplate,
          description: row.description,
          isActive: true,
        },
      })
      .returning({ id: notificationTemplates.id });
    return { ok: true, id: created?.id };
  } catch (err) {
    console.error('[master-templates.upsertTemplate] 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

export async function updateTemplateById(
  id: string,
  input: Partial<Omit<TemplateWriteInput, 'channel' | 'eventKey'>>,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(notificationTemplates)
      .set({
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        ...(input.bodyTemplate !== undefined
          ? { bodyTemplate: input.bodyTemplate }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
      })
      .where(eq(notificationTemplates.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[master-templates.updateTemplateById] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function setTemplateActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(notificationTemplates)
      .set({ isActive })
      .where(eq(notificationTemplates.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[master-templates.setTemplateActive] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

/** body에 {{key}} 치환. 단순 string replace. HTML escape는 호출부 책임. */
export function renderTemplateBody(
  body: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}
