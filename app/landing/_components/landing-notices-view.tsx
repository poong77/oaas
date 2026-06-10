'use client';

/**
 * LandingNoticesView — 공지사항 목록 시안 (Figma node 43:72).
 *
 * 구성: 제목 + 필터 탭(전체/공지사항/서비스 장애/릴리즈) + 검색 + 리스트(배지·제목·날짜) + 페이지네이션.
 * 색상 토큰: brand #00A36B · text #1A1C20 / #555D6D · 배지 공지=#217CF9 / 장애=#FA342C / 릴리즈=#7C3AED
 */

import { useState } from 'react';
import Link from 'next/link';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { LandingHeader } from './landing-header';
import { LandingFooter } from './landing-footer';
import {
  NOTICE_BADGE as BADGE,
  type NoticeType,
  type LandingNotice,
} from './landing-notices-data';

const FILTERS: ('전체' | NoticeType)[] = ['전체', '공지사항', '서비스 장애', '릴리즈'];

// 시안 목록 — 각 행이 상세(/landing/notices/[id])로 열리도록 id 부여.
const NOTICES: LandingNotice[] = [
  { id: 1, type: '공지사항', title: '2026년 6월 3일 지방선거일 휴무 안내', date: '2026-01-03', body: [] },
  { id: 2, type: '서비스 장애', title: '아고다 장애 관련 안내', date: '2026-01-03', body: [] },
  { id: 3, type: '릴리즈', title: 'v1.1.0 릴리즈 노트 — 이슈 클레임 UX 개선', date: '2026-01-03', body: [] },
  { id: 4, type: '공지사항', title: '2026년 6월 3일 지방선거일 휴무 안내', date: '2026-01-03', body: [] },
  { id: 5, type: '공지사항', title: '2026년 6월 3일 지방선거일 휴무 안내', date: '2026-01-03', body: [] },
  { id: 6, type: '공지사항', title: '2026년 6월 3일 지방선거일 휴무 안내', date: '2026-01-03', body: [] },
  { id: 7, type: '서비스 장애', title: '아고다 장애 관련 안내', date: '2026-01-03', body: [] },
  { id: 8, type: '릴리즈', title: 'v1.1.0 릴리즈 노트 — 이슈 클레임 UX 개선', date: '2026-01-03', body: [] },
  { id: 9, type: '공지사항', title: '2026년 6월 3일 지방선거일 휴무 안내', date: '2026-01-03', body: [] },
  { id: 10, type: '공지사항', title: '2026년 6월 3일 지방선거일 휴무 안내', date: '2026-01-03', body: [] },
];

const PAGES = [1, 2, 3, 4, 5];

export function LandingNoticesView() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('전체');
  const [page, setPage] = useState(1);

  const rows =
    filter === '전체' ? NOTICES : NOTICES.filter((n) => n.type === filter);

  return (
    <div className="min-h-screen bg-white font-sans text-[#1A1C20]">
      <LandingHeader variant="authed" />

      <main className="mx-auto max-w-[1200px] px-5 py-10">
        <h1 className="text-[28px] font-bold tracking-tight">공지사항</h1>

        {/* 필터 탭 + 검색 */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => {
              const active = f === filter;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setFilter(f);
                    setPage(1);
                  }}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#1A1C20] text-white'
                      : 'bg-[#F1F3F5] text-[#555D6D] hover:bg-[#E5E8EB]'
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
          <label className="flex w-full items-center gap-2 rounded-lg border border-[#DCDEE3] bg-[#F7F8F9] px-4 py-2.5 focus-within:border-[#00A36B] sm:w-80">
            <Search className="h-4 w-4 shrink-0 text-[#868B94]" />
            <input
              type="search"
              placeholder="검색어를 입력해 주세요"
              className="w-full bg-transparent text-sm text-[#1A1C20] placeholder:text-[#B0B3BA] focus:outline-none"
            />
          </label>
        </div>

        {/* 리스트 */}
        <ul className="mt-6 border-t border-[#E5E7EB]">
          {rows.map((n) => (
            <li key={n.id} className="border-b border-[#E5E7EB]">
              <Link
                href={`/landing/notices/${n.id}`}
                className="flex flex-col gap-2 px-2 py-4 transition-colors hover:bg-[#F7F8F9] sm:flex-row sm:items-center sm:gap-5"
              >
                <span
                  className={`inline-flex w-fit shrink-0 items-center justify-center rounded-md px-2 py-0.5 text-xs font-medium ${BADGE[n.type]}`}
                >
                  {n.type}
                </span>
                <span className="flex-1 truncate text-sm font-medium text-[#1A1C20]">
                  {n.title}
                </span>
                <span className="shrink-0 text-xs text-[#B0B3BA]">{n.date}</span>
              </Link>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="py-16 text-center text-sm text-[#868B94]">
              해당 유형의 공지가 없습니다.
            </li>
          )}
        </ul>

        {/* 페이지네이션 */}
        <div className="mt-8 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#868B94] hover:bg-[#F1F3F5] disabled:opacity-40"
            disabled={page === 1}
            aria-label="이전"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {PAGES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-[#1A1C20] text-white'
                  : 'text-[#555D6D] hover:bg-[#F1F3F5]'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(PAGES.length, p + 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#868B94] hover:bg-[#F1F3F5] disabled:opacity-40"
            disabled={page === PAGES.length}
            aria-label="다음"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
