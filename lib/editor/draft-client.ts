'use client';

/**
 * RichEditor draft 관리 client helper.
 *
 * 부모 페이지(notice/article/faq/checklist-step/quick-reply/ticket-message 등)에서
 * 본 DB 발행 성공 후 draft 자동 삭제용으로 호출.
 *
 * 정책:
 *   - targetId 있음 (편집 모드): 정확한 draftKey 'scope:uuid'로 즉시 삭제
 *   - targetId 없음 (신규 작성): draftKey가 nonce 기반이라 외부에서 모름. skip (30일 cron 자동 정리)
 *   - 실패해도 throw 안 함 (best effort, 발행 흐름 방해 X)
 */

import { makeDraftKey, type DraftScope } from './draft-key';

const LOCAL_STORAGE_PREFIX = 'editor-draft:';

export async function deleteDraftAfterPublish(
  scope: DraftScope,
  targetId: string | null,
): Promise<void> {
  if (!targetId) return; // 신규 작성은 nonce 모름 → 자연 만료
  let key: string;
  try {
    key = makeDraftKey(scope, targetId);
  } catch {
    return;
  }
  // localStorage 정리
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${key}`);
    } catch {
      /* noop */
    }
  }
  // 서버 draft 삭제
  try {
    await fetch(`/api/drafts?key=${encodeURIComponent(key)}`, {
      method: 'DELETE',
      cache: 'no-store',
    });
  } catch {
    /* noop — 30일 cron으로 정리됨 */
  }
}
