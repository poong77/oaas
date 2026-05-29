'use client';

/**
 * Draft 복구 다이얼로그.
 *
 * - 페이지 진입 시 RichEditor가 자동저장된 draft를 발견 → 본 모달 노출
 * - 사용자 선택: 복구 (본문에 적용) / 폐기 (draft 삭제)
 */

import { Clock, RotateCcw, Trash2, X } from 'lucide-react';

interface DraftRestoreDialogProps {
  open: boolean;
  /** 작성 시각 */
  updatedAt: Date | null;
  /** draft 본문 미리보기 (앞 200자) */
  preview: string;
  onRestore: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

function formatRelativeTime(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}초 전`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

export function DraftRestoreDialog({
  open,
  updatedAt,
  preview,
  onRestore,
  onDiscard,
  onClose,
}: DraftRestoreDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="작성 중 내용 복구"
        className="relative w-full max-w-md rounded-md border border-amber-300 bg-white p-5 shadow-xl dark:border-amber-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-3 flex items-start gap-2">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              💾 작성 중인 내용이 있습니다
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {updatedAt ? `마지막 자동저장: ${formatRelativeTime(updatedAt)}` : '자동저장본 발견'}
            </p>
          </div>
        </div>

        <div className="mb-4 max-h-48 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <pre className="whitespace-pre-wrap break-words font-sans">
            {preview.length > 200 ? `${preview.slice(0, 200)}...` : preview || '(빈 본문)'}
          </pre>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onDiscard}
            className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            폐기
          </button>
          <button
            type="button"
            onClick={onRestore}
            className="inline-flex items-center gap-1.5 rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 dark:bg-amber-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            복구하기
          </button>
        </div>
      </div>
    </div>
  );
}
