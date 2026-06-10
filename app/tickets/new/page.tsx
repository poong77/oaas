/**
 * `/tickets/new` — Phase 5 IC-01 / IC-02 / IC-03 신규 접수.
 *
 * 호텔리어 본인 접수폼 (3단계 스텝퍼).
 * 매니저+어드민도 동일 폼 사용 가능 (channel='web', reporter_id=본인).
 * 전화 접수는 `/admin/tickets/new-by-phone` (별도 경로).
 */

import { Suspense } from 'react';
import { requireAuth, isManagerOrAdmin } from '@/lib/permissions';
import { getCategoriesByType } from '@/lib/services/categories';
import { getProductTaxonomyTree } from '@/lib/services/master-categories';
import { listHotelierTemplates } from '@/lib/services/master-hotelier-templates';
import { getHotelById, getUserById } from '@/lib/services/users';
import { TicketCreateForm } from './_components/ticket-create-form';

export const metadata = { title: '문의 접수 — OA서포트' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  type?: string;
  product?: string;
  from?: string;
  checklist?: string;
  step?: string;
}>;

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireAuth('/tickets/new');
  const params = await searchParams;

  const [
    productTree,
    issueTypeCategories,
    hotelierTemplates,
    hotel,
    fullUser,
  ] = await Promise.all([
    getProductTaxonomyTree(),
    getCategoriesByType('issue_type'),
    listHotelierTemplates(),
    user.hotelId ? getHotelById(user.hotelId) : Promise.resolve(null),
    getUserById(user.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <Suspense fallback={null}>
        <TicketCreateForm
          viewer={{
            id: user.id,
            name: fullUser?.name ?? user.name ?? null,
            email: fullUser?.email ?? user.email ?? null,
            phone: fullUser?.phone ?? null,
            hotelName: hotel?.name ?? null,
          }}
          productTree={productTree}
          productMode={isManagerOrAdmin(user.role) ? 'cascade' : 'root-only'}
          issueTypeCategories={issueTypeCategories.map((c) => ({
            code: c.code,
            label: c.label,
          }))}
          hotelierTemplates={hotelierTemplates.map((t) => ({
            id: t.id,
            title: t.title,
            content: t.content,
            category: t.category ?? null,
          }))}
          prefill={{
            product: params.product ?? null,
            type: params.type ?? null,
            from: params.from ?? null,
            checklist: params.checklist ?? null,
            step: params.step ?? null,
          }}
        />
      </Suspense>
    </div>
  );
}
