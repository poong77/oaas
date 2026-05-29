/**
 * `/api/drafts` — RichEditor 자동 저장 draft CRUD.
 *
 * 요청:
 *   - GET    ?key=<draftKey>                          → 본인 draft 조회 (없으면 null)
 *   - PUT    body { scope, targetId?, draftKey, contentMarkdown, metadata? } → upsert
 *   - DELETE ?key=<draftKey>                          → 본인 draft 비활성
 *
 * 응답:
 *   { ok: true, data?: { contentMarkdown, metadata, updatedAt } | null }
 *   { ok: false, message }
 *
 * 보안:
 *   - 로그인 필수
 *   - 소유자(userId)만 접근. draftKey 위조해도 본인 외 draft 접근 불가.
 *   - Rate Limit: PUT 분당 60회 / GET 분당 120회 / DELETE 분당 30회 (사용자별)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { draftScopeSchema, parseDraftKey } from '@/lib/editor/draft-key';
import {
  deleteDraft,
  getDraftByKey,
  upsertDraft,
} from '@/lib/services/editor-drafts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const putBodySchema = z.object({
  scope: draftScopeSchema,
  targetId: z.string().uuid().nullable().optional(),
  draftKey: z.string().min(3).max(200),
  contentMarkdown: z.string().max(500_000),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: '로그인이 필요합니다' },
      { status: 401 },
    );
  }

  const rl = checkRateLimit(`draft-get:${user.id}`, 120);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, message: `요청이 너무 많습니다. ${rl.retryAfter}초 후 재시도` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  const key = request.nextUrl.searchParams.get('key');
  if (!key || !parseDraftKey(key)) {
    return NextResponse.json(
      { ok: false, message: '유효하지 않은 draftKey' },
      { status: 400 },
    );
  }

  try {
    const draft = await getDraftByKey(user.id, key);
    if (!draft) {
      return NextResponse.json({ ok: true, data: null });
    }
    return NextResponse.json({
      ok: true,
      data: {
        contentMarkdown: draft.contentMarkdown,
        metadata: parseMetadata(draft.metadata),
        updatedAt: draft.updatedAt,
      },
    });
  } catch (err) {
    console.error('[api/drafts][GET]', err);
    return NextResponse.json(
      { ok: false, message: 'draft 조회 중 오류' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: '로그인이 필요합니다' },
      { status: 401 },
    );
  }

  const rl = checkRateLimit(`draft-put:${user.id}`, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, message: `자동 저장 빈도 제한 초과 (${rl.retryAfter}초 후 재시도)` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: '잘못된 JSON' },
      { status: 400 },
    );
  }

  const parsed = putBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: '입력 검증 실패',
        details: parsed.error.flatten(),
      },
      { status: 422 },
    );
  }

  try {
    const row = await upsertDraft({
      userId: user.id,
      scope: parsed.data.scope,
      targetId: parsed.data.targetId ?? null,
      draftKey: parsed.data.draftKey,
      contentMarkdown: parsed.data.contentMarkdown,
      metadata: parsed.data.metadata ?? null,
    });
    return NextResponse.json({
      ok: true,
      data: {
        draftKey: row.draftKey,
        updatedAt: row.updatedAt,
      },
    });
  } catch (err) {
    console.error('[api/drafts][PUT]', err);
    const message =
      err instanceof Error ? err.message : 'draft 저장 중 오류';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: '로그인이 필요합니다' },
      { status: 401 },
    );
  }

  const rl = checkRateLimit(`draft-del:${user.id}`, 30);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, message: `삭제 빈도 제한 초과 (${rl.retryAfter}초 후 재시도)` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  const key = request.nextUrl.searchParams.get('key');
  if (!key || !parseDraftKey(key)) {
    return NextResponse.json(
      { ok: false, message: '유효하지 않은 draftKey' },
      { status: 400 },
    );
  }

  try {
    await deleteDraft(user.id, key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/drafts][DELETE]', err);
    return NextResponse.json(
      { ok: false, message: 'draft 삭제 중 오류' },
      { status: 500 },
    );
  }
}
