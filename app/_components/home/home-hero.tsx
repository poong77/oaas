'use client';

/**
 * LP-01 Hero — 7:5 그리드 + 우측 sidebar 슬롯.
 *
 * - 좌측 (lg:col-span-7): 배지 + 통합검색 + 인기검색어 칩
 * - 우측 (lg:col-span-5): sidebar prop (서비스 상태 + 최근 업데이트 박스)
 * - 모바일/태블릿(< lg): 세로 스택 (좌 → 우 순서)
 * - text-base 이상으로 iOS Safari 줌 방지
 * - Enter / 버튼 → /search?q=...
 *
 * sidebar는 async 서버 컴포넌트이므로 부모(page.tsx)에서 렌더된 노드를 prop으로 전달받는다.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Plus, Search } from 'lucide-react';
import { POPULAR_KEYWORDS } from './_constants';

export function HomeHero({
  sidebar,
  keywords,
  canManage,
}: {
  sidebar?: ReactNode;
  /** 인기검색어 칩. 미전달 시 하드코딩 fallback. */
  keywords?: string[];
  /** 매니저·어드민이면 칩 끝에 인기검색어 관리(+) 버튼 노출. */
  canManage?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const popular =
    keywords && keywords.length > 0 ? keywords : POPULAR_KEYWORDS;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = q.trim();
    router.push(
      trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search',
    );
  }

  return (
    <section className="relative overflow-hidden border-b border-slate-200/70 bg-white pb-10 pt-10 dark:border-slate-800 dark:bg-slate-950 sm:pt-14">
      <div
        className={`mx-auto grid w-full gap-8 px-4 sm:px-6 lg:gap-10 lg:px-8 ${
          sidebar ? 'max-w-[1200px] lg:grid-cols-12' : 'max-w-3xl'
        }`}
      >
        {/* 검색 영역 — sidebar 있으면 좌측 7칸, 없으면 중앙 정렬 */}
        <div
          className={`flex flex-col gap-6 ${
            sidebar
              ? 'items-center text-center lg:col-span-7 lg:items-start lg:text-left'
              : 'items-center text-center'
          }`}
        >
          <h1 className="text-display-medium-bold tracking-tight text-slate-900 dark:text-white">
            무엇을 도와드릴까요?
          </h1>

          <form role="search" onSubmit={handleSubmit} className="w-full">
            <div className="relative flex w-full items-center">
              <Search
                className="pointer-events-none absolute left-4 h-5 w-5 text-slate-400 dark:text-slate-500"
                aria-hidden
              />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="궁금한 키워드를 입력하면 도움말·FAQ·공지·장애를 한 번에 검색합니다."
                aria-label="도움말 통합 검색"
                className="h-12 w-full rounded-full border border-slate-200 bg-white pl-12 pr-36 text-base shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-500 sm:h-14 sm:pr-40 sm:text-base"
              />
              <button
                type="submit"
                className="absolute right-1.5 inline-flex h-9 items-center rounded-full bg-brand-600 px-4 text-label-medium-semibold text-white shadow-sm hover:bg-brand-500 sm:h-11 sm:px-5"
              >
                통합검색
              </button>
            </div>
          </form>

          <ul className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            {popular.map((kw) => (
              <li key={kw}>
                <Link
                  href={`/search?q=${encodeURIComponent(kw)}`}
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-label-small-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:text-slate-400 dark:hover:bg-brand-950/50 dark:hover:text-brand-300 sm:text-label-medium-medium"
                >
                  # {kw}
                </Link>
              </li>
            ))}
            {canManage && (
              <li>
                <Link
                  href="/admin/master/popular-keywords"
                  title="인기검색어 관리"
                  aria-label="인기검색어 관리"
                  className="inline-flex items-center justify-center rounded-full border border-dashed border-brand-300 bg-brand-50 p-1.5 text-brand-600 hover:border-brand-500 hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/50"
                >
                  <Plus className="h-4 w-4" />
                </Link>
              </li>
            )}
          </ul>
        </div>

        {/* 우측: sidebar 슬롯 (lg:col-span-5) */}
        {sidebar && (
          <div className="flex flex-col lg:col-span-5">{sidebar}</div>
        )}
      </div>
    </section>
  );
}
