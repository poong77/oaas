/**
 * LP-01 ⑤ 역할별 시작하기 (Phase 9 동적 전환).
 *
 * - DB의 role_starters 테이블 row가 있으면 그것을 노출.
 * - 빈 결과/오류 시 _constants.ts의 하드코딩 fallback.
 */

import Link from 'next/link';
import { resolveIcon } from '@/components/icon-resolver';
import { ROLE_STARTERS } from './_constants';
import type { RoleStarter } from '@/db/schema';

type RoleStarterView = {
  id: string;
  roleKey: string;
  label: string;
  description: string | null;
  icon: string | null;
};

function fromDbRow(r: RoleStarter): RoleStarterView {
  return {
    id: r.id,
    roleKey: r.roleKey,
    label: r.label,
    description: r.description,
    icon: r.icon,
  };
}

// 하드코딩 fallback의 role_key → lucide 이름 매핑.
const FALLBACK_ROLE_ICON_NAMES: Record<string, string> = {
  front: 'BellRing',
  sales: 'Briefcase',
  housekeeping: 'BedDouble',
  manager: 'ShieldCheck',
  new_open: 'Sparkles',
};

function fromFallback(): RoleStarterView[] {
  return ROLE_STARTERS.map((rs) => ({
    id: `fallback-${rs.key}`,
    roleKey: rs.key,
    label: rs.label,
    description: rs.description,
    icon: FALLBACK_ROLE_ICON_NAMES[rs.key] ?? null,
  }));
}

export function RoleStarters({ items }: { items?: RoleStarter[] }) {
  const rows: RoleStarterView[] =
    items && items.length > 0 ? items.map(fromDbRow) : fromFallback();

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
          역할로 찾기
        </h2>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {rows.map((role) => {
          const Icon = resolveIcon(role.icon);
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
    </section>
  );
}
