/**
 * /admin/insights/search-logs — 검색로그 (인사이트).
 *
 * 매니저+어드민. 호텔리어의 실사용 검색을 1행=1회로 나열:
 *   유입 키워드 · 유입일시 · 세션 체류시간 · 도움됨 여부 · 유출 채널(페이지 URL).
 * 기간 필터: 어제(1일) / 최근 7일 / 최근 30일 (모두 어제를 끝으로 — 오늘은 집계 진행 중이라 제외).
 */

import { Search } from 'lucide-react';
import {
  listSearchLogs,
  type SearchLogPeriod,
} from '@/lib/services/search-logs';
import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchLogsFilters } from './_components/search-logs-filters';
import { SearchLogsListClient } from './_components/search-logs-list-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: '검색로그 — OA서포트 어드민' };

const VALID_PERIODS: SearchLogPeriod[] = ['today', 'yesterday', '7d', '30d'];
const PERIOD_LABEL: Record<SearchLogPeriod, string> = {
  today: '오늘 (실시간)',
  yesterday: '어제 (1일)',
  '7d': '최근 7일',
  '30d': '최근 30일',
};

type SearchParams = Promise<{ period?: string; page?: string }>;

export default async function SearchLogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(['manager', 'admin']);
  const sp = await searchParams;
  const period: SearchLogPeriod = VALID_PERIODS.includes(
    sp.period as SearchLogPeriod,
  )
    ? (sp.period as SearchLogPeriod)
    : 'today';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const { items, total, pageSize, stats } = await listSearchLogs({
    period,
    page,
    pageSize: 30,
  });

  const ctr =
    stats.total > 0 ? Math.round((stats.clicks / stats.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="검색로그"
        description={`${PERIOD_LABEL[period]} 동안의 호텔리어 검색 이력 ${total.toLocaleString()}건. 유입 키워드부터 유출 페이지까지 한눈에.`}
      />

      <SearchLogsFilters period={period} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="검색 수" value={stats.total} />
        <StatCard
          label="결과 클릭"
          value={stats.clicks}
          sub={`CTR ${ctr}%`}
          tone="success"
        />
        <StatCard label="티켓 전환" value={stats.ticket} tone="danger" />
        <StatCard label="결과없음" value={stats.zero} tone="warn" />
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Search className="h-6 w-6" />}
                title="이 기간에 검색 이력이 없습니다"
                description="기간을 넓혀 보거나, 호텔리어 검색이 쌓이면 여기에 표시됩니다."
              />
            </div>
          ) : (
            <SearchLogsListClient
              items={items}
              total={total}
              page={page}
              pageSize={pageSize}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone = 'slate',
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: 'slate' | 'success' | 'danger' | 'warn';
}) {
  const valueClass =
    tone === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'danger'
        ? 'text-rose-600 dark:text-rose-400'
        : tone === 'warn'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-slate-900 dark:text-slate-100';
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className="flex items-baseline gap-1.5">
          <span className={`text-2xl font-bold ${valueClass}`}>
            {value.toLocaleString()}
          </span>
          {sub && (
            <span className="text-xs font-medium text-slate-400">{sub}</span>
          )}
        </span>
      </CardContent>
    </Card>
  );
}
