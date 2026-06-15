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
      className="bg-[#F7F8F9] py-10 dark:bg-slate-900 sm:py-14"
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-7 px-4 sm:px-6 lg:px-8">
        <h2
          id="category-heading"
          className="text-center text-heading-large-bold tracking-tight"
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
              className={`flex-1 rounded-lg px-2 py-2 text-label-medium-semibold transition-colors sm:text-label-large-semibold ${
                tab === t
                  ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-950 dark:text-brand-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t === 'product' ? '제품별' : '역할별'}
            </button>
          ))}
        </div>

        {/* 카드 그리드 — 흰 카드 위 아이콘만(48×48), 테두리·아이콘 배경 박스 없음 */}
        <ul className="flex w-full flex-wrap items-stretch justify-center gap-3">
          {tab === 'product'
            ? categories.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  href={`/help/${cat.code}`}
                  icon={cat.icon}
                  iconImageUrl={cat.iconImageUrl}
                  label={cat.label}
                />
              ))
            : roles.map((role) => (
                <CategoryCard
                  key={role.id}
                  href={`/role/${role.roleKey}`}
                  icon={role.icon}
                  iconImageUrl={role.iconImageUrl}
                  label={role.label}
                />
              ))}
        </ul>
      </div>
    </section>
  );
}

/** 카테고리 카드 — 124×128, 흰 배경, 테두리 없음, 아이콘 48×48 + 텍스트(gap 16). */
function CategoryCard({
  href,
  icon,
  iconImageUrl,
  label,
}: {
  href: string;
  icon: string | null;
  iconImageUrl: string | null;
  label: string;
}) {
  const Icon = resolveIcon(icon);
  return (
    <li>
      <Link
        href={href}
        className="group flex h-32 w-[124px] flex-col items-center justify-center gap-4 rounded-lg bg-white px-7 py-5 text-center transition-all hover:-translate-y-0.5 hover:shadow-sm dark:bg-slate-900"
      >
        <span className="flex h-12 w-12 items-center justify-center overflow-hidden text-brand-600 transition-colors group-hover:text-brand-700 dark:text-brand-300 dark:group-hover:text-brand-200">
          {iconImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={iconImageUrl} alt="" className="h-12 w-12 object-contain" />
          ) : (
            <Icon className="h-12 w-12" strokeWidth={1.5} />
          )}
        </span>
        <span className="text-title-medium-medium text-slate-800 dark:text-slate-100">
          {label}
        </span>
      </Link>
    </li>
  );
}
