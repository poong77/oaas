'use client';

/**
 * LP-01 ① Hero + 통합 검색창 + ② 인기검색어 칩.
 *
 * - 검색 인풋은 모바일 풀폭, lg에서 max-w-2xl
 * - text-base 이상으로 iOS Safari 줌 방지
 * - Enter / 버튼 → /search?q=...
 * - 인기검색어 칩 클릭 → 같은 라우팅
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { POPULAR_KEYWORDS } from './_constants';

export function HomeHero() {
  const router = useRouter();
  const [q, setQ] = useState('');

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = q.trim();
    router.push(
      trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search',
    );
  }

  return (
    <section className="relative overflow-hidden border-b border-slate-200/70 bg-gradient-to-b from-brand-50/60 via-white to-white pb-10 pt-10 dark:border-slate-800 dark:from-brand-950/30 dark:via-slate-950 dark:to-slate-950 sm:pt-14">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 text-center sm:px-6 lg:px-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          <Sparkles className="h-3.5 w-3.5" />
          OA 통합 셀프 서비스
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl md:text-4xl">
          어떤 도움이 필요하세요?
        </h1>
        <p className="max-w-xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">
          PMS · CMS · Keyless · 키오스크 · 웹서비스 통합 도움말과 문의 접수 허브.
          궁금한 키워드를 입력하면 도움말·FAQ·공지·장애를 한 번에 검색합니다.
        </p>

        <form
          role="search"
          onSubmit={handleSubmit}
          className="w-full max-w-2xl"
        >
          <div className="relative flex w-full items-center">
            <Search
              className="pointer-events-none absolute left-4 h-5 w-5 text-slate-400 dark:text-slate-500"
              aria-hidden
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="어떤 도움이 필요하세요? (예: PMS 결제 오류)"
              aria-label="도움말 통합 검색"
              className="h-12 w-full rounded-full border border-slate-200 bg-white pl-12 pr-28 text-base shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-500 sm:h-14 sm:text-base"
            />
            <button
              type="submit"
              className="absolute right-1.5 inline-flex h-9 items-center rounded-full bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 sm:h-11 sm:px-5"
            >
              검색
            </button>
          </div>
        </form>

        <div className="flex w-full flex-col items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            인기 검색어
          </span>
          <ul className="flex flex-wrap items-center justify-center gap-2">
            {POPULAR_KEYWORDS.map((kw) => (
              <li key={kw}>
                <Link
                  href={`/search?q=${encodeURIComponent(kw)}`}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:bg-brand-950/50 dark:hover:text-brand-300 sm:text-sm"
                >
                  # {kw}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
