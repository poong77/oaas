'use client';

import { useEffect, useRef, useState } from 'react';
import {
  generateDraftNonce,
  makeDraftKey,
  type DraftScope,
} from '@/lib/editor/draft-key';
import type { SaveStatus } from '../panels/save-indicator';

export interface AutoSaveConfig {
  scope: DraftScope;
  targetId: string | null;
  /** 신규 작성 시 nonce. 첫 진입 시 generateDraftNonce()로 만들어 부모가 유지. */
  nonce?: string;
  /** localStorage 디바운스(ms). 기본 2000 */
  localDebounceMs?: number;
  /** 서버 PUT 디바운스(ms). 기본 30000 */
  serverDebounceMs?: number;
  /** 메타데이터 (title 등) — 함께 저장 */
  metadata?: Record<string, unknown> | null;
}

const LOCAL_STORAGE_PREFIX = 'editor-draft:';

interface UseAutoSaveReturn {
  status: SaveStatus;
  lastSavedAt: number | null;
  draftKey: string | null;
  /** localStorage에 저장된 이전 draft 복구 (마운트 시 호출용) */
  restoreFromLocal: () => string | null;
  /** 서버 /api/drafts에서 본인 draft 조회 (없으면 null) */
  fetchFromServer: () => Promise<{ content: string; updatedAt: Date } | null>;
  /** 명시적 즉시 저장 (Cmd+S 등) */
  flushNow: () => Promise<void>;
  /** 발행 성공 후 호출 — localStorage + 서버 draft 모두 삭제 */
  clearDraft: () => Promise<void>;
}

/**
 * 자동 저장 hook.
 *
 * 동작:
 *   - value 변경 → 2초 후 localStorage에 저장 (offline 대비)
 *   - value 변경 → 30초 후 서버 /api/drafts PUT
 *   - flushNow() 호출 시 즉시 양쪽 저장
 *
 * 사용:
 *   const { status, lastSavedAt, restoreFromLocal, flushNow } = useAutoSave(
 *     { scope: 'article', targetId: '...' }, value, metadata,
 *   );
 */
export function useAutoSave(
  config: AutoSaveConfig | undefined,
  value: string,
): UseAutoSaveReturn {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const nonceRef = useRef<string | null>(null);
  const localTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef<string>(value);

  // nonce: 신규 작성 시 한 번만 생성
  if (config && !config.targetId && !nonceRef.current) {
    nonceRef.current = config.nonce ?? generateDraftNonce();
  }

  const draftKey = (() => {
    if (!config) return null;
    try {
      return makeDraftKey(
        config.scope,
        config.targetId,
        config.targetId ? undefined : (nonceRef.current ?? undefined),
      );
    } catch {
      return null;
    }
  })();

  // 최신 value 추적
  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  // localStorage debounce
  useEffect(() => {
    if (!config || !draftKey) return;

    if (localTimerRef.current) clearTimeout(localTimerRef.current);
    localTimerRef.current = setTimeout(() => {
      try {
        if (typeof window === 'undefined') return;
        localStorage.setItem(
          `${LOCAL_STORAGE_PREFIX}${draftKey}`,
          JSON.stringify({
            content: latestValueRef.current,
            metadata: config.metadata ?? null,
            updatedAt: Date.now(),
          }),
        );
      } catch {
        // localStorage 쿼터 초과 등 — 무시
      }
    }, config.localDebounceMs ?? 2000);

    return () => {
      if (localTimerRef.current) clearTimeout(localTimerRef.current);
    };
  }, [config, draftKey, value]);

  // 서버 PUT debounce
  useEffect(() => {
    if (!config || !draftKey) return;

    if (serverTimerRef.current) clearTimeout(serverTimerRef.current);
    serverTimerRef.current = setTimeout(async () => {
      await sendToServer(config, draftKey, latestValueRef.current, setStatus, setLastSavedAt);
    }, config.serverDebounceMs ?? 30_000);

    return () => {
      if (serverTimerRef.current) clearTimeout(serverTimerRef.current);
    };
  }, [config, draftKey, value]);

  const restoreFromLocal = (): string | null => {
    if (!draftKey || typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${draftKey}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { content?: string };
      return parsed.content ?? null;
    } catch {
      return null;
    }
  };

  const fetchFromServer = async (): Promise<
    { content: string; updatedAt: Date } | null
  > => {
    if (!draftKey) return null;
    try {
      const res = await fetch(`/api/drafts?key=${encodeURIComponent(draftKey)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        ok: boolean;
        data?: { contentMarkdown: string; updatedAt: string };
      };
      if (!json.ok || !json.data) return null;
      return {
        content: json.data.contentMarkdown,
        updatedAt: new Date(json.data.updatedAt),
      };
    } catch {
      return null;
    }
  };

  const clearDraft = async () => {
    if (!draftKey) return;
    if (localTimerRef.current) clearTimeout(localTimerRef.current);
    if (serverTimerRef.current) clearTimeout(serverTimerRef.current);
    // localStorage 제거
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${draftKey}`);
      } catch {
        /* noop */
      }
    }
    // 서버 draft 삭제
    try {
      await fetch(`/api/drafts?key=${encodeURIComponent(draftKey)}`, {
        method: 'DELETE',
      });
    } catch {
      /* noop — 30일 cron으로 정리됨 */
    }
    setStatus('idle');
    setLastSavedAt(null);
  };

  const flushNow = async () => {
    if (!config || !draftKey) return;
    if (localTimerRef.current) clearTimeout(localTimerRef.current);
    if (serverTimerRef.current) clearTimeout(serverTimerRef.current);
    // localStorage 즉시
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          `${LOCAL_STORAGE_PREFIX}${draftKey}`,
          JSON.stringify({
            content: latestValueRef.current,
            metadata: config.metadata ?? null,
            updatedAt: Date.now(),
          }),
        );
      }
    } catch {
      /* noop */
    }
    await sendToServer(config, draftKey, latestValueRef.current, setStatus, setLastSavedAt);
  };

  return {
    status,
    lastSavedAt,
    draftKey,
    restoreFromLocal,
    fetchFromServer,
    flushNow,
    clearDraft,
  };
}

async function sendToServer(
  config: AutoSaveConfig,
  draftKey: string,
  content: string,
  setStatus: (s: SaveStatus) => void,
  setLastSavedAt: (n: number) => void,
): Promise<void> {
  setStatus('saving');
  try {
    const res = await fetch('/api/drafts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: config.scope,
        targetId: config.targetId,
        draftKey,
        contentMarkdown: content,
        metadata: config.metadata ?? undefined,
      }),
    });
    if (!res.ok) {
      if (res.status === 429) {
        setStatus('offline'); // rate limited → 다음 debounce 사이클로
      } else {
        setStatus('error');
      }
      return;
    }
    setStatus('saved');
    setLastSavedAt(Date.now());
  } catch {
    setStatus('offline');
  }
}
