/**
 * checklists / checklist_steps 데이터 액세스 — Phase 4 SF-02, SF-04.
 *
 * 운영 패턴:
 *   - 진행 시 카운터 업데이트:
 *       view_count       — 진입 시 fire-and-forget
 *       resolved_count   — "🎉 해결됨" 결과 도달 시
 *       escalated_count  — "이슈 접수" 분기 도달 시
 *   - 단계는 step_no 오름차순.
 *   - 단계 비활성은 is_active=false (물리 삭제 금지). 진행 시 비활성 단계는 다음으로 자동 skip.
 *   - 단계 순서 이동은 인접 활성 단계와 step_no swap.
 */

import 'server-only';
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

import { db } from '@/db';
import {
  checklistSteps,
  checklists,
  type Checklist,
  type ChecklistStep,
  type ChecklistStepAction,
  type NewChecklist,
  type NewChecklistStep,
} from '@/db/schema';

export type ChecklistListItem = Pick<
  Checklist,
  | 'id'
  | 'productCode'
  | 'issueType'
  | 'title'
  | 'description'
  | 'sortOrder'
  | 'viewCount'
  | 'resolvedCount'
  | 'escalatedCount'
  | 'isActive'
  | 'createdAt'
  | 'updatedAt'
> & {
  stepCount: number;
};

export type ListChecklistsParams = {
  productCode?: string;
  issueType?: string;
  q?: string;
  isActive?: boolean | 'all';
  sortBy?: 'sort_order' | 'view_count' | 'resolved' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
};

export type ListChecklistsResult = {
  items: ChecklistListItem[];
  total: number;
  page: number;
  pageSize: number;
};

// ─────────────────────────────────────────────────────────────────────
// 조회
// ─────────────────────────────────────────────────────────────────────

export async function listChecklists(
  params: ListChecklistsParams = {},
): Promise<ListChecklistsResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  if (!db) return { items: [], total: 0, page, pageSize };

  const conditions: SQL[] = [];
  if (params.isActive !== 'all') {
    conditions.push(eq(checklists.isActive, params.isActive ?? true));
  }
  if (params.productCode) {
    conditions.push(eq(checklists.productCode, params.productCode));
  }
  if (params.issueType) {
    conditions.push(eq(checklists.issueType, params.issueType));
  }
  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    const search = or(
      ilike(checklists.title, pattern),
      ilike(checklists.description, pattern),
    );
    if (search) conditions.push(search);
  }

  const whereExpr =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

  const sortColumn =
    params.sortBy === 'view_count'
      ? checklists.viewCount
      : params.sortBy === 'resolved'
        ? checklists.resolvedCount
        : params.sortBy === 'updated_at'
          ? checklists.updatedAt
          : checklists.sortOrder;
  const orderExpr =
    (params.sortOrder ??
      (params.sortBy === 'sort_order' || !params.sortBy ? 'asc' : 'desc')) ===
    'asc'
      ? asc(sortColumn)
      : desc(sortColumn);

  try {
    const items = await db
      .select({
        id: checklists.id,
        productCode: checklists.productCode,
        issueType: checklists.issueType,
        title: checklists.title,
        description: checklists.description,
        sortOrder: checklists.sortOrder,
        viewCount: checklists.viewCount,
        resolvedCount: checklists.resolvedCount,
        escalatedCount: checklists.escalatedCount,
        isActive: checklists.isActive,
        createdAt: checklists.createdAt,
        updatedAt: checklists.updatedAt,
      })
      .from(checklists)
      .where(whereExpr)
      .orderBy(orderExpr, desc(checklists.createdAt))
      .limit(pageSize)
      .offset(offset);

    // 단계 카운트 일괄 조회 (활성만)
    const ids = items.map((c) => c.id);
    const stepCounts: Record<string, number> = {};
    if (ids.length > 0) {
      const rows = await db
        .select({
          checklistId: checklistSteps.checklistId,
          count: sql<number>`count(*)::int`,
        })
        .from(checklistSteps)
        .where(
          and(
            eq(checklistSteps.isActive, true),
            inArray(checklistSteps.checklistId, ids),
          ),
        )
        .groupBy(checklistSteps.checklistId);
      for (const r of rows) stepCounts[r.checklistId] = Number(r.count);
    }

    const totalRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(checklists)
      .where(whereExpr);
    const total = Number(totalRows[0]?.count ?? 0);

    return {
      items: items.map((it) => ({ ...it, stepCount: stepCounts[it.id] ?? 0 })),
      total,
      page,
      pageSize,
    };
  } catch (err) {
    console.error('[checklists.listChecklists] 실패:', err);
    return { items: [], total: 0, page, pageSize };
  }
}

