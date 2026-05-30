/**
 * 탭 바 — URL searchParam 기반.
 * 서버 컴포넌트로 SSR 친화적. 활성 탭은 호출자가 전달.
 */

import Link from 'next/link';
import {
  CalendarOff,
  Clock,
  History,
  ListChecks,
  type LucideIcon,
} from 'lucide-react';

export type BusinessHoursTab = 'hours' | 'overrides' | 'holidays' | 'history';

const TABS: { key: BusinessHoursTab; label: string; icon: LucideIcon }[] = [
  { key: 'hours', label: '현재 운영시간', icon: Clock },
  { key: 'overrides', label: '예약 변경', icon: ListChecks },
  { key: 'holidays', label: '공휴일', icon: CalendarOff },
  { key: 'history', label: '변경 이력', icon: History },
];

type Props = {
  active: BusinessHoursTab;
  /** 각 탭별 카운트 뱃지 (선택) */
  counts?: Partial<Record<BusinessHoursTab, number>>;
};

export function BusinessHoursTabBar({ active, counts }: Props) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
      {TABS.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.key;
        const count = counts?.[t.key];
        return (
          <Link
            key={t.key}
            href={`/admin/master/business-hours?tab=${t.key}`}
            className={
              isActive
                ? 'inline-flex items-center gap-1.5 border-b-2 border-brand-600 px-3 py-2 text-sm font-semibold text-brand-700 dark:text-brand-300'
                : 'inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }
          >
            <Icon className="h-4 w-4" />
            {t.label}
            {count !== undefined && count > 0 && (
              <span
                className={
                  isActive
                    ? 'rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                    : 'rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
