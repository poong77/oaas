'use client';

/**
 * LP-01 Hero — "무엇을 도와드릴까요?" + 통합검색 + 인기검색어.
 *
 * - 콘텐츠 프레임은 다른 섹션과 동일하게 max-w-[1200px]로 고정.
 * - 내부 제목·검색·키워드는 중앙 컬럼(max-w-3xl)으로 가운데 정렬.
 * - text-base 이상으로 iOS Safari 줌 방지.
 * - Enter / 버튼 → /search?q=...
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Plus, Search } from 'lucide-react';
import { POPULAR_KEYWORDS } from './_constants';

export function HomeHero({
  keywords,
  canManage,
}: {
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
    <section className="relative overflow-hidden bg-white pb-10 pt-10 dark:bg-slate-950 sm:pt-14">
      {/* 콘텐츠 프레임 — 다른 섹션과 동일한 1200px 고정 */}
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
        {/* 제목·검색·키워드 — 1200px 안에서 중앙 컬럼(가운데 정렬) */}
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <h1 className="text-display-medium-bold tracking-tight text-slate-900 dark:text-white">
            무엇을 도와드릴까요?
          </h1>

          {/* 검색창 + 추천 키워드 — 둘 사이 간격 12px(gap-3) */}
          <div className="flex w-full flex-col gap-3">
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
                  className="h-12 w-full rounded-full border border-slate-200 bg-white pl-12 pr-36 text-base placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-500 sm:h-14 sm:pr-40 sm:text-base"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 inline-flex h-9 items-center rounded-full bg-brand-600 px-4 text-label-medium-semibold text-white hover:bg-brand-500 sm:h-11 sm:px-5"
                >
                  통합검색
                </button>
              </div>
            </form>

            {/* 추천 키워드 — 한 줄 고정(넘치면 가로 스크롤) */}
            <ul className="flex flex-nowrap items-center justify-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {popular.map((kw) => (
                <li key={kw} className="shrink-0">
                  <Link
                    href={`/search?q=${encodeURIComponent(kw)}`}
                    className="inline-flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-label-small-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:text-slate-400 dark:hover:bg-brand-950/50 dark:hover:text-brand-300 sm:text-label-medium-medium"
                  >
                    # {kw}
                  </Link>
                </li>
              ))}
              {canManage && (
                <li className="shrink-0">
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
        </div>
      </div>
    </section>
  );
}
