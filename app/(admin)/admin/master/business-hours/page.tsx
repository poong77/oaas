/**
 * /admin/master/business-hours — 운영시간 마스터 (P1 + P2 통합).
 *
 * 4탭:
 *   ① hours      — 현재 운영시간 (business_hours_default 편집)
 *   ② overrides  — 예약 변경 (business_hours_overrides CRUD)
 *   ③ holidays   — 공휴일 (business_holidays CRUD)
 *   ④ history    — 변경 이력 (activity_logs 필터 뷰)
 *
 * StatusPreview는 모든 탭 상단에 고정 — 어드민이 변경 즉시 결과 확인 가능.
 * 호텔리어 컨택 패널이 동일 데이터 구독 (revalidateTag 'business-hours').
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import {
  getBusinessHoursDefault,
  getCurrentBusinessStatus,
  listBusinessHolidays,
  listBusinessHoursActivityLogs,
  listBusinessHoursOverrides,
} from '@/lib/services/business-hours';

import { BusinessHoursForm } from './_components/business-hours-form';
import { HolidaysSection } from './_components/holidays-section';
import { HistorySection } from './_components/history-section';
import { OverridesSection } from './_components/overrides-section';
import { StatusPreview } from './_components/status-preview';
import {
  BusinessHoursTabBar,
  type BusinessHoursTab,
} from './_components/tab-bar';

export const dynamic = 'force-dynamic';
export const metadata = { title: '운영시간 — 마스터DB' };

const VALID_TABS: readonly BusinessHoursTab[] = [
  'hours',
  'overrides',
  'holidays',
  'history',
] as const;

export default async function MasterBusinessHoursPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole(['admin']);

  const sp = await searchParams;
  const tab: BusinessHoursTab = VALID_TABS.includes(sp.tab as BusinessHoursTab)
    ? (sp.tab as BusinessHoursTab)
    : 'hours';

  // 카운트는 모든 탭에서 표시 (가벼움). 본문은 활성 탭만 페치.
  const [status, holidaysCount, overridesCount] = await Promise.all([
    getCurrentBusinessStatus(),
    listBusinessHolidays({ includeInactive: false }).then((r) => r.length),
    listBusinessHoursOverrides({
      status: ['scheduled', 'active'],
    }).then((r) => r.length),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="운영시간"
        description="호텔리어 컨택 패널의 실시간 운영상태에 즉시 반영됩니다."
        breadcrumb={
          <Link
            href="/admin/master"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 마스터DB
          </Link>
        }
      />

      <StatusPreview status={status} />

      <BusinessHoursTabBar
        active={tab}
        counts={{ overrides: overridesCount, holidays: holidaysCount }}
      />

      {tab === 'hours' && <HoursTab />}
      {tab === 'overrides' && <OverridesTab />}
      {tab === 'holidays' && <HolidaysTab />}
      {tab === 'history' && <HistoryTab />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 탭별 컨테이너 — async 분리해서 병렬 SSR
// ─────────────────────────────────────────────────────────────────

async function HoursTab() {
  const defaults = await getBusinessHoursDefault();
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <BusinessHoursForm defaults={defaults} />
    </div>
  );
}

async function OverridesTab() {
  const overrides = await listBusinessHoursOverrides({ includeInactive: true });
  return <OverridesSection overrides={overrides} />;
}

async function HolidaysTab() {
  const holidays = await listBusinessHolidays({ includeInactive: false });
  const year = new Date().getFullYear();
  return <HolidaysSection holidays={holidays} year={year} />;
}

async function HistoryTab() {
  const logs = await listBusinessHoursActivityLogs({ limit: 100 });
  return <HistorySection logs={logs} />;
}
