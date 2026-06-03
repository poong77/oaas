import { Building2 } from 'lucide-react';
import { listHotels } from '@/lib/services/users';
import { parsePageSize } from '@/lib/list-params';
import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { HotelsManager } from './_components/hotels-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: '호텔 마스터 — OA 통합 AS 어드민' };

type SearchParams = Promise<{
  q?: string;
  status?: 'active' | 'inactive' | 'all';
  page?: string;
  pageSize?: string;
}>;

export default async function AdminHotelsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Phase 2: 호텔 마스터는 어드민 전용.
  await requireRole(['admin']);
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const requestedPageSize = parsePageSize(params.pageSize);
  const isActive =
    params.status === 'all'
      ? 'all'
      : params.status === 'inactive'
        ? false
        : true;

  const { items, total, pageSize } = await listHotels({
    q: params.q,
    isActive,
    page,
    pageSize: requestedPageSize,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="호텔 마스터"
        guideAnchor="accounts"
        description={`총 ${total}개 호텔. OA PMS 매핑 ID와 기본 정보를 관리합니다.`}
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="등록된 호텔이 없습니다"
              description="아래에서 첫 호텔을 추가해보세요."
            />
            <div className="mt-4">
              <HotelsManager initialHotels={[]} total={0} page={1} pageSize={pageSize} initial={params} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <HotelsManager
          initialHotels={items}
          total={total}
          page={page}
          pageSize={pageSize}
          initial={params}
        />
      )}
    </div>
  );
}
