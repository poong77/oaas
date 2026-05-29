'use client';

/**
 * 빠른답변 패널.
 *
 * - Cmd+/ 또는 톨바 트리거 → 모달 형태 패널
 * - GET /api/quick-replies (매니저+어드민)로 템플릿 fetch + in-memory cache
 * - 키워드 검색 (제목·내용·카테고리)
 * - ↑↓ 키보드 네비, Enter로 삽입
 * - 변수 치환 컨텍스트(`vars` prop) → `{{호텔명}}` 등 치환 후 삽입
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuickReplyItem {
  id: string;
  title: string;
  content: string;
  category: string | null;
  sortOrder: number;
}

export interface QuickReplyVars {
  hotelName?: string;
  hotelierName?: string;
  ticketNo?: string;
  managerName?: string;
}

interface QuickReplyPanelProps {
  open: boolean;
  onClose: () => void;
  /** 선택 시 호출 — 부모(RichEditor 외부)에서 editor에 insertContent 또는 append */
  onInsert: (content: string) => void;
  /** 변수 치환 컨텍스트 */
  vars?: QuickReplyVars;
}

let cachedItems: QuickReplyItem[] | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000; // 1분

function substituteVars(content: string, vars: QuickReplyVars | undefined): string {
  if (!vars) return content;
  return content
    .replace(/\{\{\s*호텔명\s*\}\}/g, vars.hotelName ?? '')
    .replace(/\{\{\s*호텔리어명\s*\}\}/g, vars.hotelierName ?? '')
    .replace(/\{\{\s*티켓번호\s*\}\}/g, vars.ticketNo ?? '')
    .replace(/\{\{\s*매니저명\s*\}\}/g, vars.managerName ?? '');
}

export function QuickReplyPanel({ open, onClose, onInsert, vars }: QuickReplyPanelProps) {
  const [items, setItems] = useState<QuickReplyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [focusIndex, setFocusIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // open 시 fetch (캐시 활용)
  useEffect(() => {
    if (!open) {
      setQuery('');
      setFocusIndex(0);
      setError(null);
      return;
    }
    // focus search input
    setTimeout(() => searchRef.current?.focus(), 0);

    const now = Date.now();
    if (cachedItems && cacheExpiresAt > now) {
      setItems(cachedItems);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch('/api/quick-replies', { cache: 'no-store' });
        const json = (await res.json()) as { ok: boolean; items?: QuickReplyItem[]; message?: string };
        if (!json.ok || !json.items) {
          setError(json.message ?? '조회 실패');
          return;
        }
        cachedItems = json.items;
        cacheExpiresAt = Date.now() + CACHE_TTL_MS;
        setItems(json.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : '조회 중 오류');
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.content.toLowerCase().includes(q) ||
        (it.category?.toLowerCase().includes(q) ?? false),
    );
  }, [items, query]);

  useEffect(() => {
    if (focusIndex >= filtered.length) setFocusIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, focusIndex]);

  const handleSelect = useCallback(
    (item: QuickReplyItem) => {
      onInsert(substituteVars(item.content, vars));
      onClose();
    },
    [onInsert, onClose, vars],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[focusIndex];
        if (item) handleSelect(item);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        // Ctrl+1~9 즉시 삽입
        e.preventDefault();
        const idx = parseInt(e.key, 10) - 1;
        const item = filtered[idx];
        if (item) handleSelect(item);
      }
    },
    [filtered, focusIndex, handleSelect, onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-20"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="빠른답변 템플릿"
        className="relative w-full max-w-lg overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* 검색 */}
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="빠른답변 검색 (제목·내용·카테고리)"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 리스트 */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              불러오는 중...
            </div>
          ) : error ? (
            <div className="p-6 text-center text-sm text-rose-600">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              {items.length === 0
                ? '등록된 빠른답변 템플릿이 없습니다.'
                : '검색 결과 없음'}
            </div>
          ) : (
            <ul role="listbox">
              {filtered.map((it, idx) => {
                const focused = idx === focusIndex;
                return (
                  <li
                    key={it.id}
                    role="option"
                    aria-selected={focused}
                    className={cn(
                      'cursor-pointer border-b border-slate-100 px-3 py-2 last:border-b-0 dark:border-slate-800',
                      focused && 'bg-brand-50 dark:bg-brand-950/40',
                    )}
                    onMouseEnter={() => setFocusIndex(idx)}
                    onClick={() => handleSelect(it)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {idx < 9 && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            Ctrl+{idx + 1}
                          </span>
                        )}
                        <span>{it.title}</span>
                      </div>
                      {it.category && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {it.category}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                      {substituteVars(it.content, vars)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-3 py-1.5 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <ChevronDown className="h-3 w-3 rotate-180" aria-hidden />
            <ChevronDown className="h-3 w-3" aria-hidden /> 이동 ·{' '}
            <kbd className="rounded border border-slate-300 px-1 dark:border-slate-700">Enter</kbd> 삽입
          </span>
          <span>
            <kbd className="rounded border border-slate-300 px-1 dark:border-slate-700">Esc</kbd> 닫기
          </span>
        </div>
      </div>
    </div>
  );
}
