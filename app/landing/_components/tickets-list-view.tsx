'use client';

/**
 * TicketsListView — 문의 내역 목록 시안.
 *
 * 상태 필터 탭(전체/접수/처리중/답변 보류/완료) + 검색 + 테이블(모바일 카드뷰) + 페이지네이션.
 * 시안용 정적 데이터. 행 클릭 시 상세(/landing/tickets/[no]).
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

type Status = 'received' | 'progress' | 'hold' | 'done';

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  received: { label: '접수', cls: 'border-[#217CF9] bg-[#EFF6FF] text-[#217CF9]' },
  progress: { label: '처리중', cls: 'border-[#8969EA] bg-[#F5F3FE] text-[#8969EA]' },
  hold: { label: '답변 보류', cls: 'border-[#D9A411] bg-[#FEF7E6] text-[#C2890E]' },
  done: { label: '답변 완료', cls: 'border-[#008A59] bg-[#E6F7F0] text-[#00A36B]' },
};

const FILTERS: { key: Status | 'all'; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'received', label: '접수' },
  { key: 'progress', label: '처리중' },
  { key: 'hold', label: '답변 보류' },
  { key: 'done', label: '완료' },
];

type Ticket = {
  no: string;
  date: string;
  status: Status;
  title: string;
  type: string;
  answeredAt: string | null;
};

const TICKETS: Ticket[] = [
  { no: 'AS-20260103-027', date: '2026-01-03', status: 'received', title: '문의 제목 입니다.', type: 'PMS-기능오류', answeredAt: null },
  { no: 'AS-20260103-026', date: '2026-01-03', status: 'received', title: '문의 제목 입니다.', type: 'PMS-기능오류', answeredAt: null },
  { no: 'AS-20260103-025', date: '2026-01-03', status: 'received', title: '문의 제목 입니다.', type: 'PMS-기능오류', answeredAt: null },
  { no: 'AS-20260103-024', date: '2026-01-03', status: 'received', title: '문의 제목 입니다.', type: 'PMS-기능오류', answeredAt: null },
  { no: 'AS-20260103-023', date: '2026-01-03', status: 'received', title: '문의 제목 입니다.', type: 'PMS-기능오류', answeredAt: null },
  { no: 'AS-20260103-022', date: '2026-01-03', status: 'progress', title: '문의 제목 입니다.', type: 'PMS-기능오류', answeredAt: null },
  { no: 'AS-20260103-021', date: '2026-01-03', status: 'hold', title: '문의 제목 입니다.', type: 'PMS-기능오류', answeredAt: null },
  { no: 'AS-20260103-020', date: '2026-01-03', status: 'done', title: '문의 제목 입니다.', type: 'PMS-기능오류', answeredAt: '2026-01-06' },
];

function StatusPill({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium min-w-[80px] ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

export function TicketsListView() {
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const rows = useMemo(
    () =>
      TICKETS.filter((t) => (filter === 'all' ? true : t.status === filter)).filter((t) =>
        query.trim() ? t.title.includes(query.trim()) || t.no.includes(query.trim()) : true,
      ),
    [filter, query],
  );

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[#1A1C20]">내 문의</h1>
        <Link
          href="/landing/inquiry"
          className="rounded-lg bg-[#00A36B] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#008A59]"
        >
          문의하기
        </Link>
      </div>

      {/* 필터 + 검색 */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setFilter(f.key);
                setPage(1);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-[#1A1C20] text-white'
                  : 'bg-[#F3F4F5] text-[#555D6D] hover:bg-[#e9eaec]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="flex h-[44px] w-full items-center gap-2 rounded-lg border border-[#DCDEE3] bg-white px-4 sm:w-[300px]">
          <Search className="h-4 w-4 shrink-0 text-[#868B94]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색어를 입력해 주세요"
            className="w-full bg-transparent text-sm text-[#1A1C20] placeholder:text-[#B0B3BA] focus:outline-none"
          />
        </label>
      </div>

      {/* 데스크톱 테이블 */}
      <div className="hidden overflow-hidden rounded-xl border border-black/[0.06] sm:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/[0.06] text-sm text-[#868B94]">
              <th className="px-5 py-3 text-left font-medium">문의일</th>
              <th className="px-5 py-3 text-left font-medium">처리 상태</th>
              <th className="px-5 py-3 text-left font-medium">제목</th>
              <th className="px-5 py-3 text-left font-medium">문의 유형</th>
              <th className="px-5 py-3 text-right font-medium">답변일</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.no} className="border-b border-black/[0.06] text-sm last:border-b-0">
                <td className="px-5 py-4 text-[#555D6D]">{t.date}</td>
                <td className="px-5 py-4">
                  <StatusPill status={t.status} />
                </td>
                <td className="px-5 py-4">
                  <Link
                    href={`/landing/tickets/${t.no}`}
                    className="font-medium text-[#1A1C20] hover:text-[#00A36B]"
                  >
                    {t.title}
                  </Link>
                </td>
                <td className="px-5 py-4 text-[#555D6D]">{t.type}</td>
                <td className="px-5 py-4 text-right text-[#868B94]">{t.answeredAt ?? '-'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-sm text-[#868B94]">
                  조건에 맞는 문의가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드뷰 */}
      <ul className="flex flex-col gap-3 sm:hidden">
        {rows.map((t) => (
          <li key={t.no}>
            <Link
              href={`/landing/tickets/${t.no}`}
              className="flex flex-col gap-2 rounded-xl border border-black/[0.06] p-4"
            >
              <div className="flex items-center justify-between">
                <StatusPill status={t.status} />
                <span className="text-xs text-[#868B94]">{t.date}</span>
              </div>
              <span className="text-base font-semibold text-[#1A1C20]">{t.title}</span>
              <div className="flex items-center justify-between text-sm text-[#555D6D]">
                <span>{t.type}</span>
                <span className="text-[#868B94]">답변일 {t.answeredAt ?? '-'}</span>
              </div>
            </Link>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="rounded-xl border border-black/[0.06] px-5 py-16 text-center text-sm text-[#868B94]">
            조건에 맞는 문의가 없습니다.
          </li>
        )}
      </ul>

      {/* 페이지네이션 */}
      <div className="mt-8 flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#868B94] hover:bg-[#F3F4F5]"
          aria-label="이전"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {[1, 2, 3, 4, 5].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPage(p)}
            className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors ${
              page === p ? 'bg-[#1A1C20] text-white' : 'text-[#555D6D] hover:bg-[#F3F4F5]'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(5, p + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#868B94] hover:bg-[#F3F4F5]"
          aria-label="다음"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
