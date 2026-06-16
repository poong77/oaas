import { PageHeaderSkeleton, SearchResultsSkeleton } from '@/components/ui/skeletons';
import { PageContainer } from '@/components/layout/page-container';

/** /search 진입 시 — 헤더 즉시 + 결과 영역 스켈레톤. */
export default function Loading() {
  return (
    <PageContainer className="py-10 sm:py-14" innerClassName="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <SearchResultsSkeleton />
    </PageContainer>
  );
}
