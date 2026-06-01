/**
 * /admin/search-quality/usage — 검색 실사용 지표 (Layer B).
 *
 * 실제 사용자 검색 로그 기반 온라인 지표:
 *   - 0건 검색률 + 0건 top 질의 (콘텐츠/동의어 갭)
 *   - CTR(클릭률) · 평균 클릭 위치
 *   - 검색→접수 전환율 / 자가해결 추정(deflection)
 */

import Link from 'next/link';
import { ArrowLeft, MousePointerClick, SearchX, Ticket } from 'lucide-react';
import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  getUsageStats,
  topQueries,
  topZeroQueries,
} from '@/lib/services/search-logs';

export const dynamic = 'force-dynamic';
export const metadata = { title: '검색 사용 지표 — OA 통합 AS' };

const WINDOW_DAYS = 30;

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export default async function SearchUsagePage() {
  await requireRole(['manager', 'admin']);

  const [stats, zeroQ, topQ] = await Promise.all([
    getUsageStats(WINDOW_DAYS),
    topZeroQueries(WINDOW_DAYS, 30),
    topQueries(WINDOW_DAYS, 30),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="검색 사용 지표"
        description={`실제 사용자 검색 로그 기반 (최근 ${WINDOW_DAYS}일). 0건율·CTR·접수 전환율로 검색이 제 역할을 하는지 확인합니다.`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/search-quality">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              평가 대시보드
            </Link>
          </Button>
        }
      />

      {stats.totalSearches === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<SearchX className="h-6 w-6" />}
              title="아직 검색 로그가 없습니다"
              description="사용자가 /search에서 검색하면 이곳에 0건율·클릭률·접수 전환율이 집계됩니다."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="총 검색 수"
              value={stats.totalSearches.toLocaleString()}
              hint={`최근 ${WINDOW_DAYS}일`}
            />
            <Stat
              label="0건 검색률"
              value={pct(stats.zeroRate)}
              hint={`${stats.zeroResults}건 — 낮을수록 좋음`}
              icon={<SearchX className="h-4 w-4" />}
              tone={stats.zeroRate > 0.15 ? 'bad' : 'ok'}
            />
            <Stat
              label="CTR (클릭률)"
              value={pct(stats.ctr)}
              hint={
                stats.avgClickPosition != null
                  ? `평균 클릭 ${stats.avgClickPosition.toFixed(1)}위`
                  : '클릭 없음'
              }
              icon={<MousePointerClick className="h-4 w-4" />}
            />
            <Stat
              label="자가해결 추정"
              value={pct(stats.deflectionRate)}
              hint={`접수 전환 ${pct(stats.ticketRate)}`}
              icon={<Ticket className="h-4 w-4" />}
              tone="ok"
            />
          </section>

          <p className="text-xs text-slate-500">
            * 자가해결 추정(deflection) = 검색 후 문의 접수로 넘어가지 않은
            비율. 검색→접수 전환은 검색 결과의 &quot;문의 접수&quot; 버튼
            클릭으로 측정.
          </p>

          <QueryTable
            title="🚫 0건 검색어 (콘텐츠·동의어 갭)"
            hint="결과가 없던 검색 — 아티클/FAQ 신설 또는 동의어 등록 후보"
            rows={zeroQ}
            emptyText="0건 검색이 없습니다. 👍"
            danger
          />
          <QueryTable
            title="🔥 인기 검색어"
            hint="가장 많이 검색된 질의"
            rows={topQ}
            emptyText="데이터 없음"
          />
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
  tone = 'slate',
}: {
  label: string;
  value: string;
  hint: string;
  icon?: React.ReactNode;
  tone?: 'slate' | 'ok' | 'bad';
}) {
  const valueClass =
    tone === 'bad'
      ? 'text-red-600 dark:text-red-400'
      : tone === 'ok'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-slate-900 dark:text-slate-100';
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          {icon}
          {label}
        </span>
        <span className={`text-2xl font-bold ${valueClass}`}>{value}</span>
        <span className="text-xs text-slate-400">{hint}</span>
      </CardContent>
    </Card>
  );
}

function QueryTable({
  title,
  hint,
  rows,
  emptyText,
  danger,
}: {
  title: string;
  hint: string;
  rows: { query: string; count: number; avgResults: number }[];
  emptyText: string;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <span className="text-xs text-slate-400">{hint}</span>
        </div>
        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            {emptyText}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => (
              <li
                key={r.query}
                className="flex items-center justify-between gap-3 p-3 px-4"
              >
                <span className="truncate text-sm text-slate-800 dark:text-slate-200">
                  {r.query}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {!danger && (
                    <span className="text-xs text-slate-400">
                      평균 {r.avgResults.toFixed(0)}건
                    </span>
                  )}
                  <Badge tone={danger ? 'danger' : 'slate'}>{r.count}회</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
