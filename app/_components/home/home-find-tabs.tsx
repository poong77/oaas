'use client';

/**
 * LP-01 ③ 제품·역할로 찾기 — 탭 병합 (2026-06-01 UX 재구성).
 *
 * 기존 "카테고리 그리드(제품별)" + "역할별 시작하기" 두 섹션을
 * 하나의 탭 섹션으로 병합해 홈 세로 길이를 단축한다.
 *   - 제품별: categories → /help/[code]
 *   - 역할별: roleStarters → /role/[roleKey]  (빈 결과 시 _constants fallback)
 */

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { resolveIcon as resolveCategoryIcon } from './_icon-map';
import { resolveIcon as resolveRoleIcon } from '@/components/icon-resolver';
import { ROLE_STARTERS } from './_constants';
import type { ProductCategoryView } from '@/lib/services/categories';
import type { RoleStarter } from '@/db/schema';
import { cn } from '@/lib/utils';

type RoleStarterView = {
  id: string;
  roleKey: string;
  label: string;
  description: string | null;
  icon: string | null;
};

const FALLBACK_ROLE_ICON_NAMES: Record<string, string> = {
  front: 'BellRing',
  sales: 'Briefcase',
  housekeeping: 'BedDouble',
  manager: 'ShieldCheck',
  new_open: 'Sparkles',
};

function normalizeRoles(items?: RoleStarter[]): RoleStarterView[] {
  if (items && items.length > 0) {
    return items.map((r) => ({
      id: r.id,
      roleKey: r.roleKey,
      label: r.label,
      description: r.description,
      icon: r.icon,
    }));
  }
  return ROLE_STARTERS.map((rs) => ({
    id: `fallback-${rs.key}`,
    roleKey: rs.key,
    label: rs.label,
    description: rs.description,
    icon: FALLBACK_ROLE_ICON_NAMES[rs.key] ?? null,
  }));
}

type TabKey = 'product' | 'role';

export function HomeFindTabs({
  categories,
  roleStarters,
}: {
  categories: ProductCategoryView[];
  roleStarters?: RoleStarter[];
}) {
  const [tab, setTab] = useState<TabKey>('product');
  const roles = normalizeRoles(roleStarters);

  return (
    <section
      aria-labelledby="find-heading"
      className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="find-heading"
            className="text-lg font-bold tracking-tight sm:text-xl"
          >
            제품·역할로 찾기
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            {tab === 'product'
              ? '관심 제품을 선택하면 사용 가이드·FAQ·체크리스트가 모여있어요.'
              : '내 역할에 맞는 핵심 가이드부터 빠르게 익혀보세요.'}
          </p>
        </div>

        {/* 탭 토글 */}
        <div
          role="tablist"
          aria-label="찾기 기준"
          className="inline-flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/60"
        >
          {(
            [
              { key: 'product', label: '제품별' },
              { key: 'role', label: '역할별' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                tab === t.key
                  ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-800 dark:text-brand-300'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 제품별 */}
      {tab === 'product' && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((cat) => {
            const Icon = resolveCategoryIcon(cat.icon);
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
      )}

      {/* 역할별 */}
      {tab === 'role' && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {roles.map((role) => {
            const Icon = resolveRoleIcon(role.icon);
            return (
              <li key={role.id}>
                <Link
                  href={`/role/${role.roleKey}`}
                  className="group flex h-full flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-950/40 dark:text-brand-300 dark:group-hover:bg-brand-500 dark:group-hover:text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {role.label}
                  </span>
                  {role.description && (
                    <span className="text-xs leading-snug text-slate-500 dark:text-slate-400">
                      {role.description}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex justify-end">
        <Link
          href="/help"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          전체 가이드 보기 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
