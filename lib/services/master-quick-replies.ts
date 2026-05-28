/**
 * 마스터 — quick_reply_templates (Phase 9).
 * 매니저의 티켓 답변 작성 시 사용할 정형 응대 문구.
 */

import 'server-only';
import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import {
  quickReplyTemplates,
  type NewQuickReplyTemplate,
  type QuickReplyTemplate,
} from '@/db/schema';

export async function listQuickReplies(
  includeInactive = false,
): Promise<QuickReplyTemplate[]> {
  if (!db) return [];
  try {
    const conditions = [];
    if (!includeInactive)
      conditions.push(eq(quickReplyTemplates.isActive, true));
    const where = conditions.length === 0 ? undefined : and(...conditions);
    return await db
      .select()
      .from(quickReplyTemplates)
      .where(where)
      .orderBy(
        asc(quickReplyTemplates.sortOrder),
        asc(quickReplyTemplates.title),
      );
  } catch (err) {
    console.error('[master-quick-replies.listQuickReplies] 실패:', err);
    return [];
  }
}

export async function getQuickReplyById(
  id: string,
): Promise<QuickReplyTemplate | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(quickReplyTemplates)
      .where(eq(quickReplyTemplates.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[master-quick-replies.getQuickReplyById] 실패:', err);
    return null;
  }
}

export type QuickReplyWriteInput = {
  title: string;
  content: string;
  category?: string | null;
  sortOrder?: number;
};

export async function createQuickReply(
  input: QuickReplyWriteInput,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const row: NewQuickReplyTemplate = {
      title: input.title,
      content: input.content,
      category: input.category ?? null,
      sortOrder: input.sortOrder ?? 0,
    };
    const [created] = await db
      .insert(quickReplyTemplates)
      .values(row)
      .returning({ id: quickReplyTemplates.id });
    return { ok: true, id: created?.id };
  } catch (err) {
    console.error('[master-quick-replies.createQuickReply] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function updateQuickReply(
  id: string,
  input: Partial<QuickReplyWriteInput>,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(quickReplyTemplates)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.sortOrder !== undefined
          ? { sortOrder: input.sortOrder }
          : {}),
      })
      .where(eq(quickReplyTemplates.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[master-quick-replies.updateQuickReply] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function setQuickReplyActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(quickReplyTemplates)
      .set({ isActive })
      .where(eq(quickReplyTemplates.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[master-quick-replies.setQuickReplyActive] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}