export type ChecklistWithSteps = Checklist & { steps: ChecklistStep[] };

/**
 * id로 조회 + 활성 단계 step_no 오름차순.
 *
 * @param includeInactiveSteps 어드민 편집 시 true. 기본 false.
 */
export async function getChecklistWithSteps(
  id: string,
  options: { includeInactiveSteps?: boolean; includeInactive?: boolean } = {},
): Promise<ChecklistWithSteps | null> {
  if (!db) return null;
  try {
    const conditions: SQL[] = [eq(checklists.id, id)];
    if (!options.includeInactive) {
      conditions.push(eq(checklists.isActive, true));
    }
    const rows = await db
      .select()
      .from(checklists)
      .where(and(...conditions))
      .limit(1);
    const c = rows[0];
    if (!c) return null;

    const stepConditions: SQL[] = [eq(checklistSteps.checklistId, id)];
    if (!options.includeInactiveSteps) {
      stepConditions.push(eq(checklistSteps.isActive, true));
    }
    const steps = await db
      .select()
      .from(checklistSteps)
      .where(and(...stepConditions))
      .orderBy(asc(checklistSteps.stepNo));

    return { ...c, steps };
  } catch (err) {
    console.error('[checklists.getChecklistWithSteps] 실패:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 카운터
// ─────────────────────────────────────────────────────────────────────

export function incrementChecklistView(id: string): void {
  if (!db) return;
  Promise.resolve()
    .then(async () => {
      await db!
        .update(checklists)
        .set({ viewCount: sql`${checklists.viewCount} + 1` })
        .where(eq(checklists.id, id));
    })
    .catch((err) => {
      console.warn(
        `[checklists.incrementChecklistView] id=${id} 실패:`,
        err instanceof Error ? err.message : err,
      );
    });
}

export async function incrementChecklistResolved(
  id: string,
): Promise<{ ok: boolean }> {
  if (!db) return { ok: false };
  try {
    await db
      .update(checklists)
      .set({ resolvedCount: sql`${checklists.resolvedCount} + 1` })
      .where(eq(checklists.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[checklists.incrementChecklistResolved] 실패:', err);
    return { ok: false };
  }
}

export async function incrementChecklistEscalated(
  id: string,
): Promise<{ ok: boolean }> {
  if (!db) return { ok: false };
  try {
    await db
      .update(checklists)
      .set({ escalatedCount: sql`${checklists.escalatedCount} + 1` })
      .where(eq(checklists.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[checklists.incrementChecklistEscalated] 실패:', err);
    return { ok: false };
  }
}

// ─────────────────────────────────────────────────────────────────────
// 어드민 CRUD - 체크리스트
// ─────────────────────────────────────────────────────────────────────

export type ChecklistWriteInput = {
  productCode: string;
  issueType?: string | null;
  title: string;
  description?: string | null;
  sortOrder?: number;
};

export async function createChecklist(
  input: ChecklistWriteInput,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const row: NewChecklist = {
      productCode: input.productCode,
      issueType: input.issueType ?? null,
      title: input.title,
      description: input.description ?? null,
      sortOrder: input.sortOrder ?? 0,
    };
    const [created] = await db
      .insert(checklists)
      .values(row)
      .returning({ id: checklists.id });
    return { ok: true, id: created?.id };
  } catch (err) {
    console.error('[checklists.createChecklist] 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

export async function updateChecklistById(
  id: string,
  input: ChecklistWriteInput,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(checklists)
      .set({
        productCode: input.productCode,
        issueType: input.issueType ?? null,
        title: input.title,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
      })
      .where(eq(checklists.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[checklists.updateChecklistById] 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

export async function archiveChecklistById(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(checklists)
      .set({ isActive: false })
      .where(eq(checklists.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[checklists.archiveChecklistById] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function restoreChecklistById(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(checklists)
      .set({ isActive: true })
      .where(eq(checklists.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[checklists.restoreChecklistById] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

// ─────────────────────────────────────────────────────────────────────
// 어드민 CRUD - 단계
// ─────────────────────────────────────────────────────────────────────

export type StepWriteInput = {
  title: string;
  bodyMarkdown?: string | null;
  conditionYesAction: ChecklistStepAction;
  conditionNoAction: ChecklistStepAction;
  yesLabel?: string;
  noLabel?: string;
};

/**
 * 단계 추가 (step_no 자동 할당 = max(step_no)+1).
 */
export async function createStep(
  checklistId: string,
  input: StepWriteInput,
): Promise<{ ok: boolean; id?: string; stepNo?: number; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const maxRow = await db
      .select({ max: sql<number>`coalesce(max(${checklistSteps.stepNo}), 0)::int` })
      .from(checklistSteps)
      .where(eq(checklistSteps.checklistId, checklistId));
    const nextStepNo = Number(maxRow[0]?.max ?? 0) + 1;

    const row: NewChecklistStep = {
      checklistId,
      stepNo: nextStepNo,
      title: input.title,
      bodyMarkdown: input.bodyMarkdown ?? null,
      conditionYesAction: input.conditionYesAction,
      conditionNoAction: input.conditionNoAction,
      yesLabel: input.yesLabel || '예',
      noLabel: input.noLabel || '아니오',
    };
    const [created] = await db
      .insert(checklistSteps)
      .values(row)
      .returning({ id: checklistSteps.id });
    return { ok: true, id: created?.id, stepNo: nextStepNo };
  } catch (err) {
    console.error('[checklists.createStep] 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

export async function updateStepById(
  stepId: string,
  input: StepWriteInput,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(checklistSteps)
      .set({
        title: input.title,
        bodyMarkdown: input.bodyMarkdown ?? null,
        conditionYesAction: input.conditionYesAction,
        conditionNoAction: input.conditionNoAction,
        yesLabel: input.yesLabel || '예',
        noLabel: input.noLabel || '아니오',
      })
      .where(eq(checklistSteps.id, stepId));
    return { ok: true };
  } catch (err) {
    console.error('[checklists.updateStepById] 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

/** 단계 비활성. 물리 삭제 금지. */
export async function archiveStepById(
  stepId: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(checklistSteps)
      .set({ isActive: false })
      .where(eq(checklistSteps.id, stepId));
    return { ok: true };
  } catch (err) {
    console.error('[checklists.archiveStepById] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function restoreStepById(
  stepId: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(checklistSteps)
      .set({ isActive: true })
      .where(eq(checklistSteps.id, stepId));
    return { ok: true };
  } catch (err) {
    console.error('[checklists.restoreStepById] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

/**
 * 단계 step_no 인접 swap (활성 단계 기준).
 * unique 제약을 위해 임시 step_no (-1 곱) 트릭으로 두 row를 안전하게 교환.
 */
export async function moveStepOrder(
  stepId: string,
  direction: 'up' | 'down',
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const current = await db
      .select({
        id: checklistSteps.id,
        checklistId: checklistSteps.checklistId,
        stepNo: checklistSteps.stepNo,
      })
      .from(checklistSteps)
      .where(eq(checklistSteps.id, stepId))
      .limit(1);
    if (current.length === 0) return { ok: false, message: 'NOT_FOUND' };
    const me = current[0]!;

    const neighborCond =
      direction === 'up'
        ? sql`${checklistSteps.stepNo} < ${me.stepNo}`
        : sql`${checklistSteps.stepNo} > ${me.stepNo}`;
    const orderBy =
      direction === 'up' ? desc(checklistSteps.stepNo) : asc(checklistSteps.stepNo);
    const neighbors = await db
      .select({ id: checklistSteps.id, stepNo: checklistSteps.stepNo })
      .from(checklistSteps)
      .where(
        and(
          eq(checklistSteps.checklistId, me.checklistId),
          eq(checklistSteps.isActive, true),
          neighborCond,
        ),
      )
      .orderBy(orderBy)
      .limit(1);
    if (neighbors.length === 0) {
      return { ok: false, message: 'NO_NEIGHBOR' };
    }
    const neighbor = neighbors[0]!;

    // unique(checklist_id, step_no) 제약을 우회하려고 me를 음수 임시값으로 옮긴 뒤 swap
    const tempStep = -Math.abs(me.stepNo) - 100000;
    await db
      .update(checklistSteps)
      .set({ stepNo: tempStep })
      .where(eq(checklistSteps.id, me.id));
    await db
      .update(checklistSteps)
      .set({ stepNo: me.stepNo })
      .where(eq(checklistSteps.id, neighbor.id));
    await db
      .update(checklistSteps)
      .set({ stepNo: neighbor.stepNo })
      .where(eq(checklistSteps.id, me.id));

    return { ok: true };
  } catch (err) {
    console.error('[checklists.moveStepOrder] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}
