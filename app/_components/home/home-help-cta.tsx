/**
 * LP-01 ⑤ CTA — 도움말로 해결 못했을 때 1:1 문의 유도 (시안 구조, 2026-06-10).
 */

import Link from 'next/link';

export function HomeHelpCta() {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 pb-12 pt-10 sm:px-6 lg:px-8 sm:pt-14">
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-brand-50 p-8 dark:bg-brand-950/30 sm:flex-row sm:items-center sm:p-10">
        <div className="flex flex-col gap-1">
          <h3 className="text-heading-small-bold text-slate-900 dark:text-white sm:text-heading-medium-bold">
            도움말을 통해 문제를 해결하지 못하셨나요?
          </h3>
          <p className="text-body-medium-regular text-slate-600 dark:text-slate-300">
            궁금한 사항을 문의주시면 성실하게 답변드립니다.
          </p>
        </div>
        <Link
          href="/tickets/new"
          className="shrink-0 rounded-lg bg-brand-600 px-6 py-3.5 text-label-large-semibold text-white transition-colors hover:bg-brand-500"
        >
          문의하기
        </Link>
      </div>
    </section>
  );
}
