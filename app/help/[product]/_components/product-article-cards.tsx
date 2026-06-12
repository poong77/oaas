import Link from 'next/link';
import { ChevronRight, Eye, ThumbsUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ArticleListItem } from '@/lib/services/articles';
import { CONTENT_TYPE_META } from '@/lib/articles/content-type-meta';

/**
 * 제품 가이드 아티클 카드 그리드 (표현 전용).
 * 페이지네이션/검색 상태는 상위 ProductArticleBrowser가 관리한다.
 */
export function ProductArticleCards({
  items,
  productCode,
}: {
  items: ArticleListItem[];
  productCode: string;
}) {
  return (
    <ul className="grid gap-px bg-slate-100 dark:bg-slate-800 sm:grid-cols-2">
      {items.map((a) => {
        const helpfulPct =
          a.helpfulYes + a.helpfulNo > 0
            ? Math.round((a.helpfulYes / (a.helpfulYes + a.helpfulNo)) * 100)
            : null;
        return (
          <li key={a.id} className="bg-white dark:bg-slate-900">
            <Link
              href={`/help/${productCode}/${a.slug}`}
              className="flex h-full flex-col gap-2 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {/* 의도 타입 칩 — 색으로 분류명과 구분 (사용방법/기능설명/문제해결) */}
                {a.contentType && CONTENT_TYPE_META[a.contentType] && (
                  <Badge tone={CONTENT_TYPE_META[a.contentType].tone}>
                    {CONTENT_TYPE_META[a.contentType].label}
                  </Badge>
                )}
                {/* 대분류 › 중분류 › 소분류 */}
                {a.categoryPath && a.categoryPath.length > 0 && (
                  <span className="inline-flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    {a.categoryPath.map((seg, i) => (
                      <span
                        key={`${seg}-${i}`}
                        className="inline-flex items-center gap-1"
                      >
                        {i > 0 && (
                          <ChevronRight className="h-3 w-3 shrink-0 text-slate-300 dark:text-slate-600" />
                        )}
                        <span
                          className={
                            i === 0
                              ? 'font-medium text-slate-600 dark:text-slate-300'
                              : undefined
                          }
                        >
                          {seg}
                        </span>
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <h3 className="line-clamp-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                {a.title}
              </h3>
              {a.summary30s && (
                <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                  {a.summary30s}
                </p>
              )}
              <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {a.viewCount.toLocaleString()}
                </span>
                {helpfulPct !== null && (
                  <span className="inline-flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" />
                    {helpfulPct}%
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
