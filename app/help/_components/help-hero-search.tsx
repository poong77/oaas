'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function HelpHeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className="rounded-2xl border border-brand-200 bg-brand-50/70 p-5 dark:border-brand-900 dark:bg-brand-950/40 sm:p-6"
    >
      <label
        htmlFor="help-hero-q"
        className="block text-sm font-bold text-brand-800 dark:text-brand-200"
      >
        필요한 도움말을 빠르게 찾아보세요
      </label>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            aria-hidden
          />
          <input
            id="help-hero-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="예: 결제 오류, 카드키 발급, SSL 갱신"
            className="h-11 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-500"
          />
        </div>
        <Button type="submit" size="lg" className="sm:px-6">
          검색
        </Button>
      </div>
    </form>
  );
}
