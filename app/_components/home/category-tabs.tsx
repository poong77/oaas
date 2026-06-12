'use client';

/**
 * LP-01 ③ 카테고리 찾아보기 — 제품별/역할별 탭 통합 (시안 구조, 2026-06-10).
 *
 * 기존 CategoryGrid + RoleStarters를 한 섹션의 탭으로 통합.
 * - 제품별: getProductCategories(대분류) → /help/{code}
 * - 역할별: listActiveRoleStarters → /role/{roleKey}
 * 아이콘은 업로드 이미지(iconImageUrl) 우선, 없으면 lucide(resolveIcon).
 * 컬러는 brand-* 토큰(역할별 동적) + 다크모드.
 */

import { useState } from 'react';
import Link from 'next/link';
import { resolveIcon } from '@/components/icon-resolver';
import type { ProductCategoryView } from '@/lib/services/categories';
import type { RoleStarter } from '@/db/schema';

export function CategoryTabs({
  categories,
  roles,
}: {
  categories: ProductCategoryView[];
  roles: RoleStarter[];
}) {
  const [tab, setTab] = useState<'product' | 'role'>('product');

  return (
    <section
      aria-labelledby="category-heading"
      className="bg-slate-100 py-10 dark:bg-slate-900 sm:py-14"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-7 px-4 sm:px-6 lg:px-8">
        <h2
          id="category-heading"
          className="text-center text-2xl font-bold tracking-tight sm:text-[28px]"
        >
          카테고리 찾아보기
        </h2>

        {/* 탭 토글 */}
        <div className="flex w-[300px] max-w-full items-center rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
          {(['product', 'role'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition-colors sm:text-base ${
                tab === t
                  ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-950 dark:text-brand-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t === 'product' ? '제품별' : '역할별'}
            </button>
          ))}
        </div>

        {/* 카드 그리드 */}
        {tab === 'product' ? (
          <ul className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((cat) => {
              const Icon = resolveIcon(cat.icon);
              return (
                <li key={cat.id}>
                  <Link
                    href={`/help/${cat.code}`}
                    className="group flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700 sm:p-5"
                  >
                    <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-white text-brand-600 transition-colors group-hover:text-brand-700 dark:bg-slate-900 dark:text-brand-300 dark:group-hover:text-brand-200">
                      {cat.iconImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cat.iconImageUrl} alt="" className="h-7 w-7 object-contain" />
                      ) : (
                        <Icon className="h-6 w-6" />
                      )}
                    </span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {cat.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {roles.map((role) => {
              const Icon = resolveIcon(role.icon);
              return (
                <li key={role.id}>
                  <Link
                    href={`/role/${role.roleKey}`}
                    className="group flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700 sm:p-5"
                  >
                    <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-white text-brand-600 transition-colors group-hover:text-brand-700 dark:bg-slate-900 dark:text-brand-300 dark:group-hover:text-brand-200">
                      {role.iconImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={role.iconImageUrl} alt="" className="h-7 w-7 object-contain" />
                      ) : (
                        <Icon className="h-6 w-6" />
                      )}
                    </span>
                    <span className="whitespace-nowrap text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {role.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
