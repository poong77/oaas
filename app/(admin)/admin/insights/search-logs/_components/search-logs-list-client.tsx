'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTimeKst } from '@/lib/business-hours/format';
import type { HelpfulTally, SearchLogRow } from '@/lib/services/search-logs';

/** 초 → "1시간 2분" / "3분 12초" / "8초" / "—". */
function formatDwell(sec: number | null): string {
  if (sec == null) return '—';
  if (sec <= 0) return '0초';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

/** 도착 페이지(아티클/FAQ) 하단 도움됐어요/아니예요 반응표. */
function Helpful({ tally }: { tally: HelpfulTally | null }) {
  if (!tally) return <span className="text-xs text-slate-400">—</span>;
  if (tally.yes === 0 && tally.no === 0) {
    return <span className="text-xs text-slate-400">반응 없음</span>;
  }
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
        <ThumbsUp className="h-3.5 w-3.5" />
        {tally.yes}
      </span>
      <span className="inline-flex items-center gap-0.5 text-rose-500">
        <ThumbsDown className="h-3.5 w-3.5" />
        {tally.no}
      </span>
    </span>
  );
}

function Outflow({ row }: { row: SearchLogRow }) {
  if (!row.outflowLabel) {
    return <span className="text-xs text-slate-400">— (이탈)</span>;
  }
  if (!row.outflowUrl) {
    return <span className="text-xs text-slate-500">{row.outflowLabel}</span>;
  }
  return (
    <Link
      href={row.outflowUrl}
      target="_blank"
      className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-300"
      title={row.outflowUrl}
    >
      <ExternalLink className="h-3 w-3 shrink-0" />
      <span className="truncate">{row.outflowUrl}</span>
    </Link>
  );
}

export function SearchLogsListClient({
  items,
  total,
  page,
  pageSize,
}: {
  items: SearchLogRow[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  function go(p: number) {
    const next = new URLSearchParams(sp.toString());
    next.set('page', String(p));
    router.push(`/admin/insights/search-logs?${next.toString()}`);
  }

  return (
    <>
      {/* 데스크탑 */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">유입 키워드</th>
              <th className="px-3 py-2 text-left">유입일시</th>
              <th className="px-3 py-2 text-right">세션 체류</th>
              <th className="px-3 py-2 text-left">도움됨 (반응표)</th>
              <th className="px-3 py-2 text-left">유출 채널 (페이지 URL)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-medium">{r.query}</td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {formatDateTimeKst(r.createdAt)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                  {formatDwell(r.dwellSeconds)}
                </td>
                <td className="px-3 py-2">
                  <Helpful tally={r.helpful} />
                </td>
                <td className="max-w-xs px-3 py-2">
                  <Outflow row={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드뷰 */}
      <div className="flex flex-col gap-2 p-3 md:hidden">
        {items.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold">{r.query}</span>
              <Helpful tally={r.helpful} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span>{formatDateTimeKst(r.createdAt)}</span>
              <span>체류 {formatDwell(r.dwellSeconds)}</span>
            </div>
            <div className="text-xs">
              <span className="text-slate-400">유출 · </span>
              <Outflow row={r} />
            </div>
          </div>
        ))}
      </div>

      {/* 페이지네이션 */}
      {lastPage > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-3 py-3 text-sm dark:border-slate-800">
          <div className="text-xs text-slate-500">
            {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} /{' '}
            {total}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => go(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              이전
            </Button>
            <span className="px-2 text-sm font-medium">
              {page} / {lastPage}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= lastPage}
              onClick={() => go(page + 1)}
            >
              다음
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
