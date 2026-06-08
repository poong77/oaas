/**
 * 마스터 — hotelier_templates.
 * 호텔리어 접수폼 '자세한 내용' 위 버튼으로 본문에 끼워넣는 정형 입력 양식.
 */

import 'server-only';
import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import {
  hotelierTemplates,
  type NewHotelierTemplate,
  type HotelierTemplate,
} from '@/db/schema';

export async function listHotelierTemplates(
  includeInactive = false,
): Promise<HotelierTemplate[]> {
  if (!db) return [];
  try {
    const conditions = [];
    if (!includeInactive)
      conditions.push(eq(hotelierTemplates.isActive, true));
    const where = conditions.length === 0 ? undefined : and(...conditions);
    return await db
      .select()
      .from(hotelierTemplates)
      .where(where)
      .orderBy(
        asc(hotelierTemplates.sortOrder),
        asc(hotelierTemplates.title),
      );
  } catch (err) {
    console.error('[master-hotelier-templates.listHotelierTemplates] 실패:', err);
    return [];
  }
}

export async function getHotelierTemplateById(
  id: string,
): Promise<HotelierTemplate | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(hotelierTemplates)
      .where(eq(hotelierTemplates.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[master-hotelier-templates.getHotelierTemplateById] 실패:', err);
    return null;
  }
}

export type HotelierTemplateWriteInput = {
  title: string;
  content: string;
  category?: string | null;
  sortOrder?: number;
};

export async function createHotelierTemplate(
  input: HotelierTemplateWriteInput,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const row: NewHotelierTemplate = {
      title: input.title,
      content: input.content,
      category: input.category ?? null,
      sortOrder: input.sortOrder ?? 0,
    };
    const [created] = await db
      .insert(hotelierTemplates)
      .values(row)
      .returning({ id: hotelierTemplates.id });
    return { ok: true, id: created?.id };
  } catch (err) {
    console.error('[master-hotelier-templates.createHotelierTemplate] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function updateHotelierTemplate(
  id: string,
  input: Partial<HotelierTemplateWriteInput>,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(hotelierTemplates)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.sortOrder !== undefined
          ? { sortOrder: input.sortOrder }
          : {}),
      })
      .where(eq(hotelierTemplates.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[master-hotelier-templates.updateHotelierTemplate] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function setHotelierTemplateActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(hotelierTemplates)
      .set({ isActive })
      .where(eq(hotelierTemplates.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[master-hotelier-templates.setHotelierTemplateActive] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}
