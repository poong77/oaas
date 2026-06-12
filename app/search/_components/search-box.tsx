'use client';

/**
 * /search 페이지 중앙 검색바 (2026-06-01 추가).
 *
 * 기존엔 검색바 없이 "상단 검색창에 입력하세요" 안내만 있어 막다른 길이었다.
 * GNB '도움말 찾기'로 진입한 사용자가 이 페이지에서 바로 검색할 수 있도록
 * 단일 검색바를 배치한다. 현재 검색어(q)를 기본값으로 채운다.
 */

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';

export function SearchBox({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = q.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl">
      <div className="relative flex w-full items-center">
        <Search
          className="pointer-events-none absolute left-4 h-5 w-5 text-slate-400 dark:text-slate-500"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="키워드를 입력하면 도움말·FAQ·공지·장애를 한 번에 검색합니다."
          aria-label="통합 검색"
          autoFocus
          className="h-12 w-full rounded-full border border-slate-200 bg-white pl-12 pr-32 text-base shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-500 sm:h-14 sm:pr-36"
        />
        <button
          type="submit"
          className="absolute right-1.5 inline-flex h-9 items-center rounded-full bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-500 sm:h-11 sm:px-5"
        >
          통합검색
        </button>
      </div>
    </form>
  );
}
