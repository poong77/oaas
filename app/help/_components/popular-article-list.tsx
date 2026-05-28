import Link from 'next/link';
import { ArrowUpRight, Eye } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import type { ArticleListItem } from '@/lib/services/articles';

/** 홈/`/help` 인기 아티클 카드 리스트. */
export function PopularArticleList({ items }: { items: ArticleListItem[] }) {
  if (items.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Eye className="h-6 w-6" />}
          title="아직 인기 아티클이 없습니다"
          description="아티클이 추가되고 조회수가 쌓이면 이곳에서 인기 콘텐츠를 안내해드립니다."
        />
      </div>
    );
  }

  return (
    <ol className="divide-y divide-slate-100 dark:divide-slate-800">
      {items.map((a, i) => (
        <li key={a.id}>
          <Link
            href={`/help/${a.productCode}/${a.slug}`}
            className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 sm:px-5"
          >
            <span className="mt-0.5 text-xs font-bold text-brand-600 dark:text-brand-400 tabular-nums">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge tone="brand" className="uppercase">
                  {a.productCode}
                </Badge>
                <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {a.title}
                </span>
              </div>
              {a.summary30s && (
                <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                  {a.summary30s}
                </p>
              )}
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {a.viewCount.toLocaleString()}
                </span>
                {a.helpfulYes + a.helpfulNo > 0 && (
                  <span className="tabular-nums">
                    도움됨{' '}
                    {Math.round(
                      (a.helpfulYes / (a.helpfulYes + a.helpfulNo)) * 100,
                    )}
                    %
                  </span>
                )}
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-slate-400" />
          </Link>
        </li>
      ))}
    </ol>
  );
}
