/**
 * 실사용 퍼널 (#6) — 노출 → 클릭(위치) → 접수. search_logs 기반 (읽기 전용).
 */

import { Card, CardContent } from '@/components/ui/card';
import type { FunnelStats } from '@/lib/services/search-logs';

function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : '–';
}

export function FunnelSection({ funnel }: { funnel: FunnelStats }) {
  const { searches, clicks, clickThenTicket, ticketNoClick } = funnel;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            실사용 퍼널 — 노출 → 클릭 → 접수
          </h2>
          <span className="text-xs text-slate-400">최근 90일 실제 검색</span>
        </div>

        {searches === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            아직 실사용 검색 로그가 없습니다. 사용자가 /search에서 검색하면
            집계됩니다.
          </p>
        ) : (
          <>
            {/* 퍼널 3단 */}
            <div className="grid grid-cols-3 gap-3">
              <FunnelStep
                label="검색(노출)"
                value={searches}
                sub="100%"
                tone="brand"
              />
              <FunnelStep
                label="결과 클릭"
                value={clicks}
                sub={`${pct(clicks, searches)} (CTR)`}
                tone="ok"
              />
              <FunnelStep
                label="접수 전환"
                value={clickThenTicket + ticketNoClick}
                sub={`${pct(clickThenTicket + ticketNoClick, searches)}`}
                tone="warn"
              />
            </div>

            {/* 클릭 위치 분포 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-500">
                클릭 위치 분포
              </span>
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <Bar
                  n={funnel.clickTop4}
                  d={clicks || 1}
                  cls="bg-emerald-500"
                />
                <Bar n={funnel.clickMid} d={clicks || 1} cls="bg-amber-400" />
                <Bar n={funnel.clickDeep} d={clicks || 1} cls="bg-red-400" />
              </div>
              <div className="flex gap-3 text-xs text-slate-500">
                <span>🟩 1~4위 {funnel.clickTop4}</span>
                <span>🟨 5~8위 {funnel.clickMid}</span>
                <span>🟥 9위+ {funnel.clickDeep}</span>
              </div>
            </div>

            {/* 해석 */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Insight
                label="자가해결 추정 (deflection)"
                value={`${Math.round(funnel.deflectionRate * 100)}%`}
                hint="검색 후 접수로 안 넘어감 — 높을수록 좋음"
                tone="ok"
              />
              <Insight
                label="클릭 없이 바로 접수"
                value={`${ticketNoClick}건 (${pct(ticketNoClick, searches)})`}
                hint="검색이 답을 못 줘서 곧장 접수 — 검색 실패 신호"
                tone="bad"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FunnelStep({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone: 'brand' | 'ok' | 'warn';
}) {
  const cls =
    tone === 'brand'
      ? 'text-brand-600 dark:text-brand-400'
      : tone === 'ok'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-amber-600 dark:text-amber-400';
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-center dark:border-slate-700">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-bold ${cls}`}>{value.toLocaleString()}</div>
      <div className="text-xs text-slate-400">{sub}</div>
    </div>
  );
}

function Bar({ n, d, cls }: { n: number; d: number; cls: string }) {
  const w = d > 0 ? (n / d) * 100 : 0;
  if (w <= 0) return null;
  return <div className={cls} style={{ width: `${w}%` }} />;
}

function Insight({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'ok' | 'bad';
}) {
  const cls =
    tone === 'ok'
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400';
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`text-lg font-bold ${cls}`}>{value}</div>
      <div className="text-xs text-slate-400">{hint}</div>
    </div>
  );
}
