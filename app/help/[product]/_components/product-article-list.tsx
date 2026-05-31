'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Eye, ThumbsUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ArticleListItem } from '@/lib/services/articles';
import { toQueryString } from '@/lib/url-query';

export function ProductArticleList({
  items,
  productCode,
  total,
  page,
  pageSize,
}: {
  items: ArticleListItem[];
  productCode: string;
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  function go(p: number) {
    const next = new URLSearchParams(sp.toString());
    next.set('page', String(p));
    router.push(`/help/${productCode}?${toQueryString(next)}`);
  }

  return (
    <>
      <ul className="grid gap-px bg-slate-100 dark:bg-slate-800 sm:grid-cols-2">
        {items.map((a) => {
          const helpfulPct =
            a.helpfulYes + a.helpfulNo > 0
              ? Math.round(
                  (a.helpfulYes / (a.helpfulYes + a.helpfulNo)) * 100,
                )
              : null;
          return (
            <li key={a.id} className="bg-white dark:bg-slate-900">
              <Link
                href={`/help/${productCode}/${a.slug}`}
                className="flex h-full flex-col gap-2 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 sm:p-5"
              >
                <div className="flex items-center gap-2">
                  {a.categoryPath?.[0] && (
                    <Badge tone="slate">{a.categoryPath[0]}</Badge>
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
                <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-slate-500">
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

      {lastPage > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-3 py-3 text-sm dark:border-slate-800">
          <div className="text-xs text-slate-500">
            {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} /{' '}
            {total}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => go(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              이전
            </Button>
            <span className="px-2 text-sm font-medium">
              {page} / {lastPage}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= lastPage}
              onClick={() => go(page + 1)}
            >
              다음
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
