/**
 * /admin/master/search-quality — 검색 골든셋·품질 (마스터).
 *
 * 한 페이지 통합:
 *   - 순위 버킷 대시보드 (≤4위 / ≤8위 / ≥9위 / 정답없음)  [#5]
 *   - 순위 측정 실행 (10배치 프로그레스바)               [#3]
 *   - 골든셋 100문항 리스트 — 최신 순위 + 지난 3회 추세 + 실사용 지표  [#4]
 *   - 수기 입력 + AI 추천 (검색이력 / 문제해결 문서)       [#1]
 *   - 실사용 퍼널 (노출→클릭→접수)                       [#6]
 */

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { normalizeTerm } from '@/lib/text/normalize';
import {
  computeBuckets,
  getLatestRun,
  getRankHistory,
  listEvalQueries,
  listEvalQueryIds,
} from '@/lib/services/search-eval';
import {
  getFunnelStats,
  getUsageByQueries,
  topZeroQueries,
} from '@/lib/services/search-logs';
import { GoldenBoard, type GoldenRow } from './_components/golden-board';
import { FunnelSection } from './_components/funnel-section';
import { ZeroQueriesCard } from './_components/zero-queries-card';

export const dynamic = 'force-dynamic';
export const metadata = { title: '검색 골든셋·품질 — OA서포트 어드민' };

export default async function MasterSearchQualityPage() {
  const user = await requireRole(['manager', 'admin']);
  const isAdmin = user.role === 'admin';

  const [queries, latest, history, funnel, queryIds, zeroQueries] =
    await Promise.all([
      listEvalQueries(),
      getLatestRun(),
      getRankHistory(4),
      getFunnelStats(90),
      listEvalQueryIds(),
      topZeroQueries(90, 20),
    ]);

  const buckets = computeBuckets(latest);

  // 실사용 조인 — 골든셋 질의의 normalized 키로 로그 지표 매핑
  const normMap = new Map<string, string>(); // queryId → normalized
  for (const q of queries) normMap.set(q.id, normalizeTerm(q.query));
  const usage = await getUsageByQueries(
    Array.from(new Set(normMap.values())),
    90,
  );

  const rows: GoldenRow[] = queries.map((q) => {
    const hist = history.byQuery[q.id] ?? [];
    const latestRank = hist.length > 0 ? hist[hist.length - 1] : null;
    const trend = hist.slice(0, -1); // 지난 회차들
    const u = usage[normMap.get(q.id)!];
    return {
      id: q.id,
      query: q.query,
      expectedArticleSlugs: q.expectedArticleSlugs,
      expectedFaqIds: q.expectedFaqIds,
      note: q.note,
      source: q.source,
      latestRank: latestRank ?? null,
      trend,
      usage: u
        ? {
            searches: u.searches,
            ctr: u.ctr,
            ticketRate: u.ticketRate,
            avgClickPosition: u.avgClickPosition,
          }
        : null,
    };
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="검색 골든셋·품질"
        description="자주 묻는 질문(정답셋)을 검색에 돌려 순위를 측정합니다. 정답이 상위에 뜨는지 수치로 확인하고, 실사용 퍼널과 함께 봅니다."
      />

      {/* #5 버킷 대시보드 */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BucketCard
          label="상위 4위 이내"
          value={buckets.top4}
          total={buckets.total}
          tone="ok"
        />
        <BucketCard
          label="5~8위"
          value={buckets.top8}
          total={buckets.total}
          tone="warn"
        />
        <BucketCard
          label="9위 이하"
          value={buckets.rest}
          total={buckets.total}
          tone="bad"
        />
        <BucketCard
          label="정답 못 찾음"
          value={buckets.none}
          total={buckets.total}
          tone="bad"
        />
      </section>

      {/* #3 측정 + #1 입력/추천 + #4 리스트 (클라이언트) */}
      <GoldenBoard
        rows={rows}
        queryIds={queryIds}
        runCount={history.runs.length}
      />

      {/* #6 실사용 퍼널 */}
      <FunnelSection funnel={funnel} />

      {/* #D 0건 검색어 → 동의어/FAQ 보강 닫힌 루프 (v1.7) */}
      <ZeroQueriesCard rows={zeroQueries} canManageSynonyms={isAdmin} />
    </div>
  );
}

function BucketCard({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: 'ok' | 'warn' | 'bad';
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const cls =
    tone === 'ok'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`text-2xl font-bold ${cls}`}>
          {value}
          <span className="ml-1 text-sm font-normal text-slate-400 dark:text-slate-500">
            / {total} ({pct}%)
          </span>
        </span>
      </CardContent>
    </Card>
  );
}
