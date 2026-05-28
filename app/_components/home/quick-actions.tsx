/**
 * LP-01 ④ 자주찾는작업 (Phase 9 동적 전환).
 *
 * - DB의 quick_actions 테이블 row가 있으면 그것을 노출.
 * - 빈 결과/오류 시 _constants.ts의 하드코딩 fallback (Phase 2 기본).
 * - 아이콘은 lucide-react 이름 문자열 → `resolveIcon` 매핑.
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { resolveIcon } from '@/components/icon-resolver';
import { QUICK_ACTIONS } from './_constants';
import type { QuickAction } from '@/db/schema';

type QuickActionView = {
  id: string;
  label: string;
  description: string | null;
  href: string;
  icon: string | null;
};

function fromDbRow(r: QuickAction): QuickActionView {
  return {
    id: r.id,
    label: r.label,
    description: r.description,
    href: r.linkUrl,
    icon: r.icon,
  };
}

// 하드코딩 fallback의 lucide 컴포넌트 → 이름 문자열 매핑 (정확한 매핑 보장).
const FALLBACK_ICON_NAMES: Record<string, string> = {
  '비밀번호 초기화': 'KeyRound',
  '솔루션 링크 변경': 'Wrench',
  '직원 추가': 'Users',
  '문의 접수': 'HelpCircle',
  '처리 상태 확인': 'ListChecks',
};

function fromFallback(): QuickActionView[] {
  return QUICK_ACTIONS.map((qa, idx) => ({
    id: `fallback-${idx}`,
    label: qa.label,
    description: qa.description,
    href: qa.href,
    icon: FALLBACK_ICON_NAMES[qa.label] ?? null,
  }));
}

export function QuickActions({ items }: { items?: QuickAction[] }) {
  const rows: QuickActionView[] =
    items && items.length > 0 ? items.map(fromDbRow) : fromFallback();

  return (
    <section
      aria-labelledby="quick-actions-heading"
      className="bg-slate-50/60 py-8 dark:bg-slate-900/40 sm:py-10"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5">
          <h2
            id="quick-actions-heading"
            className="text-lg font-bold tracking-tight sm:text-xl"
          >
            자주 찾는 작업
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            한 번에 처리하는 단축 메뉴입니다.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {rows.map((qa) => {
            const Icon = resolveIcon(qa.icon);
            return (
              <li key={qa.id}>
                <Link
                  href={qa.href}
                  className="group flex h-full items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-950/40 dark:text-brand-300 dark:group-hover:bg-brand-500 dark:group-hover:text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {qa.label}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                    </span>
                    {qa.description && (
                      <span className="text-xs leading-snug text-slate-500 dark:text-slate-400">
                        {qa.description}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
