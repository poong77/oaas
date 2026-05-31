/**
 * KeywordGapCard — 아티클 기반 동의어 갭 탐지 (v1.3 Phase A).
 *
 * 발행 아티클 keywords[] 중 동의어 사전에 미등록인 키워드를 빈도순으로 노출.
 * 각 후보는 "그룹 생성"(canonical 프리필) 링크로 기존 등록 흐름에 연결한다.
 *
 * 읽기 전용 — 자동 INSERT 없음. 어드민 검수 후 수동 반영 원칙.
 */

import Link from 'next/link';
import { Lightbulb, Plus, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { analyzeKeywordGaps } from '@/lib/services/keyword-gap';

export async function KeywordGapCard() {
  const { gaps, totalDistinctKeywords, coveredKeywords } =
    await analyzeKeywordGaps({ limit: 30 });

  // 미등록 키워드가 없으면 — 모두 커버됨을 짧게 안내
  if (gaps.length === 0) {
    if (totalDistinctKeywords === 0) return null; // 아티클 키워드 자체가 없음
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            발행 아티클의 키워드 {totalDistinctKeywords}개가 모두 동의어 사전에
            반영되어 있습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  const coverageRate =
    totalDistinctKeywords > 0
      ? Math.round((coveredKeywords / totalDistinctKeywords) * 100)
      : 0;

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
              발행 아티클에는 있으나 동의어 사전에 없는 키워드입니다. 검색
              recall을 높이려면 그룹으로 등록하세요. (사전 반영률 {coverageRate}%
              · {coveredKeywords}/{totalDistinctKeywords})
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {gaps.map((g) => (
            <Link
              key={g.term}
              href={`/admin/master/synonyms/new?canonical=${encodeURIComponent(g.term)}`}
              title={`아티클 ${g.articleCount}건에 등장 · 클릭하면 대표어로 새 그룹 생성`}
              className="group inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 transition hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-900/40"
            >
              <span className="font-medium">{g.term}</span>
              <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
                {g.articleCount}
              </span>
              <Plus className="h-3 w-3 opacity-0 transition group-hover:opacity-70" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
