/**
 * /admin/insights/dashboard — 운영 인사이트 대시보드 (DI-01).
 *
 * 매니저+어드민. 셀프검색→문의→접수→Dev이관→완료 운영 흐름 모니터링.
 * 기간: 어제 / 7일 / 30일 (KST, 오늘 제외) · 제품 필터.
 */

import { AlertTriangle, Clock, Search, TriangleAlert } from 'lucide-react';
import { requireRole } from '@/lib/permissions';
import { loadCategoryLabelMaps } from '@/lib/services/tickets';
import {
  getDashboardData,
  DASHBOARD_PERIODS,
  PERIOD_LABEL,
  type DashboardPeriod,
} from '@/lib/services/insights';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { DashboardFilters } from './_components/dashboard-filters';
import {
  ChannelStackedChart,
  HotelBarChart,
  ProductPieChart,
  TypeBarChart,
  WordcloudChart,
} from './_components/dashboard-charts';

export const dynamic = 'force-dynamic';
export const metadata = { title: '운영 인사이트 — OA서포트 어드민' };

function pct(n: number, d: number): string {
  if (d <= 0) return '—';
  return `${Math.round((n / d) * 1000) / 10}%`;
}

export default async function InsightDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; product?: string }>;
}) {
  await requireRole(['manager', 'admin']);
  const sp = await searchParams;
  const period: DashboardPeriod = DASHBOARD_PERIODS.includes(
    sp.period as DashboardPeriod,
  )
    ? (sp.period as DashboardPeriod)
    : '30d';
  const productCode = sp.product?.trim() || null;

  const labels = await loadCategoryLabelMaps();
  const data = await getDashboardData({ period, productCode, labels });

  const products = Object.entries(labels.product).map(([code, label]) => ({
    code,
    label,
  }));

  const { actionCards, completion, funnel, statusDist, timeMetrics } = data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="운영 인사이트"
        description={`${PERIOD_LABEL[period]} 기준 · 셀프검색부터 완료까지 운영 흐름 한눈에.`}
      />

      <DashboardFilters
        period={period}
        productCode={productCode}
        products={products}
      />

      {/* ① 액션 카드 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ActionCard
          tone="danger"
          icon={<TriangleAlert className="h-5 w-5" />}
          label="긴급 처리건 (P1 미완료)"
          value={actionCards.p1Open}
          note="urgency P1 · 미완료 전체"
        />
        <ActionCard
          tone="warn"
          icon={<Clock className="h-5 w-5" />}
          label="장기 지연건 (영업일 3일+)"
          value={actionCards.longDelayed}
          note="미완료 · 접수 후 영업일 3일 초과"
        />
      </section>

      {/* ② 핵심지표 3종 (완료건 대비 비율) */}
      <section className="flex flex-col gap-2">
        <SectionLabel>
          완료 처리 유형 — 모수 = 완료건 {completion.completed.toLocaleString()}
          {' '}(처리중 제외) · 각 비율은 완료건 대비
        </SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <RatioCard
            tone="brand"
            label="원콜완료"
            rate={completion.oneCallRate}
            count={completion.oneCall}
            desc="1회 작업으로 해결 · 담당자 기록"
          />
          <RatioCard
            tone="emerald"
            label="원팀완료 (자체해결)"
            rate={completion.selfTeamRate}
            count={completion.selfTeam}
            desc="운영팀 자체 해결 · Dev 미개입"
          />
          <RatioCard
            tone="rose"
            label="Dev개입"
            rate={completion.devRate}
            count={completion.devInvolved}
            desc="Slack 공유로 개발팀 이관"
          />
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          ※ 원팀완료 + Dev개입 = 100% (에스컬레이션 여부로 양분). 원콜완료는
          자체해결의 부분집합이라 합산 대상이 아닙니다.
        </p>
      </section>

      {/* ③ 퍼널 */}
      <section className="flex flex-col gap-2">
        <SectionLabel>행위자 기준 처리 퍼널</SectionLabel>
        <Card>
          <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-end">
            <FunnelStage label="검색" actor="호텔리어" value={funnel.search} sub="웹/챗봇 진입" tone="brand" />
            <FunnelArrow value={pct(funnel.inquiry, funnel.search)} />
            <FunnelStage label="문의" actor="호텔리어" value={funnel.inquiry} sub="티켓 생성" tone="sky" />
            <FunnelArrow value={pct(funnel.accepted, funnel.inquiry)} />
            <FunnelStage label="접수" actor="운영팀" value={funnel.accepted} sub="처리 착수" tone="violet" />
            <FunnelArrow value={pct(funnel.devEscalated, funnel.accepted)} tone="rose" />
            <FunnelStage label="Dev이관" actor="운영팀" value={funnel.devEscalated} sub="에스컬레이션" tone="rose" />
            <FunnelArrow />
            <FunnelStage label="완료" actor="운영팀" value={funnel.completed} sub="해결 완료" tone="emerald" />
          </CardContent>
        </Card>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          전화 문의는 검색 없이 직접 접수되며 카카오·방문 채널은 없음 —
          deflection(자가해결 전환) 지표는 적용하지 않습니다. 검색은 웹/챗봇
          셀프서비스 진입량 참고치입니다.
        </p>
      </section>

      {/* ④ 검색 · 호텔 */}
      <section className="flex flex-col gap-2">
        <SectionLabel>검색 키워드 · 호텔</SectionLabel>
        <Card>
          <CardContent className="p-5">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                검색어 워드클라우드
              </p>
              <span className="text-xs text-slate-400">호텔리어 실사용 검색</span>
            </div>
            <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">
              동의어 <b className="text-slate-500 dark:text-slate-300">대표어 기준</b>{' '}
              집계(변형·유의어 합산) · 글자 크기 = 빈도 ·{' '}
              <span className="text-rose-500">붉은 단어</span> = 0건 결과 다발
            </p>
            {data.keywords.length === 0 ? (
              <EmptyState
                icon={<Search className="h-6 w-6" />}
                title="이 기간 검색 데이터가 없습니다"
                description="호텔리어 검색이 쌓이면 표시됩니다."
              />
            ) : (
              <WordcloudChart data={data.keywords} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                호텔별 문의 수 Top 15
              </p>
              <span className="text-xs text-slate-400">집중 케어 · 온보딩 점검 대상</span>
            </div>
            {data.hotels.length === 0 ? (
              <EmptyState title="이 기간 문의가 없습니다" />
            ) : (
              <HotelBarChart data={data.hotels} />
            )}
          </CardContent>
        </Card>
      </section>

      {/* ⑤ 유입 분석 */}
      <section className="flex flex-col gap-2">
        <SectionLabel>문의 유입 분석</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="p-5">
              <p className="mb-0.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                일자별 · 채널별 유입
              </p>
              <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
                건당 1회 집계 · 채널 2개 이상은{' '}
                <span className="text-slate-500 dark:text-slate-300">'여럿'</span>
                으로 단일 분류(중복 합산 방지)
              </p>
              {data.channelDaily.series.length === 0 ? (
                <EmptyState title="이 기간 유입이 없습니다" />
              ) : (
                <ChannelStackedChart data={data.channelDaily} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                제품별 분포
              </p>
              {data.byProduct.length === 0 ? (
                <EmptyState title="데이터 없음" />
              ) : (
                <ProductPieChart data={data.byProduct} />
              )}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
              유형별 현황 (완료 / 처리중)
            </p>
            {data.byType.length === 0 ? (
              <EmptyState title="데이터 없음" />
            ) : (
              <TypeBarChart data={data.byType} />
            )}
          </CardContent>
        </Card>
      </section>

      {/* ⑥ 처리 · 완료 */}
      <section className="flex flex-col gap-2">
        <SectionLabel>처리 · 완료 현황</SectionLabel>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatusCard label="접수" value={statusDist.received} tone="amber" />
          <StatusCard label="처리중" value={statusDist.in_progress} tone="blue" />
          <StatusCard label="완료" value={statusDist.completed} tone="emerald" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="flex flex-col gap-1 p-5">
              <span className="text-xs font-medium text-slate-500">
                평균 첫 응답 시간
              </span>
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {timeMetrics.avgFirstResponseHours != null
                  ? `${(Math.round(timeMetrics.avgFirstResponseHours * 10) / 10).toLocaleString()}시간`
                  : '—'}
              </span>
              <span className="text-xs text-slate-400">
                접수 → 운영팀 첫 공개 답변
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1 p-5">
              <span className="text-xs font-medium text-slate-500">
                평균 해결 소요 (영업일)
              </span>
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {timeMetrics.avgResolutionBizDays != null
                  ? `${(Math.round(timeMetrics.avgResolutionBizDays * 10) / 10).toLocaleString()}일`
                  : '—'}
              </span>
              <span className="text-xs text-slate-400">접수 → 완료 (주말·공휴일 제외)</span>
            </CardContent>
          </Card>
        </div>

        {/* Dev 백로그 */}
        <Card className="border-rose-100 dark:border-rose-900/50">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                Dev 에스컬레이션 백로그
              </p>
              <span className="ml-auto text-xs text-slate-400">
                미완료 · 경과 영업일 순
              </span>
            </div>
            {data.devBacklog.length === 0 ? (
              <EmptyState title="미완료 에스컬레이션 없음" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs text-slate-400 dark:border-slate-800">
                      <th className="pb-2 pr-3 font-semibold">티켓</th>
                      <th className="pb-2 pr-3 font-semibold">제품</th>
                      <th className="pb-2 pr-3 font-semibold">유형</th>
                      <th className="pb-2 text-right font-semibold">경과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.devBacklog.map((r) => (
                      <tr
                        key={r.ticketNo}
                        className="border-b border-slate-50 last:border-0 dark:border-slate-800/60"
                      >
                        <td className="py-2.5 pr-3 font-medium text-slate-700 dark:text-slate-200">
                          {r.ticketNo}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-500">{r.productLabel}</td>
                        <td className="py-2.5 pr-3 text-slate-500">{r.issueTypeLabel}</td>
                        <td
                          className={`py-2.5 text-right font-semibold ${
                            r.elapsedBizDays >= 5
                              ? 'text-rose-600 dark:text-rose-400'
                              : r.elapsedBizDays >= 3
                                ? 'text-orange-500'
                                : 'text-slate-500'
                          }`}
                        >
                          {r.elapsedBizDays}일
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 담당자별 */}
        <Card>
          <CardContent className="p-5">
            <p className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
              담당자별 처리 현황
            </p>
            {data.assignees.length === 0 ? (
              <EmptyState title="이 기간 배정된 티켓이 없습니다" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs text-slate-400 dark:border-slate-800">
                      <th className="pb-2 pr-4 font-semibold">담당자</th>
                      <th className="pb-2 pr-4 text-right font-semibold">완료</th>
                      <th className="pb-2 pr-4 text-right font-semibold">처리중</th>
                      <th className="pb-2 text-right font-semibold">평균 해결</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.assignees.map((a) => (
                      <tr
                        key={a.id}
                        className="border-b border-slate-50 last:border-0 dark:border-slate-800/60"
                      >
                        <td className="py-2.5 pr-4 font-medium text-slate-700 dark:text-slate-200">
                          {a.name}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {a.completed}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-blue-600 dark:text-blue-400">
                          {a.ongoing}
                        </td>
                        <td className="py-2.5 text-right text-slate-600 dark:text-slate-300">
                          {a.avgResolutionBizDays != null
                            ? `${Math.round(a.avgResolutionBizDays * 10) / 10}일`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 서버 헬퍼 컴포넌트 (CSS 카드)
// ─────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
      {children}
    </p>
  );
}

function ActionCard({
  tone,
  icon,
  label,
  value,
  note,
}: {
  tone: 'danger' | 'warn';
  icon: React.ReactNode;
  label: string;
  value: number;
  note: string;
}) {
  const border = tone === 'danger' ? 'border-l-rose-500' : 'border-l-orange-400';
  const iconBg =
    tone === 'danger'
      ? 'bg-rose-50 text-rose-500 dark:bg-rose-950'
      : 'bg-orange-50 text-orange-500 dark:bg-orange-950';
  const valueColor =
    tone === 'danger'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-orange-500 dark:text-orange-400';
  return (
    <Card className={`border-l-4 ${border}`}>
      <CardContent className="flex items-start gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className={`mt-1 text-4xl font-bold ${valueColor}`}>
            {value.toLocaleString()}
            <span className="ml-1 text-lg font-normal text-slate-400">건</span>
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{note}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RatioCard({
  tone,
  label,
  rate,
  count,
  desc,
}: {
  tone: 'brand' | 'emerald' | 'rose';
  label: string;
  rate: number;
  count: number;
  desc: string;
}) {
  const top =
    tone === 'brand'
      ? 'border-t-brand-500'
      : tone === 'emerald'
        ? 'border-t-emerald-400'
        : 'border-t-rose-500';
  const color =
    tone === 'brand'
      ? 'text-brand-600 dark:text-brand-400'
      : tone === 'emerald'
        ? 'text-emerald-500'
        : 'text-rose-500';
  const bar =
    tone === 'brand' ? 'bg-brand-500' : tone === 'emerald' ? 'bg-emerald-400' : 'bg-rose-500';
  const w = Math.round(rate * 100);
  return (
    <Card className={`border-t-4 ${top}`}>
      <CardContent className="p-4">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</p>
        <div className="mt-1 flex items-end gap-2">
          <span className={`text-4xl font-bold ${color}`}>
            {Math.round(rate * 100)}
            <span className="text-lg font-normal text-slate-400">%</span>
          </span>
          <span className="mb-1.5 text-sm text-slate-400">{count.toLocaleString()}건</span>
        </div>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{desc}</p>
        <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
          <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${w}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

const FUNNEL_STAGE_TONE = {
  brand: 'bg-brand-50 border-brand-100 text-brand-600 dark:bg-brand-950/40 dark:border-brand-900 dark:text-brand-400',
  sky: 'bg-sky-50 border-sky-100 text-sky-600 dark:bg-sky-950/40 dark:border-sky-900 dark:text-sky-400',
  violet: 'bg-violet-50 border-violet-100 text-violet-600 dark:bg-violet-950/40 dark:border-violet-900 dark:text-violet-400',
  rose: 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-400',
  emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-400',
} as const;

function FunnelStage({
  label,
  actor,
  value,
  sub,
  tone,
}: {
  label: string;
  actor: string;
  value: number;
  sub: string;
  tone: keyof typeof FUNNEL_STAGE_TONE;
}) {
  return (
    <div className="flex-1">
      <div className={`rounded-xl border p-4 text-center ${FUNNEL_STAGE_TONE[tone]}`}>
        <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
        <p className="mb-2 text-xs text-slate-400">{actor}</p>
        <p className="text-3xl font-bold">{value.toLocaleString()}</p>
        <p className="mt-1 text-xs text-slate-400">{sub}</p>
      </div>
    </div>
  );
}

function FunnelArrow({ value, tone }: { value?: string; tone?: 'rose' }) {
  return (
    <div className="hidden shrink-0 flex-col items-center justify-center gap-1 self-center sm:flex">
      {value && (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            tone === 'rose'
              ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {value}
        </span>
      )}
      <span className="text-slate-300 dark:text-slate-600">→</span>
    </div>
  );
}

function StatusCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'amber' | 'blue' | 'orange' | 'emerald';
}) {
  const color = {
    amber: 'text-amber-600 dark:text-amber-400',
    blue: 'text-blue-600 dark:text-blue-400',
    orange: 'text-orange-500',
    emerald: 'text-emerald-600 dark:text-emerald-400',
  }[tone];
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="mb-1 text-xs text-slate-400">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}
