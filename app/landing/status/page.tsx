/**
 * /landing/status — 서비스 상태 시안.
 *
 * 전체 상태 배너 + 제품별 상태 리스트 + 최근 이슈 이력. 공용 헤더(public)/푸터.
 */
import { LandingHeader } from '../_components/landing-header';
import { LandingFooter } from '../_components/landing-footer';

type State = 'operational' | 'maintenance' | 'incident';

const STATE_META: Record<State, { label: string; dot: string; text: string; bg: string }> = {
  operational: { label: '운영 중', dot: 'bg-[#00A36B]', text: 'text-[#008A59]', bg: 'bg-[#E6F7F0]' },
  maintenance: { label: '점검 중', dot: 'bg-[#F59E0B]', text: 'text-[#B45309]', bg: 'bg-[#FEF3C7]' },
  incident: { label: '장애', dot: 'bg-[#FA342C]', text: 'text-[#FA342C]', bg: 'bg-[#FEF2F2]' },
};

const SERVICES: { name: string; state: State }[] = [
  { name: 'PMS', state: 'operational' },
  { name: 'CMS', state: 'operational' },
  { name: 'Keyless', state: 'operational' },
  { name: '키오스크', state: 'operational' },
  { name: '웹서비스', state: 'operational' },
  { name: 'oachat.ai 챗봇', state: 'operational' },
];

const HISTORY: { date: string; title: string; state: State }[] = [
  { date: '2026-01-03', title: '아고다 연동 일시 지연 — 복구 완료', state: 'incident' },
  { date: '2025-12-28', title: '정기 점검 (02:00~04:00) 완료', state: 'maintenance' },
  { date: '2025-12-20', title: 'Keyless 알림 발송 지연 — 복구 완료', state: 'incident' },
];

export const metadata = { title: '서비스 상태 — OA서포트' };

export default function LandingStatusPage() {
  const allOk = SERVICES.every((s) => s.state === 'operational');

  return (
    <div className="min-h-screen bg-white font-sans text-[#1A1C20]">
      <LandingHeader variant="public" />

      <main className="mx-auto max-w-[800px] px-5 py-12">
        <h1 className="text-[28px] font-bold tracking-tight">서비스 상태</h1>

        {/* 전체 상태 배너 */}
        <div
          className={`mt-6 flex items-center gap-3 rounded-xl p-5 ${
            allOk ? 'bg-[#E6F7F0]' : 'bg-[#FEF3C7]'
          }`}
        >
          <span className="relative flex h-3 w-3">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
                allOk ? 'bg-[#00A36B]' : 'bg-[#F59E0B]'
              }`}
            />
            <span
              className={`relative inline-flex h-3 w-3 rounded-full ${
                allOk ? 'bg-[#00A36B]' : 'bg-[#F59E0B]'
              }`}
            />
          </span>
          <p
            className={`text-base font-bold ${
              allOk ? 'text-[#008A59]' : 'text-[#B45309]'
            }`}
          >
            {allOk ? '모든 시스템이 정상 운영 중입니다' : '일부 시스템에 영향이 있습니다'}
          </p>
        </div>

        {/* 최근 이슈 이력 */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">최근 이슈 이력</h2>
          <ul className="flex flex-col gap-2">
            {HISTORY.map((h, i) => {
              const m = STATE_META[h.state];
              return (
                <li
                  key={i}
                  className="flex flex-col gap-1 rounded-xl border border-[#E5E7EB] p-4 sm:flex-row sm:items-center sm:gap-4"
                >
                  <span
                    className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 ${m.bg}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                    <span className={`text-xs font-semibold ${m.text}`}>{m.label}</span>
                  </span>
                  <span className="flex-1 text-sm text-[#1A1C20]">{h.title}</span>
                  <span className="text-xs text-[#868B94]">{h.date}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
