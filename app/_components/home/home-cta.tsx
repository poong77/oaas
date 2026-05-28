/**
 * LP-01 ⑧ CTA — 일반 접수 / 오류 접수 / 내 문의.
 *
 * 실 페이지(Phase 5/6)는 placeholder 상태이지만 라우팅은 정상 연결.
 */

import Link from 'next/link';
import { AlertCircle, HelpCircle, ListChecks } from 'lucide-react';
import { HOME_CTAS } from './_constants';
import { cn } from '@/lib/utils';

const ICON_BY_LABEL = {
  '일반 접수': HelpCircle,
  '오류 접수': AlertCircle,
  '내 문의': ListChecks,
} as const;

const STYLES_BY_TONE = {
  primary:
    'border-brand-200 bg-brand-50 text-brand-900 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-100 dark:hover:bg-brand-900/40',
  danger:
    'border-red-200 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100 dark:hover:bg-red-900/40',
  secondary:
    'border-slate-200 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
} as const;

const ICON_TONE = {
  primary:
    'bg-brand-600 text-white dark:bg-brand-500',
  danger: 'bg-red-600 text-white',
  secondary: 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900',
} as const;

export function HomeCTA() {
  return (
    <section
      aria-labelledby="cta-heading"
      className="bg-slate-50/60 py-8 dark:bg-slate-900/40 sm:py-10"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5">
          <h2
            id="cta-heading"
            className="text-lg font-bold tracking-tight sm:text-xl"
          >
            바로 시작하기
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            상황에 맞는 접수 / 조회 메뉴를 선택하세요.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {HOME_CTAS.map((cta) => {
            const Icon =
              ICON_BY_LABEL[cta.label as keyof typeof ICON_BY_LABEL];
            return (
              <li key={cta.label}>
                <Link
                  href={cta.href}
                  className={cn(
                    'group flex h-full flex-col gap-3 rounded-xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                    STYLES_BY_TONE[cta.tone],
                  )}
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full shadow-sm',
                      ICON_TONE[cta.tone],
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-base font-semibold">{cta.label}</span>
                  <span className="text-sm leading-snug opacity-80">
                    {cta.description}
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
