'use client';

/**
 * useAutosaveStatus — 자동저장 상태 + ON/OFF 토글 (A8).
 *
 * 표시되는 상태:
 *   - 'idle'   : 변경 없음, 마지막 저장 시각만 표시
 *   - 'dirty'  : 변경됨, 저장 대기 중 (debounce 진행)
 *   - 'saving' : POST 진행 중
 *   - 'saved'  : 직전 저장 완료 (마지막 저장 시각 갱신)
 *   - 'error'  : 직전 저장 실패 (재시도 가능)
 *   - 'off'    : 자동저장 OFF (사용자 토글)
 *
 * 토글 상태는 localStorage에 매니저별로 저장 (`autosave-enabled-${userId}`).
 *
 * @see docs/02-design/knowledge-base-overhaul/PLAN.md §12-3
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

export type AutosaveStatus =
  | 'idle'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'error'
  | 'off';

export type UseAutosaveStatusResult = {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  enabled: boolean;
  toggleEnabled: () => void;
  /** 외부에서 상태 갱신 (RichEditor autoSave가 호출). */
  reportStatus: (next: Exclude<AutosaveStatus, 'off'>) => void;
};

const STORAGE_PREFIX = 'autosave-enabled';

function loadEnabled(userKey: string | null): boolean {
  if (typeof window === 'undefined') return true;
  if (!userKey) return true;
  const v = window.localStorage.getItem(`${STORAGE_PREFIX}-${userKey}`);
  if (v === null) return true; // 기본 ON
  return v === '1';
}

function persistEnabled(userKey: string | null, enabled: boolean): void {
  if (typeof window === 'undefined') return;
  if (!userKey) return;
  window.localStorage.setItem(
    `${STORAGE_PREFIX}-${userKey}`,
    enabled ? '1' : '0',
  );
}

/**
 * 자동저장 상태 + 토글 훅.
 *
 * @param userKey 매니저 식별자 (없으면 토글 비영속 — 일회성)
 *
 * @example
 * const { status, lastSavedAt, enabled, toggleEnabled, reportStatus } = useAutosaveStatus(currentUserId);
 *
 * // RichEditor autoSave 콜백에서 reportStatus('saving'), reportStatus('saved') 등 호출
 * // 사이드바에서 status / lastSavedAt 표시 + toggleEnabled 버튼
 */
export function useAutosaveStatus(
  userKey: string | null,
): UseAutosaveStatusResult {
  const [enabled, setEnabled] = useState<boolean>(() => loadEnabled(userKey));
  const [innerStatus, setInnerStatus] = useState<
    Exclude<AutosaveStatus, 'off'>
  >('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    setEnabled(loadEnabled(userKey));
  }, [userKey]);

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      persistEnabled(userKey, next);
      return next;
    });
  }, [userKey]);

  const reportStatus = useCallback(
    (next: Exclude<AutosaveStatus, 'off'>) => {
      setInnerStatus(next);
      if (next === 'saved') setLastSavedAt(new Date());
    },
    [],
  );

  const status: AutosaveStatus = enabled ? innerStatus : 'off';

  return useMemo(
    () => ({ status, lastSavedAt, enabled, toggleEnabled, reportStatus }),
    [status, lastSavedAt, enabled, toggleEnabled, reportStatus],
  );
}

/** 사람이 읽는 상대 시간 ("3초 전", "방금 전"). */
export function formatRelative(date: Date | null, now: Date = new Date()): string {
  if (!date) return '아직 저장되지 않음';
  const diff = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diff < 60) return '방금 전 저장됨';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전 저장됨`;
  return `${Math.floor(diff / 3600)}시간 전 저장됨`;
}
