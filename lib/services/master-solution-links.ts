/**
 * 마스터 — solution_link_presets (Phase 9).
 *
 * 호텔 프로필에서 사용자가 솔루션 링크 추가 시 보여지는 프리셋 목록.
 * 기존 테이블은 Phase 1에 정의됨 (db/schema/solution-links.ts).
 */

import 'server-only';
import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import {
  solutionLinkPresets,
  type NewSolutionLinkPreset,
  type SolutionLinkPreset,
} from '@/db/schema';

export async function listSolutionLinkPresets(
  includeInactive = false,
): Promise<SolutionLinkPreset[]> {
  if (!db) return [];
  try {
    const conditions = [];
    if (!includeInactive)
      conditions.push(eq(solutionLinkPresets.isActive, true));
    const where = conditions.length === 0 ? undefined : and(...conditions);
    return await db
      .select()
      .from(solutionLinkPresets)
      .where(where)
      .orderBy(
        asc(solutionLinkPresets.sortOrder),
        asc(solutionLinkPresets.label),
      );
  } catch (err) {
    console.error(
      '[master-solution-links.listSolutionLinkPresets] 실패:',
      err,
    );
    return [];
  }
}

export async function getSolutionLinkPresetById(
  id: string,
): Promise<SolutionLinkPreset | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(solutionLinkPresets)
      .where(eq(solutionLinkPresets.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error(
      '[master-solution-links.getSolutionLinkPresetById] 실패:',
      err,
    );
    return null;
  }
}

export type SolutionLinkPresetWriteInput = {
  label: string;
  defaultUrlTemplate?: string | null;
  icon?: string | null;
  sortOrder?: number;
};

export async function createSolutionLinkPreset(
  input: SolutionLinkPresetWriteInput,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const row: NewSolutionLinkPreset = {
      label: input.label,
      defaultUrlTemplate: input.defaultUrlTemplate ?? null,
      icon: input.icon ?? null,
      sortOrder: input.sortOrder ?? 0,
    };
    const [created] = await db
      .insert(solutionLinkPresets)
      .values(row)
      .returning({ id: solutionLinkPresets.id });
    return { ok: true, id: created?.id };
  } catch (err) {
    console.error(
      '[master-solution-links.createSolutionLinkPreset] 실패:',
      err,
    );
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function updateSolutionLinkPreset(
  id: string,
  input: Partial<SolutionLinkPresetWriteInput>,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(solutionLinkPresets)
      .set({
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.defaultUrlTemplate !== undefined
          ? { defaultUrlTemplate: input.defaultUrlTemplate }
          : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.sortOrder !== undefined
          ? { sortOrder: input.sortOrder }
          : {}),
      })
      .where(eq(solutionLinkPresets.id, id));
    return { ok: true };
  } catch (err) {
    console.error(
      '[master-solution-links.updateSolutionLinkPreset] 실패:',
      err,
    );
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function setSolutionLinkPresetActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(solutionLinkPresets)
      .set({ isActive })
      .where(eq(solutionLinkPresets.id, id));
    return { ok: true };
  } catch (err) {
    console.error(
      '[master-solution-links.setSolutionLinkPresetActive] 실패:',
      err,
    );
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}
