/**
 * Editor draft key 생성·검증 helper.
 *
 * draftKey 형식:
 *   - 기존 편집:  `{scope}:{targetUuid}`     예) "article:550e8400-e29b-41d4-a716-446655440000"
 *   - 신규 작성:  `{scope}:new:{nonce}`       예) "ticket-message:new:k9x2qf"
 *
 * 신규 작성 nonce는 클라이언트가 첫 진입 시 생성하여 페이지 라이프사이클 동안 유지.
 * 같은 페이지에서 작성 → 발행 → draft 자동 삭제. 페이지 이탈 후 재진입 시 동일 nonce로 복구.
 */

import { z } from 'zod';

export const DRAFT_SCOPES = [
  'article',
  'notice',
  'faq',
  'checklist-step',
  'quick-reply',
  'hotelier-template',
  'ticket-message',
  'system-setting',
] as const;

export type DraftScope = (typeof DRAFT_SCOPES)[number];

export const draftScopeSchema = z.enum(DRAFT_SCOPES);

/** UUID v4 형식 검증 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** nonce: 영문/숫자 6~24자 */
const NONCE_RE = /^[a-zA-Z0-9]{6,24}$/;

/**
 * draftKey 생성.
 * @param scope 적용 영역
 * @param targetId 기존 편집 시 PK (UUID). 신규 작성은 null/undefined
 * @param nonce 신규 작성 시 nonce (영문/숫자 6~24자)
 */
export function makeDraftKey(
  scope: DraftScope,
  targetId: string | null | undefined,
  nonce?: string,
): string {
  if (targetId) {
    if (!UUID_RE.test(targetId)) {
      throw new Error(`Invalid targetId UUID: ${targetId}`);
    }
    return `${scope}:${targetId}`;
  }
  if (!nonce || !NONCE_RE.test(nonce)) {
    throw new Error('Valid nonce (6~24 alphanumeric) required for new draft');
  }
  return `${scope}:new:${nonce}`;
}

/** draftKey 파싱. 형식 위반 시 null. */
export function parseDraftKey(
  key: string,
): { scope: DraftScope; targetId: string | null; nonce: string | null } | null {
  const parts = key.split(':');
  if (parts.length < 2 || parts.length > 3) return null;

  const scope = parts[0];
  if (!DRAFT_SCOPES.includes(scope as DraftScope)) return null;

  if (parts.length === 2) {
    const targetId = parts[1];
    if (!UUID_RE.test(targetId)) return null;
    return { scope: scope as DraftScope, targetId, nonce: null };
  }

  // parts.length === 3 → 'scope:new:nonce'
  if (parts[1] !== 'new') return null;
  const nonce = parts[2];
  if (!NONCE_RE.test(nonce)) return null;
  return { scope: scope as DraftScope, targetId: null, nonce };
}

/** 브라우저/Node에서 모두 동작하는 nonce 생성기 */
export function generateDraftNonce(): string {
  // crypto.getRandomValues는 브라우저·Node 양쪽 모두 지원
  const arr = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 8; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 12);
}
