'use client';

import { cn } from '@/lib/utils';

export type SaveStatus =
  | 'idle' // 변경 없음 또는 저장 완료
  | 'saving' // 저장 중
  | 'saved' // 방금 저장됨
  | 'offline' // 네트워크 오류 — localStorage에만 보관
  | 'error'; // 서버 오류

interface SaveIndicatorProps {
  status: SaveStatus;
  /** 마지막 저장 시각 (ms epoch). status='saved' 또는 'idle'에서 "n초 전" 표시 */
  lastSavedAt?: number | null;
  className?: string;
}

function formatRelativeTime(ms: number): string {
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 5) return '방금 전';
  if (diffSec < 60) return `${diffSec}초 전`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return new Date(ms).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export function SaveIndicator({ status, lastSavedAt, className }: SaveIndicatorProps) {
  const baseClass = 'inline-flex items-center gap-1.5 text-xs';

  if (status === 'saving') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(baseClass, 'text-slate-500 dark:text-slate-400', className)}
      >
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-slate-400" />
        저장 중...
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(baseClass, 'text-amber-700 dark:text-amber-400', className)}
      >
        <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
        오프라인 — 로컬에 보관 중
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(baseClass, 'text-rose-700 dark:text-rose-400', className)}
      >
        <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
        저장 실패 — 다시 시도 중
      </div>
    );
  }

  if (status === 'saved' || (status === 'idle' && lastSavedAt)) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(baseClass, 'text-emerald-700 dark:text-emerald-400', className)}
      >
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        {lastSavedAt ? `저장됨 (${formatRelativeTime(lastSavedAt)})` : '저장됨'}
      </div>
    );
  }

  return (
    <div className={cn(baseClass, 'text-slate-400 dark:text-slate-500', className)}>
      <span className="inline-block h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" />
      미저장
    </div>
  );
}
