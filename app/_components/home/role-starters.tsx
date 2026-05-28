/**
 * LP-01 ⑤ 역할별 시작하기.
 *
 * TODO(phase-2-temp): Phase 9에서 role_starters 마스터 테이블로 이관.
 * 각 카드는 /role/[key] (placeholder)로 이동.
 */

import Link from 'next/link';
import { ROLE_STARTERS } from './_constants';

export function RoleStarters() {
  return (
    <section
      aria-labelledby="role-heading"
      className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
    >
      <div className="mb-5">
        <h2
          id="role-heading"
          className="text-lg font-bold tracking-tight sm:text-xl"
        >
          역할별 시작하기
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
          내 역할에 맞는 핵심 가이드부터 빠르게 익혀보세요.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ROLE_STARTERS.map((role) => {
          const Icon = role.icon;
          return (
            <li key={role.key}>
              <Link
                href={`/role/${role.key}`}
                className="group flex h-full flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-950/40 dark:text-brand-300 dark:group-hover:bg-brand-500 dark:group-hover:text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {role.label}
                </span>
                <span className="text-xs leading-snug text-slate-500 dark:text-slate-400">
                  {role.description}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
