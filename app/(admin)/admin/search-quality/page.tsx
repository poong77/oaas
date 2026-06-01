/**
 * /admin/search-quality — 검색 품질 평가 대시보드 (Layer A).
 *
 * 골든셋(정답셋)을 실제 검색에 돌려 Hit@1/Hit@3/MRR/nDCG@5를 수치화한다.
 * "100문항이 top3에 뜨는가"를 숫자로 확인하고, 랭킹 변경 전후를 비교하는
 * 회귀 테스트 용도.
 */

import Link from 'next/link';
import {
  Activity,
  Gauge,
  ListChecks,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDateKst } from '@/lib/business-hours/format';
import {
  countEvalQueries,
  getLatestRun,
  listRuns,
} from '@/lib/services/search-eval';
import type { SearchEvalRun } from '@/db/schema';
import { EvalControls } from './_components/eval-controls';

export const dynamic = 'force-dynamic';
export const metadata = { title: '검색 품질 — OA 통합 AS' };

const JUDGE_LABEL: Record<string, string> = {
  label: '라벨',
  llm: 'LLM 채점',
  hybrid: '하이브리드',
};

function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}
function f3(x: number): string {
  return x.toFixed(3);
}

export default async function SearchQualityPage() {
  await requireRole(['manager', 'admin']);

  const [goldenCount, runs] = await Promise.all([
    countEvalQueries(),
    listRuns(10),
  ]);
  const latest = runs[0] ?? null;
  const prev = runs[1] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="검색 품질 평가"
        description="골든셋(정답셋)을 실제 검색에 돌려 Hit@1·Hit@3·MRR·nDCG를 수치화합니다. 랭킹 변경 전후 비교용 회귀 테스트."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/search-quality/usage">
                <Activity className="mr-1.5 h-4 w-4" />
                사용 지표
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/search-quality/queries">
                <ListChecks className="mr-1.5 h-4 w-4" />
                골든셋 관리 ({goldenCount})
              </Link>
            </Button>
          </div>
        }
      />

      <EvalControls goldenCount={goldenCount} />

      {goldenCount === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Gauge className="h-6 w-6" />}
              title="골든셋이 비어 있습니다"
              description="먼저 정답셋을 만드세요. 기존 FAQ를 정답셋으로 시드하거나, AI로 아티클에서 테스트 질문을 생성할 수 있습니다. 위 버튼을 사용하세요."
            />
          </CardContent>
        </Card>
      ) : !latest ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Gauge className="h-6 w-6" />}
              title="아직 평가 실행 기록이 없습니다"
              description={`골든셋 ${goldenCount}건이 준비됐습니다. 위 "평가 실행" 버튼을 눌러 첫 점수를 확인하세요.`}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 점수 카드 */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ScoreCard
              label="Hit@1"
              hint="정답이 1위"
              value={pct(latest.hit1)}
              delta={prev ? latest.hit1 - prev.hit1 : null}
              deltaFmt={pct}
            />
            <ScoreCard
              label="Hit@3"
              hint="정답이 top3 (목표 ≥90%)"
              value={pct(latest.hit3)}
              delta={prev ? latest.hit3 - prev.hit3 : null}
              deltaFmt={pct}
              highlight
            />
            <ScoreCard
              label="MRR"
              hint="정답 평균 등수 역수"
              value={f3(latest.mrr)}
              delta={prev ? latest.mrr - prev.mrr : null}
              deltaFmt={f3}
            />
            <ScoreCard
              label="nDCG@5"
              hint="위치·등급 가중 랭킹 품질"
              value={f3(latest.ndcg)}
              delta={prev ? latest.ndcg - prev.ndcg : null}
              deltaFmt={f3}
            />
          </section>

          <p className="text-xs text-slate-500">
            최근 실행: {formatDateKst(latest.ranAt)} · 질의 {latest.queryCount}
            건 · 판정 {JUDGE_LABEL[latest.judgeMode]}
          </p>

          {/* 실패 질의 (top3 밖) */}
          <FailureTable run={latest} />

          {/* 실행 이력 */}
          <RunsHistory runs={runs} />
        </>
      )}
    </div>
  );
}

function ScoreCard({
  label,
  hint,
  value,
  delta,
  deltaFmt,
  highlight,
}: {
  label: string;
  hint: string;
  value: string;
  delta: number | null;
  deltaFmt: (x: number) => string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-brand-300 dark:border-brand-700' : ''}>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {value}
        </span>
        <div className="flex items-center gap-1.5">
          {delta !== null && Math.abs(delta) >= 0.0005 ? (
            <span
              className={`inline-flex items-center text-xs font-medium ${
                delta > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {delta > 0 ? (
                <TrendingUp className="mr-0.5 h-3 w-3" />
              ) : (
                <TrendingDown className="mr-0.5 h-3 w-3" />
              )}
              {delta > 0 ? '+' : ''}
              {deltaFmt(delta)}
            </span>
          ) : (
            <span className="text-xs text-slate-400">{hint}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FailureTable({ run }: { run: SearchEvalRun }) {
  const failures = run.details
    .filter((d) => !d.hitTop3)
    .sort((a, b) => a.ndcg - b.ndcg)
    .slice(0, 40);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            ⚠️ top3에 정답이 없는 질의 ({failures.length})
          </h2>
          <span className="text-xs text-slate-400">
            정답이 안 잡히는 질의 — 콘텐츠·키워드·동의어 보강 후보
          </span>
        </div>
        {failures.length === 0 ? (
          <div className="p-6 text-center text-sm text-emerald-600 dark:text-emerald-400">
            🎉 모든 질의가 top3 안에 정답을 띄웠습니다.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {failures.map((d) => (
              <li key={d.queryId} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {d.query}
                  </span>
                  {d.note && <Badge tone="slate">{d.note}</Badge>}
                  <Badge tone="danger">
                    {d.rankOfFirstRelevant
                      ? `${d.rankOfFirstRelevant}위`
                      : '정답 없음'}
                  </Badge>
                </div>
                {d.top[0] && (
                  <p className="mt-1 text-xs text-slate-500">
                    현재 1위:{' '}
                    <span className="text-slate-700 dark:text-slate-300">
                      {d.top[0].title}
                    </span>{' '}
                    (score {d.top[0].score})
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RunsHistory({ runs }: { runs: SearchEvalRun[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b border-slate-100 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            실행 이력
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500 dark:border-slate-800">
                <th className="p-3 font-medium">실행 시각</th>
                <th className="p-3 font-medium">판정</th>
                <th className="p-3 font-medium">질의</th>
                <th className="p-3 font-medium">Hit@1</th>
                <th className="p-3 font-medium">Hit@3</th>
                <th className="p-3 font-medium">MRR</th>
                <th className="p-3 font-medium">nDCG@5</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-50 last:border-0 dark:border-slate-800/50"
                >
                  <td className="p-3 text-slate-600 dark:text-slate-300">
                    {formatDateKst(r.ranAt)}
                  </td>
                  <td className="p-3">
                    <Badge tone="slate">{JUDGE_LABEL[r.judgeMode]}</Badge>
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">
                    {r.queryCount}
                  </td>
                  <td className="p-3 font-medium">{pct(r.hit1)}</td>
                  <td className="p-3 font-medium">{pct(r.hit3)}</td>
                  <td className="p-3 font-medium">{f3(r.mrr)}</td>
                  <td className="p-3 font-medium">{f3(r.ndcg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
