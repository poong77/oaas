'use client';

/**
 * RichEditor 링크 입력 모달.
 *
 * - URL + 표시 텍스트 입력
 * - 선택된 텍스트가 있으면 표시 텍스트로 prefill
 * - https 자동 prefix, mailto / tel 허용
 */

import { useEffect, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';

interface LinkInputDialogProps {
  open: boolean;
  onClose: () => void;
  /** 선택된 텍스트 (없으면 빈 문자열) */
  selectedText: string;
  /** 현재 활성 링크의 href (편집 시) */
  currentHref?: string | null;
  /** 적용 시 호출: (href, text) */
  onApply: (href: string, text: string) => void;
  /** 링크 제거 시 호출 (현재 활성 링크가 있을 때만 표시) */
  onRemove?: () => void;
}

function normalizeHref(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // 이미 스킴 있음
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  // 이메일
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return `mailto:${trimmed}`;
  // 전화번호 (숫자·+·-·공백)
  if (/^\+?[\d\s.-]+$/.test(trimmed)) return `tel:${trimmed.replace(/\s/g, '')}`;
  // 도메인 → https 자동
  return `https://${trimmed}`;
}

export function LinkInputDialog({
  open,
  onClose,
  selectedText,
  currentHref,
  onApply,
  onRemove,
}: LinkInputDialogProps) {
  const [href, setHref] = useState(currentHref ?? '');
  const [text, setText] = useState(selectedText);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setHref(currentHref ?? '');
      setText(selectedText);
      setError(null);
    }
  }, [open, currentHref, selectedText]);

  function handleApply() {
    const normalized = normalizeHref(href);
    if (!normalized) {
      setError('유효한 URL을 입력하세요');
      return;
    }
    onApply(normalized, text.trim());
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="링크 입력"
        className="relative w-full max-w-md rounded-md border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
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
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
          {currentHref ? '링크 편집' : '링크 삽입'}
        </h2>

        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
          URL
        </label>
        <input
          type="text"
          value={href}
          onChange={(e) => setHref(e.target.value)}
          placeholder="https://example.com 또는 example@email.com"
          autoFocus
          className="mb-3 block w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />

        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
          표시 텍스트 (선택)
        </label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="비워두면 URL이 그대로 표시"
          className="mb-3 block w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />

        {error && (
          <p className="mb-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div>
            {currentHref && onRemove && (
              <button
                type="button"
                onClick={() => {
                  onRemove();
                  onClose();
                }}
                className="rounded px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                링크 제거
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!href.trim()}
              className="inline-flex items-center gap-1.5 rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-700"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {currentHref ? '변경' : '삽입'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
