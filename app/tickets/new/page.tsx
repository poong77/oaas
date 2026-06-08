/**
 * `/tickets/new` — Phase 5 IC-01 / IC-02 / IC-03 신규 접수.
 *
 * 호텔리어 본인 접수폼 (3단계 스텝퍼).
 * 매니저+어드민도 동일 폼 사용 가능 (channel='web', reporter_id=본인).
 * 전화 접수는 `/admin/tickets/new-by-phone` (별도 경로).
 */

import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { ContactPanel } from '@/components/contact/contact-panel';
import { requireAuth, isManagerOrAdmin } from '@/lib/permissions';
import { getCategoriesByType } from '@/lib/services/categories';
import { getProductTaxonomyTree } from '@/lib/services/master-categories';
import { listHotelierTemplates } from '@/lib/services/master-hotelier-templates';
import { getHotelById, getUserById } from '@/lib/services/users';
import { TicketCreateForm } from './_components/ticket-create-form';

export const metadata = { title: '문의 접수 — OA 통합 AS' };
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

  const description =
    params.type === 'error'
      ? '발생한 오류·장애를 빠르게 접수합니다. 한 화면에서 1분이면 완료됩니다.'
      : params.from === 'checklist'
        ? '셀프 픽스로 해결되지 않은 이슈입니다. 진단 내용이 자동 첨부됩니다.'
        : params.from === 'chatbot'
          ? '챗봇으로 해결되지 않은 문의를 접수합니다. 챗봇 대화 내용을 함께 적어주시면 더 빠른 처리가 가능합니다.'
          : '오류 · 기능문의 · 기능개발 · 데이터수정 등 모든 유형의 문의를 접수합니다.';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_300px] lg:gap-10">
        <div className="flex flex-col gap-5">
      <PageHeader
        title={params.type === 'error' ? '오류 접수' : '문의 접수'}
        description={description}
      />

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
        <ContactPanel variant="sidebar" />
      </div>
    </div>
  );
}
