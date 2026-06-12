'use client';

/**
 * RelatedArticleAutocomplete — 관련 문서 자동완성 + 자동 추천 (A4).
 *
 * 두 가지 입력 방식:
 *   1. 추천 칩 행 (recommendRelatedArticlesAction 자동 호출) — 클릭으로 추가
 *   2. 검색 input (debounce 200ms → searchArticlesForAutocompleteAction)
 *
 * 추가/제거:
 *   - slug 또는 uuid 양쪽 호환
 *   - current 배열에 이미 있으면 칩 비활성화
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §1-2 (A4)
 */

import { useEffect, useMemo, useState } from 'react';
import { Link2, Search, X } from 'lucide-react';
import {
  recommendRelatedArticlesAction,
  searchArticlesForAutocompleteAction,
} from '@/app/actions/article-actions';
import type { RelatedArticleRecommendation } from '@/lib/articles/recommend';
import { Input } from '@/components/ui/input';

export interface RelatedArticleAutocompleteProps {
  inputContext: {
    productCode: string;
    categoryPath: string[];
    keywords: string[];
    body: string;
    excludeId?: string;
  };
  /** 사용자 입력 raw (slug, uuid 쉼표 구분). */
  rawValue: string;
  onChange: (next: string) => void;
}

const REASON_LABEL: Record<RelatedArticleRecommendation['reason'], string> = {
  'same-category': '같은 카테고리',
  'keyword-overlap': '키워드 일치',
  'body-link': '본문 링크',
};

export function RelatedArticleAutocomplete({
  inputContext,
  rawValue,
  onChange,
}: RelatedArticleAutocompleteProps) {
  const [recs, setRecs] = useState<RelatedArticleRecommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; slug: string; title: string; productCode: string }>
  >([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const currentSlugs = useMemo(
    () =>
      rawValue
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [rawValue],
  );
  const currentSet = useMemo(() => new Set(currentSlugs), [currentSlugs]);

  // 추천 자동 fetch
  useEffect(() => {
    if (!inputContext.productCode) return;
    if (
      inputContext.categoryPath.length === 0 &&
      inputContext.keywords.length === 0 &&
      inputContext.body.length < 200
    ) {
      setRecs([]);
      return;
    }
    let cancelled = false;
    setRecsLoading(true);
    recommendRelatedArticlesAction({
      productCode: inputContext.productCode,
      categoryPath: inputContext.categoryPath,
      keywords: inputContext.keywords,
      body: inputContext.body,
      excludeId: inputContext.excludeId,
    })
      .then((next) => {
        if (!cancelled) setRecs(next);
      })
      .catch(() => {
        if (!cancelled) setRecs([]);
      })
      .finally(() => {
        if (!cancelled) setRecsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    inputContext.productCode,
    inputContext.categoryPath.join('/'),
    inputContext.keywords.join(','),
    inputContext.body.length,
    inputContext.excludeId,
  ]);

  // 검색 debounce
  useEffect(() => {
    if (search.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const id = setTimeout(() => {
      searchArticlesForAutocompleteAction(search.trim(), inputContext.productCode)
        .then((next) => {
          if (!cancelled) setSearchResults(next);
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [search, inputContext.productCode]);

  function add(slugOrId: string) {
    if (currentSet.has(slugOrId)) return;
    const next = [...currentSlugs, slugOrId];
    onChange(next.join(', '));
    setSearch('');
    setSearchResults([]);
    setSearchOpen(false);
  }

  function remove(slugOrId: string) {
    const next = currentSlugs.filter((s) => s !== slugOrId);
    onChange(next.join(', '));
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 현재 추가된 항목 */}
      {currentSlugs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {currentSlugs.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <Link2 className="h-3 w-3 text-slate-400" />
              {s}
              <button
                type="button"
                onClick={() => remove(s)}
                aria-label={`${s} 제거`}
                className="hover:text-rose-500"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 검색 input */}
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
        {searchOpen && searchResults.length > 0 && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            {searchResults.map((r) => {
              const has = currentSet.has(r.slug);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={has}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(r.slug)}
                    className={`flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left hover:bg-brand-50 dark:hover:bg-brand-950/30 ${
                      has ? 'cursor-not-allowed opacity-50' : ''
                    }`}
                  >
                    <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                      {r.title}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {r.productCode} · {r.slug} {has && '· 이미 추가됨'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 추천 칩 */}
      {(recsLoading || recs.length > 0) && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            추천 관련 문서 {recsLoading && '(로딩 중...)'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {recs
              .filter((r) => !currentSet.has(r.slug))
              .map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => add(r.slug)}
                  title={`${REASON_LABEL[r.reason]} · weight ${r.weight}`}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-brand-100 hover:text-brand-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-brand-950/40 dark:hover:text-brand-300"
                >
                  {r.title.length > 24 ? `${r.title.slice(0, 24)}…` : r.title}
                  <span className="text-[9px] opacity-60">
                    [{REASON_LABEL[r.reason]}]
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
