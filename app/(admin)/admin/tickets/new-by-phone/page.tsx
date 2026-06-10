/**
 * `/admin/tickets/new-by-phone` — 티켓 생성 (IC-04 확장).
 *
 * 매니저+어드민. 전화·카카오톡·이메일·방문 등 외부 채널 문의를 매니저가 대신 접수.
 * channel은 ticket_channels 마스터에서 선택 (Plan ticket-channels-master Q-3).
 */

import Link from 'next/link';
import { ArrowLeft, Headset } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { requireRole } from '@/lib/permissions';
import { listHotels } from '@/lib/services/users';
import { getCategoriesByType } from '@/lib/services/categories';
import { getProductTaxonomyTree } from '@/lib/services/master-categories';
import { listAgentSelectableChannels } from '@/lib/services/master-ticket-channels';
import { PhoneTicketForm } from './_components/phone-ticket-form';

export const metadata = { title: '티켓 생성 — OA서포트' };
export const dynamic = 'force-dynamic';

export default async function PhoneTicketPage() {
  await requireRole(['manager', 'admin']);

  const [
    hotelsResult,
    productTree,
    issueTypeCategories,
    urgencyCategories,
    impactCategories,
    channels,
  ] = await Promise.all([
    listHotels({ isActive: true, pageSize: 100, sortBy: 'name', sortOrder: 'asc' }),
    getProductTaxonomyTree(),
    getCategoriesByType('issue_type'),
    getCategoriesByType('urgency'),
    getCategoriesByType('impact'),
    listAgentSelectableChannels(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={
          <Link
            href="/admin/tickets"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            문의 관리로
          </Link>
        }
        title={
          <span className="inline-flex items-center gap-2">
            <Headset className="h-5 w-5 text-brand-600" />
            티켓 생성
          </span>
        }
        description="전화·카카오톡·이메일 등 외부 채널로 들어온 문의를 매니저가 대신 접수합니다. 호텔·호텔리어를 매핑하면 알림이 자동 발송됩니다."
      />

      <PhoneTicketForm
        channels={channels.map((c) => ({
          code: c.code,
          label: c.label,
          isAgentDefault: c.isAgentDefault,
        }))}
        hotels={hotelsResult.items.map((h) => ({
          id: h.id,
          name: h.name,
          oaPmsHotelId: h.oaPmsHotelId,
        }))}
        productTree={productTree}
        issueTypeCategories={issueTypeCategories.map((c) => ({
          code: c.code,
          label: c.label,
        }))}
        urgencyCategories={urgencyCategories.map((c) => ({
          code: c.code,
          label: c.label,
        }))}
        impactCategories={impactCategories.map((c) => ({
          code: c.code,
          label: c.label,
        }))}
      />
    </div>
  );
}
