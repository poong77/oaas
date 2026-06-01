/**
 * LP-01 ② 빠른 행동 — 2갈래 택1 (2026-06-01 UX 재구성).
 *
 * 기존 "자주 찾는 작업(5)" + "CTA(3)"의 접수 동선 중복을 제거하고,
 * 호텔리어의 1순위 행동을 두 갈래로 단순화한다.
 *   - 답 찾기  → /search (FAQ·제품별 가이드 통합 검색)
 *   - 문의하기 → /tickets/new (오류·기능문의 접수)
 * 그 아래 "내 문의 조회"(/tickets) 보조 링크 1개.
 *
 * 계정 작업(비밀번호·솔루션 링크·직원 추가)은 프로필(/profile)로 이동.
 */

import Link from 'next/link';
import { Search, PencilLine, ArrowRight, ListChecks } from 'lucide-react';

export function HomeQuickChoice() {
  return (
    <section
      aria-labelledby="quick-choice-heading"
      className="bg-slate-50/60 py-8 dark:bg-slate-900/40 sm:py-10"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5">
          <h2
            id="quick-choice-heading"
            className="text-lg font-bold tracking-tight sm:text-xl"
          >
            무엇을 하시겠어요?
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            답을 찾거나, 바로 문의를 접수하세요.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* 답 찾기 */}
          <Link
            href="/search"
            className="group flex h-full flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-100 hover:shadow-md dark:border-brand-800 dark:bg-brand-950/40 dark:hover:bg-brand-900/40"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm dark:bg-brand-500">
              <Search className="h-5 w-5" />
            </span>
            <span className="flex items-center gap-1.5 text-base font-semibold text-brand-900 dark:text-brand-100">
              답 찾기
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
            <span className="text-sm leading-snug text-brand-900/80 dark:text-brand-100/80">
              FAQ · 제품별 가이드를 한 번에 검색합니다.
            </span>
          </Link>

          {/* 문의하기 */}
          <Link
            href="/tickets/new"
            className="group flex h-full flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-red-100 hover:shadow-md dark:border-red-900/60 dark:bg-red-950/30 dark:hover:bg-red-900/40"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white shadow-sm">
              <PencilLine className="h-5 w-5" />
            </span>
            <span className="flex items-center gap-1.5 text-base font-semibold text-red-900 dark:text-red-100">
              문의하기
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
            <span className="text-sm leading-snug text-red-900/80 dark:text-red-100/80">
              오류·기능문의를 새 티켓으로 접수합니다.
            </span>
          </Link>
        </div>

        {/* 내 문의 조회 보조 링크 */}
        <div className="mt-3 flex justify-center">
          <Link
            href="/tickets"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ListChecks className="h-4 w-4" />
            이미 접수한 문의의 처리 상태 확인
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
