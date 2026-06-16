'use client';

/**
 * KeywordGapCard — 아티클 기반 동의어 갭 후보 (원페이지, 클라이언트).
 *
 * 발행 아티클 keywords[] 중 동의어 사전 미등록 키워드를 빈도순 노출.
 *   - 칩 본문 클릭 → 위 "동의어 그룹 추가"의 대표어로 프리필 (onPick)
 *   - 칩 우측 'x' → 무시(dismiss). 다음부터 후보에서 제외 (system_settings 보관)
 *
 * 읽기 전용 분석 결과 — 자동 INSERT 없음. 어드민 검수 후 수동 반영.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronRight,
  EyeOff,
  Lightbulb,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  dismissKeywordGapAction,
  restoreKeywordGapAction,
} from '@/app/actions/master-synonyms-actions';

export type GapItem = { term: string; articleCount: number };

type Props = {
  gaps: GapItem[];
  totalDistinctKeywords: number;
  coveredKeywords: number;
  dismissedKeywords: number;
  dismissedTerms: string[];
  /** 칩 클릭 시 대표어 프리필 콜백. */
  onPick: (term: string) => void;
};

export function KeywordGapCard({
  gaps,
  totalDistinctKeywords,
  coveredKeywords,
  dismissedKeywords,
  dismissedTerms,
  onPick,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyTerm, setBusyTerm] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);

  // 키워드 자체가 없으면 카드 숨김
  if (totalDistinctKeywords === 0) return null;

  const coverageRate =
    totalDistinctKeywords > 0
      ? Math.round((coveredKeywords / totalDistinctKeywords) * 100)
      : 0;

  const dismiss = (term: string) => {
    setBusyTerm(term);
    startTransition(async () => {
      const res = await dismissKeywordGapAction(term);
      if (res.ok) {
        toast.success(`"${term}" 무시됨`);
        router.refresh();
      } else {
        toast.error(res.message ?? '무시 실패');
      }
      setBusyTerm(null);
    });
  };

  const restore = (term: string) => {
    setBusyTerm(term);
    startTransition(async () => {
      const res = await restoreKeywordGapAction(term);
      if (res.ok) {
        toast.success(`"${term}" 무시 해제됨`);
        router.refresh();
      } else {
        toast.error(res.message ?? '복원 실패');
      }
      setBusyTerm(null);
    });
  };

  /** 무시한 키워드 보기 — 기본 접힘. 펼치면 복원 가능. */
  const dismissedSection =
    dismissedTerms.length === 0 ? null : (
      <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setShowDismissed((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          {showDismissed ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          <EyeOff className="h-3.5 w-3.5" />
          무시한 키워드 {dismissedTerms.length}개 보기
        </button>
        {showDismissed && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {dismissedTerms.map((term) => {
              const busy = pending && busyTerm === term;
              return (
                <span
                  key={term}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1 text-xs text-slate-400 line-through dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500"
                >
                  {term}
                  <button
                    type="button"
                    onClick={() => restore(term)}
                    disabled={pending}
                    title="무시 해제 (다시 후보로)"
                    aria-label={`${term} 무시 해제`}
                    className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 no-underline hover:bg-slate-200 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  >
                    <RotateCcw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    );

  // 미등록 후보가 없으면 — 모두 반영/무시되었음을 안내 (무시 목록은 펼쳐볼 수 있게 유지)
  if (gaps.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              발행 아티클 키워드 {totalDistinctKeywords}개가 모두 사전 반영 또는
              무시 처리되었습니다.
              {dismissedKeywords > 0 && (
                <span className="text-slate-400"> (무시 {dismissedKeywords}개)</span>
              )}
            </p>
          </div>
          {dismissedSection}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              아티클 미등록 키워드 {gaps.length}건
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              발행 아티클엔 있으나 사전에 없는 키워드입니다. 칩을 누르면 위에서
              대표어로 등록, <b>x</b>는 무시(다음부터 숨김). (반영률 {coverageRate}%
              · {coveredKeywords}/{totalDistinctKeywords}
              {dismissedKeywords > 0 ? ` · 무시 ${dismissedKeywords}` : ''})
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {gaps.map((g) => {
            const busy = pending && busyTerm === g.term;
            return (
              <span
                key={g.term}
                className="group inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 py-1 pl-2.5 pr-1 text-xs text-amber-800 transition hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-900/40"
              >
                <button
                  type="button"
                  onClick={() => onPick(g.term)}
                  disabled={pending}
                  title={`아티클 ${g.articleCount}건에 등장 · 클릭하면 대표어로 등록`}
                  className="inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <Plus className="h-3 w-3 opacity-60" />
                  <span className="font-medium">{g.term}</span>
                  <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
                    {g.articleCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(g.term)}
                  disabled={pending}
                  title="무시 (다음부터 숨김)"
                  aria-label={`${g.term} 무시`}
                  className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-amber-500 hover:bg-amber-200/70 hover:text-amber-900 disabled:opacity-40 dark:hover:bg-amber-800/50"
                >
                  <X className={`h-3 w-3 ${busy ? 'animate-pulse' : ''}`} />
                </button>
              </span>
            );
          })}
        </div>

        {dismissedSection}
      </CardContent>
    </Card>
  );
}
