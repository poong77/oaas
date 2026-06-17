'use client';

/**
 * 유료 사용현황 클라이언트 — 일/주/월 탭 + 요약 카드 + 버킷 차트/표.
 *
 * 서버에서 3개 기간 리포트를 모두 받아 탭 전환만 클라이언트에서 처리(추가 패칭 없음).
 * AI 비용은 USD, 문자는 KRW. 합산 표기는 USD_TO_KRW 가정 환율로 환산.
 */

import { useMemo, useState } from 'react';
import { Bot, MessageSquare, Coins, Info } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { USD_TO_KRW, SMS_PRICING_KRW } from '@/lib/ai/pricing';
import type { PaidUsageReport, UsagePeriod } from '@/lib/services/paid-usage';

const PERIOD_LABEL: Record<UsagePeriod, string> = {
  daily: '일간',
  weekly: '주간',
  monthly: '월간',
};

const PERIOD_HINT: Record<UsagePeriod, string> = {
  daily: '최근 30일',
  weekly: '최근 12주',
  monthly: '최근 12개월',
};

/** 용도 묶음별 색·라벨 (검색 인프라=회색, 추천=인디고, 생성=브랜드그린, 기타=슬레이트). */
const CATEGORY_STYLE: Record<
  'gen' | 'rec' | 'infra' | 'etc',
  { bar: string; label: string }
> = {
  gen: { bar: 'bg-brand-500', label: '답변·콘텐츠 생성' },
  rec: { bar: 'bg-indigo-500', label: '추천·보조' },
  infra: { bar: 'bg-slate-400', label: '검색 인프라' },
  etc: { bar: 'bg-slate-300', label: '기타' },
};

