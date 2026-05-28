/**
 * LP-01 ③ 카테고리 아이콘 그리드.
 *
 * 시드된 product 카테고리 6개를 그리드로 노출.
 * 클릭 → /help/[code] (Phase 3에서 실 페이지 구현)
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { resolveIcon } from './_icon-map';
import type { ProductCategoryView } from '@/lib/services/categories';

export function CategoryGrid({
  categories,
}: {
  categories: ProductCategoryView[];
}) {
  return (
    <section
      aria-labelledby="category-heading"
      className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
    >
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2
            id="category-heading"
            className="text-lg font-bold tracking-tight sm:text-xl"
          >
            제품별 가이드
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            관심 제품을 선택하면 사용 가이드·FAQ·체크리스트가 모여있어요.
          </p>
        </div>
        <Link
          href="/help"
          className="hidden items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400 sm:inline-flex"
        >
          전체 보기 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((cat) => {
          const Icon = resolveIcon(cat.icon);
          return (
            <li key={cat.id}>
              <Link
                href={`/help/${cat.code}`}
                className="group flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700 sm:p-5"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-900/40 dark:text-brand-300 dark:group-hover:bg-brand-500 dark:group-hover:text-white sm:h-12 sm:w-12">
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {cat.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex justify-end sm:hidden">
        <Link
          href="/help"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          전체 보기 <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}
