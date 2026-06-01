'use client';

/**
 * RoleStarterArticleMapper — articleIds 매핑 UI (D3).
 *
 * 흐름:
 *   - 매핑된 아티클 카드 리스트 (순서 = articleIds 배열 순서)
 *   - 각 카드: ↑ ↓ ✕ 버튼
 *   - 검색 input → 자동완성 드롭다운 → 클릭으로 추가
 *
 * Form 직렬화:
 *   - 각 articleId를 hidden `<input name="articleIds" />` 로 렌더
 *   - 부모 form의 FormData.getAll('articleIds') 로 순서 보존된 배열 받음
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §15-2-4
 */

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { searchArticlesForAutocompleteAction } from '@/app/actions/article-actions';

export interface MappedArticle {
  id: string;
  slug: string;
  title: string;
  productCode: string;
}

export interface RoleStarterArticleMapperProps {
  /** 초기 매핑 (page.tsx에서 articleIds 순서대로 fetch). */
  initial: MappedArticle[];
}

export function RoleStarterArticleMapper({
  initial,
}: RoleStarterArticleMapperProps) {
  const [items, setItems] = useState<MappedArticle[]>(initial);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<MappedArticle[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // initial 변경 시 동기 (편집 페이지에서 다른 카드 들어왔을 때 등 — 보수적)
  useEffect(() => {
    setItems(initial);
  }, [initial.map((a) => a.id).join(',')]);

  // 검색 debounce
  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const id = setTimeout(() => {
      searchArticlesForAutocompleteAction(search.trim())
        .then((rows) => {
          if (cancelled) return;
          setResults(rows);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
        })
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [search]);

  const currentIds = new Set(items.map((i) => i.id));

  function add(a: MappedArticle) {
    if (currentIds.has(a.id)) return;
    setItems((prev) => [...prev, a]);
    setSearch('');
    setResults([]);
    setSearchOpen(false);
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function move(id: string, delta: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0) return prev;
      const next = idx + delta;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      copy.splice(next, 0, removed!);
      return copy;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 매핑된 아티클 카드 */}
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-slate-50/40 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/30">
          아직 매핑된 가이드가 없어요. 아래 검색에서 추가하세요.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {items.map((a, i) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
            >
              <input type="hidden" name="articleIds" value={a.id} />
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {i + 1}
              </span>
              <GripVertical className="h-3 w-3 shrink-0 text-slate-300" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                  {a.title}
                </div>
                <div className="truncate text-[10px] text-slate-500">
                  {a.productCode} · /{a.slug}
                </div>
              </div>
              <button
                type="button"
                onClick={() => move(a.id, -1)}
                disabled={i === 0}
                aria-label="위로"
                className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => move(a.id, 1)}
                disabled={i === items.length - 1}
                aria-label="아래로"
                className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => remove(a.id)}
                aria-label="제거"
                className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ol>
      )}

      {/* 검색 + 자동완성 */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          placeholder="아티클 검색 (제목 또는 slug, 2자 이상)"
          className="pl-7"
        />
        {loading && (
          <Loader2 className="absolute right-2 top-2.5 h-3.5 w-3.5 animate-spin text-slate-400" />
        )}
        {searchOpen && results.length > 0 && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            {results.map((r) => {
              const has = currentIds.has(r.id);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={has}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(r)}
                    className={`flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left hover:bg-brand-50 dark:hover:bg-brand-950/30 ${
                      has ? 'cursor-not-allowed opacity-50' : ''
                    }`}
                  >
                    <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                      {r.title}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {r.productCode} · /{r.slug} {has && '· 이미 추가됨'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