function krw(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`;
}
function usd(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

export function PaidUsageClient({
  daily,
  weekly,
  monthly,
}: {
  daily: PaidUsageReport;
  weekly: PaidUsageReport;
  monthly: PaidUsageReport;
}) {
  const [period, setPeriod] = useState<UsagePeriod>('daily');
  const report = period === 'daily' ? daily : period === 'weekly' ? weekly : monthly;

  const { totals, buckets } = report;
  const aiKrw = totals.aiCostUsd * USD_TO_KRW;
  const combinedKrw = aiKrw + totals.smsCostKrw;

  // 차트 정규화: 버킷별 합산요금(KRW 환산) 최대치 기준
  const maxCost = useMemo(() => {
    return Math.max(
      1,
      ...buckets.map((b) => b.aiCostUsd * USD_TO_KRW + b.smsCostKrw),
    );
  }, [buckets]);

  // 용도별 막대 정규화: 최대 비용(USD) 기준
  const maxBucketCost = useMemo(
    () => Math.max(0.0001, ...report.aiByBucket.map((b) => b.costUsd)),
    [report.aiByBucket],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* 기간 탭 */}
      <div className="flex items-center gap-1.5">
        {(['daily', 'weekly', 'monthly'] as UsagePeriod[]).map((p) => {
          const active = p === period;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={
                'rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ' +
                (active
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700')
              }
            >
              {PERIOD_LABEL[p]}
              <span className="ml-1.5 text-[11px] font-normal opacity-70">
                {PERIOD_HINT[p]}
              </span>
            </button>
          );
        })}
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          icon={<Bot className="h-5 w-5" />}
          tone="brand"
          title="AI 비용"
          main={usd(totals.aiCostUsd)}
          sub={`${krw(aiKrw)} · ${totals.aiCalls.toLocaleString()}회 호출`}
        />
        <SummaryCard
          icon={<MessageSquare className="h-5 w-5" />}
          tone="indigo"
          title="문자 요금"
          main={krw(totals.smsCostKrw)}
          sub={`${totals.smsCount.toLocaleString()}건 (SMS ${totals.smsByKind.sms} · LMS ${totals.smsByKind.lms} · MMS ${totals.smsByKind.mms})`}
        />
        <SummaryCard
          icon={<Coins className="h-5 w-5" />}
          tone="amber"
          title="합산 예상요금"
          main={krw(combinedKrw)}
          sub={`환율 ₩${USD_TO_KRW.toLocaleString()}/$ 가정`}
        />
      </div>

      {/* AI 적재 대기 안내 */}
      {!report.hasAiData && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
              <Info className="h-4 w-4" />
            </span>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-slate-100">
                이 기간에 적재된 AI 사용 데이터가 없습니다.
              </strong>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                AI 사용량은 로깅 도입 시점 이후 호출분부터 집계됩니다. 문자
                요금은 과거 발송 이력까지 정상 집계됩니다.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 기간별 추이 */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              기간별 추이 ({PERIOD_LABEL[period]})
            </h2>
            <span className="text-[11px] text-slate-400">
              막대 = AI+문자 합산(₩)
            </span>
          </div>

          {buckets.every((b) => b.aiCalls === 0 && b.smsCount === 0) ? (
            <EmptyState
              title="데이터 없음"
              description="선택한 기간에 집계된 사용 내역이 없습니다."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="py-2 pr-3 font-medium">기간</th>
                    <th className="py-2 pr-3 text-right font-medium">AI 호출</th>
                    <th className="py-2 pr-3 text-right font-medium">AI 비용</th>
                    <th className="py-2 pr-3 text-right font-medium">문자 건수</th>
                    <th className="py-2 pr-3 text-right font-medium">문자 요금</th>
                    <th className="py-2 pl-3 font-medium">합산(₩)</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets
                    .slice()
                    .reverse()
                    .map((b) => {
                      const combined = b.aiCostUsd * USD_TO_KRW + b.smsCostKrw;
                      const pct = Math.round((combined / maxCost) * 100);
                      return (
                        <tr
                          key={b.key}
                          className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                        >
                          <td className="py-2 pr-3 font-medium text-slate-700 dark:text-slate-200">
                            {b.label}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                            {b.aiCalls.toLocaleString()}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                            {b.aiCostUsd > 0 ? usd(b.aiCostUsd) : '—'}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                            {b.smsCount.toLocaleString()}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                            {b.smsCostKrw > 0 ? krw(b.smsCostKrw) : '—'}
                          </td>
                          <td className="py-2 pl-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div
                                  className="bg-brand-500 h-full rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="w-20 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
                                {krw(combined)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI 내역: 모델별 | 용도별 */}
      <div className="grid gap-3 lg:grid-cols-2">
      {/* AI 모델별 내역 */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            AI 모델별 내역 ({PERIOD_HINT[period]})
          </h2>
          {report.aiByModel.length === 0 ? (
            <p className="text-xs text-slate-400">집계된 AI 호출이 없습니다.</p>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
              {report.aiByModel.map((m) => (
                <div
                  key={`${m.provider}/${m.model}`}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge tone={m.provider === 'anthropic' ? 'brand' : 'slate'}>
                      {m.provider}
                    </Badge>
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                      {m.model}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    <span>{m.calls.toLocaleString()}회</span>
                    <span className="w-20 text-right font-semibold text-slate-700 dark:text-slate-200">
                      {usd(m.costUsd)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI 용도별 내역 (bucket) */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              AI 용도별 내역 ({PERIOD_HINT[period]})
            </h2>
            <span className="text-[11px] text-slate-400">비용 높은 순</span>
          </div>
          {report.aiByBucket.length === 0 ? (
            <p className="text-xs text-slate-400">집계된 AI 호출이 없습니다.</p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                {report.aiByBucket.map((b) => {
                  const pct = Math.round((b.costUsd / maxBucketCost) * 100);
                  const c = CATEGORY_STYLE[b.category];
                  return (
                    <div key={b.label} className="flex items-center gap-2.5 py-1.5">
                      <span
                        className={'h-7 w-1.5 shrink-0 rounded ' + c.bar}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                            {b.label}
                          </span>
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                            {usd(b.costUsd)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className={'h-full rounded-full ' + c.bar}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-slate-400">
                            {b.calls.toLocaleString()}회
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                {(['gen', 'rec', 'infra'] as const).map((cat) => (
                  <span key={cat} className="inline-flex items-center gap-1.5">
                    <span
                      className={'h-2 w-2 rounded-sm ' + CATEGORY_STYLE[cat].bar}
                    />
                    {CATEGORY_STYLE[cat].label}
                  </span>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>

      {/* 단가 안내 */}
      <p className="text-[11px] leading-relaxed text-slate-400">
        문자 단가(건당): SMS {SMS_PRICING_KRW.sms}원 · LMS {SMS_PRICING_KRW.lms}원
        · MMS {SMS_PRICING_KRW.mms}원. AI 단가는 모델별 토큰 단가 기준이며 실제
        청구액과 차이가 있을 수 있습니다. 단가·환율 조정은{' '}
        <span className="font-mono">lib/ai/pricing.ts</span>.
      </p>
    </div>
  );
}

function SummaryCard({
  icon,
  tone,
  title,
  main,
  sub,
}: {
  icon: React.ReactNode;
  tone: 'brand' | 'indigo' | 'amber';
  title: string;
  main: string;
  sub: string;
}) {
  const toneCls =
    tone === 'brand'
      ? 'bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300'
      : tone === 'indigo'
        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300'
        : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300';
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <span
          className={
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-md ' +
            toneCls
          }
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {title}
          </span>
          <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {main}
          </span>
          <span className="mt-0.5 truncate text-xs text-slate-400">{sub}</span>
        </div>
      </CardContent>
    </Card>
  );
}
