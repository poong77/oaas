/**
 * `editor_drafts` 서비스 — RichEditor 자동 저장.
 *
 * 소유자(userId)만 read/write/delete 가능. 호출자가 인증·권한 1차 검증 후 호출.
 *
 * 동작:
 *   - upsertDraft: (userId, draftKey)가 같으면 update, 없으면 insert
 *   - getDraftByKey: 본인 draft 조회 (없으면 null)
 *   - deleteDraft: 본인 draft 비활성 (soft delete, is_active=false)
 *   - cleanupOldDrafts: 30일 경과 draft 일괄 비활성 (cron 후속 진입)
 */

import 'server-only';
import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { editorDrafts, type EditorDraft } from '@/db/schema';
import { parseDraftKey, type DraftScope } from '@/lib/editor/draft-key';

const MAX_CONTENT_BYTES = 500_000; // 500KB. 너무 큰 본문은 일반적이지 않음.

function requireDb() {
  if (!db) {
    throw new Error('DATABASE_URL이 설정되지 않았습니다');
  }
  return db;
}

export interface UpsertDraftInput {
  userId: string;
  scope: DraftScope;
  targetId: string | null;
  draftKey: string;
  contentMarkdown: string;
  metadata?: Record<string, unknown> | null;
}

/** 본인 draft upsert. (userId, draftKey) 유니크 인덱스 활용. */
export async function upsertDraft(input: UpsertDraftInput): Promise<EditorDraft> {
  const { userId, scope, targetId, draftKey, contentMarkdown, metadata } = input;

  // draftKey 형식 검증 (scope/targetId 일치 확인)
  const parsed = parseDraftKey(draftKey);
  if (!parsed || parsed.scope !== scope) {
    throw new Error('Invalid draftKey or scope mismatch');
  }
  if (parsed.targetId !== (targetId ?? null)) {
    throw new Error('draftKey targetId does not match');
  }

  if (Buffer.byteLength(contentMarkdown, 'utf8') > MAX_CONTENT_BYTES) {
    throw new Error(`Draft content too large (>${MAX_CONTENT_BYTES} bytes)`);
  }

  const dbi = requireDb();
  const serializedMetadata = metadata != null ? JSON.stringify(metadata) : null;

  const [row] = await dbi
    .insert(editorDrafts)
    .values({
      userId,
      scope,
      targetId,
      draftKey,
      contentMarkdown,
      metadata: serializedMetadata,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [editorDrafts.userId, editorDrafts.draftKey],
      set: {
        contentMarkdown,
        metadata: serializedMetadata,
        isActive: true,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

/** 본인 draft 조회 (없으면 null). is_active=false는 미반환. */
export async function getDraftByKey(
  userId: string,
  draftKey: string,
): Promise<EditorDraft | null> {
  const dbi = requireDb();
  const rows = await dbi
    .select()
    .from(editorDrafts)
    .where(
      and(
        eq(editorDrafts.userId, userId),
        eq(editorDrafts.draftKey, draftKey),
        eq(editorDrafts.isActive, true),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** 본인 draft 비활성 (soft delete). */
export async function deleteDraft(userId: string, draftKey: string): Promise<void> {
  const dbi = requireDb();
  await dbi
    .update(editorDrafts)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(eq(editorDrafts.userId, userId), eq(editorDrafts.draftKey, draftKey)),
    );
}

/** 본인 활성 draft 목록 (옵션 — UI에서 미사용 시 noop). */
export async function listMyDrafts(userId: string): Promise<EditorDraft[]> {
  const dbi = requireDb();
  return dbi
    .select()
    .from(editorDrafts)
    .where(and(eq(editorDrafts.userId, userId), eq(editorDrafts.isActive, true)))
    .orderBy(sql`${editorDrafts.updatedAt} DESC`);
}

/** 오래된 draft 비활성 (cron 후속 진입). */
export async function cleanupOldDrafts(olderThanDays = 30): Promise<number> {
  const dbi = requireDb();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await dbi
    .update(editorDrafts)
    .set({ isActive: false })
    .where(
      and(eq(editorDrafts.isActive, true), lt(editorDrafts.updatedAt, cutoff)),
    )
    .returning({ id: editorDrafts.id });
  return result.length;
}
