/**
 * v1.7 — 0건 검색어 카드 (#D 닫힌 루프).
 *
 * 콘텐츠·동의어 갭 신호인 "0건 검색어"를 빈도순으로 보여주고,
 * 각 행에서 ① 동의어 추가(canonical 프리필) ② FAQ 작성(question 프리필)으로
 * 곧바로 연결해 운영자가 갭을 즉시 보강하게 한다.
 */

import Link from 'next/link';
import { Plus, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { QueryAgg } from '@/lib/services/search-logs';

export function ZeroQueriesCard({
  rows,
  canManageSynonyms = false,
}: {
  rows: QueryAgg[];
  /** 동의어 마스터는 admin 전용 — 매니저에겐 "동의어 추가" 링크를 숨긴다. */
  canManageSynonyms?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            🚫 0건 검색어 — 콘텐츠·동의어 갭
          </h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            최근 90일 · 결과가 없던 검색
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
            0건 검색이 없습니다. 👍 검색이 잘 답하고 있어요.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => (
              <li
                key={r.query}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {r.query}
                  </span>
                  <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
                    {r.count}회
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {canManageSynonyms && (
                    <Link
                      href={`/admin/master/synonyms/new?canonical=${encodeURIComponent(
                        r.query,
                      )}`}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Sparkles className="h-3 w-3" />
                      동의어 추가
                    </Link>
                  )}
                  <Link
                    href={`/admin/faqs/new?question=${encodeURIComponent(
                      r.query,
                    )}`}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Plus className="h-3 w-3" />
                    FAQ 작성
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500">
          동의어 추가는 표현 차이(약어·이형어)를, FAQ 작성은 콘텐츠 부재를
          메웁니다. 보강 후 다음 측정에서 0건이 줄어드는지 확인하세요.
        </p>
      </CardContent>
    </Card>
  );
}
