/**
 * LP-01 ⑦ 최근 업데이트 위젯.
 *
 * Phase 3:
 *   - 발행된 아티클 최근 3건 노출 (articles.publishedAt DESC, isActive=true)
 *   - 아티클이 없으면 EmptyState
 *   - 공지 시스템은 Phase 7에서 통합 예정 — TODO 표시
 */

import Link from 'next/link';
import { ArrowUpRight, Megaphone } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { listRecentPublishedArticles } from '@/lib/services/articles';

export async function RecentUpdates() {
  // TODO(phase-3-temp): Phase 7에서 notices 테이블과 통합 (현재는 아티클만).
  const items = await listRecentPublishedArticles(3);

  return (
    <section
      aria-labelledby="updates-heading"
      className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
    >
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2
            id="updates-heading"
            className="text-lg font-bold tracking-tight sm:text-xl"
          >
            최근 업데이트 · 가이드
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            최근 발행된 핸드북 아티클을 확인하세요.
          </p>
        </div>
        <Link
          href="/help"
          className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          전체 가이드 →
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-6 w-6" />}
          title="아직 발행된 아티클이 없습니다"
          description="매니저가 핸드북을 작성하면 이 곳에서 최신 업데이트를 확인할 수 있습니다."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <li key={a.id}>
              <Link
                href={`/help/${a.productCode}/${a.slug}`}
                className="flex h-full flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:-translate-y-0.5 hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
              >
                <div className="flex items-center gap-2">
                  <Badge tone="brand" className="uppercase">
                    {a.productCode}
                  </Badge>
                  {a.publishedAt && (
                    <span className="text-xs text-slate-400">
                      {formatDate(a.publishedAt)}
                    </span>
                  )}
                </div>
                <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {a.title}
                </h3>
                {a.summary30s && (
                  <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {a.summary30s}
                  </p>
                )}
                <div className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-brand-600 dark:text-brand-400">
                  자세히 보기
                  <ArrowUpRight className="h-3 w-3" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatDate(d: Date | string | null): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
