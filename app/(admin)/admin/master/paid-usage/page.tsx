/**
 * /admin/master/paid-usage — 유료 사용현황 (어드민 전용).
 *
 * AI(LLM·임베딩)와 문자(SMS/LMS/MMS)의 일/주/월 사용량·요금을 집계한다.
 *   - AI : ai_usage_logs (배포 시점 이후 적재분)
 *   - 문자: notification_logs (과거 소급)
 * 비용·요금 데이터이므로 menu-access 토글 없이 어드민 고정(hardAdminOnly).
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { getPaidUsageReport } from '@/lib/services/paid-usage';
import { PaidUsageClient } from './_components/paid-usage-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: '유료 사용현황 — 마스터DB' };

export default async function PaidUsagePage() {
  await requireRole(['admin']);

  const [daily, weekly, monthly] = await Promise.all([
    getPaidUsageReport('daily'),
    getPaidUsageReport('weekly'),
    getPaidUsageReport('monthly'),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="유료 사용현황"
        description="AI·문자 사용량과 예상 요금을 일·주·월 단위로 집계합니다. 단가는 lib/ai/pricing.ts에서 조정합니다."
        breadcrumb={
          <Link
            href="/admin/master"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 마스터DB
          </Link>
        }
      />

      <PaidUsageClient daily={daily} weekly={weekly} monthly={monthly} />
    </div>
  );
}
