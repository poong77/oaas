/**
 * ai-reply-assist — AI 모델 마스터 서비스 (Server 전용).
 *
 * 모달/초안 액션이 쓰는 조회 + 어드민 CRUD. 모델을 코드에 하드코딩하지 않고
 * DB(ai_models)에서 읽는다. is_default=true는 0~1개로 유지(setDefault에서 강제).
 *
 * @see docs/02-design/features/ai-reply-assist.design.md §8
 */

import 'server-only';
import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { aiModels, type AiModel, type NewAiModel } from '@/db/schema';

/** 모달 노출용 — 활성 모델만, 정렬순. */
export async function listActiveModels(): Promise<AiModel[]> {
  if (!db) return [];
  return db
    .select()
    .from(aiModels)
    .where(eq(aiModels.isActive, true))
    .orderBy(asc(aiModels.sortOrder), asc(aiModels.createdAt));
}

/** 어드민 화면용 — 전체(비활성 포함). */
export async function listAllModels(): Promise<AiModel[]> {
  if (!db) return [];
  return db
    .select()
    .from(aiModels)
    .orderBy(asc(aiModels.sortOrder), asc(aiModels.createdAt));
}

/** 기본 모델 — is_default 우선, 없으면 첫 활성 모델. */
export async function getDefaultModel(): Promise<AiModel | null> {
  if (!db) return null;
  const [def] = await db
    .select()
    .from(aiModels)
    .where(and(eq(aiModels.isActive, true), eq(aiModels.isDefault, true)))
    .limit(1);
  if (def) return def;
  const [first] = await db
    .select()
    .from(aiModels)
    .where(eq(aiModels.isActive, true))
    .orderBy(asc(aiModels.sortOrder), asc(aiModels.createdAt))
    .limit(1);
  return first ?? null;
}

/** 초안 생성 시 모델 검증 — 활성 모델만 통과. */
export async function getActiveModelById(id: string): Promise<AiModel | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(aiModels)
    .where(and(eq(aiModels.id, id), eq(aiModels.isActive, true)))
    .limit(1);
  return row ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// 어드민 CRUD (admin 전용 — 액션에서 권한 검증)
// ─────────────────────────────────────────────────────────────────────

export async function createModel(input: NewAiModel): Promise<AiModel | null> {
  if (!db) return null;
  const [row] = await db.insert(aiModels).values(input).returning();
  if (input.isDefault && row) await setDefaultModel(row.id);
  return row ?? null;
}

export async function updateModel(
  id: string,
  patch: Partial<Omit<NewAiModel, 'id'>>,
): Promise<void> {
  if (!db) return;
  await db
    .update(aiModels)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(aiModels.id, id));
  if (patch.isDefault === true) await setDefaultModel(id);
}

export async function toggleModelActive(
  id: string,
  isActive: boolean,
): Promise<void> {
  if (!db) return;
  await db
    .update(aiModels)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(aiModels.id, id));
}

/** 기본 모델 지정 — 기존 default 모두 해제 후 대상만 true (0~1개 보장). */
export async function setDefaultModel(id: string): Promise<void> {
  if (!db) return;
  await db
    .update(aiModels)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(aiModels.isDefault, true));
  await db
    .update(aiModels)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(eq(aiModels.id, id));
}

export async function reorderModels(
  order: { id: string; sortOrder: number }[],
): Promise<void> {
  if (!db) return;
  for (const o of order) {
    await db
      .update(aiModels)
      .set({ sortOrder: o.sortOrder, updatedAt: new Date() })
      .where(eq(aiModels.id, o.id));
  }
}
