/**
 * `/admin/tickets/new-by-phone` — 전화 접수 (IC-04).
 *
 * 매니저+어드민. channel='phone' 으로 저장.
 */

import Link from 'next/link';
import { ArrowLeft, Phone } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { requireRole } from '@/lib/permissions';
import { listHotels } from '@/lib/services/users';
import { getCategoriesByType } from '@/lib/services/categories';
import { PhoneTicketForm } from './_components/phone-ticket-form';

export const metadata = { title: '전화 접수 — OA 통합 AS' };
export const dynamic = 'force-dynamic';

export default async function PhoneTicketPage() {
  await requireRole(['manager', 'admin']);

  const [
    hotelsResult,
    productCategories,
    issueTypeCategories,
    urgencyCategories,
    impactCategories,
  ] = await Promise.all([
    listHotels({ isActive: true, pageSize: 100, sortBy: 'name', sortOrder: 'asc' }),
    getCategoriesByType('product'),
    getCategoriesByType('issue_type'),
    getCategoriesByType('urgency'),
    getCategoriesByType('impact'),
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
            티켓 큐로
          </Link>
        }
        title={
          <span className="inline-flex items-center gap-2">
            <Phone className="h-5 w-5 text-brand-600" />
            전화 접수
          </span>
        }
        description="고객과의 통화 내용을 직접 입력하여 티켓을 발급합니다. 호텔·호텔리어를 매핑하면 알림이 자동 발송됩니다."
      />

      <PhoneTicketForm
        hotels={hotelsResult.items.map((h) => ({
          id: h.id,
          name: h.name,
          oaPmsHotelId: h.oaPmsHotelId,
        }))}
        productCategories={productCategories.map((c) => ({
          code: c.code,
          label: c.label,
        }))}
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
