'use client';

/**
 * KeywordRecommender — 키워드 자동 추천 칩 행 (A3).
 *
 * 흐름:
 *   - title + body 변경 시 debounce(500ms) → recommendKeywordsAction 호출
 *   - 추천 결과를 칩 행으로 렌더링
 *   - 클릭 시 부모 onAdd 호출 → 키워드 배열에 추가
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §1-2 (A3)
 */

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { recommendKeywordsAction } from '@/app/actions/article-actions';
import type { KeywordRecommendation } from '@/lib/articles/recommend';

export interface KeywordRecommenderProps {
  inputContext: { title: string; body: string; productCode: string };
  current: string[];
  onAdd: (keyword: string) => void;
}

const TONE_BY_SOURCE: Record<KeywordRecommendation['source'], string> = {
  synonym:
    'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/40',
  'body-extract':
    'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
  popular:
    'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40',
};

const LABEL_BY_SOURCE: Record<KeywordRecommendation['source'], string> = {
  synonym: '동의어',
  'body-extract': '본문',
  popular: '인기',
};

export function KeywordRecommender({
  inputContext,
  current,
  onAdd,
}: KeywordRecommenderProps) {
  const [recs, setRecs] = useState<KeywordRecommendation[]>([]);
  const [loading, setLoading] = useState(false);

  // debounce
  useEffect(() => {
    if (!inputContext.productCode) return;
    if (!inputContext.title.trim() && inputContext.body.length < 200) {
      setRecs([]);
      return;
    }
    let cancelled = false;
    const id = setTimeout(() => {
      setLoading(true);
      recommendKeywordsAction({
        title: inputContext.title,
        body: inputContext.body,
        productCode: inputContext.productCode,
        existing: current,
      })
        .then((next) => {
          if (!cancelled) setRecs(next);
        })
        .catch(() => {
          if (!cancelled) setRecs([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [
    inputContext.title,
    inputContext.body,
    inputContext.productCode,
    current.join(','),
  ]);

  const filtered = recs.filter((r) => !current.includes(r.term));
  if (!loading && filtered.length === 0) return null;

  return (
    <div data-testid="keyword-recommend" className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        <Sparkles className="h-3 w-3" />
        추천 키워드 {loading && '(로딩 중...)'}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {filtered.map((r) => (
          <button
            key={r.term}
            type="button"
            onClick={() => onAdd(r.term)}
            title={`${LABEL_BY_SOURCE[r.source]} · weight ${r.weight}`}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition ${TONE_BY_SOURCE[r.source]}`}
          >
            {r.term}
            <span className="text-[9px] opacity-60">+</span>
          </button>
        ))}
      </div>
    </div>
  );
}
