import { PageHeaderSkeleton, SearchResultsSkeleton } from '@/components/ui/skeletons';

/** /search 진입 시 — 헤더 즉시 + 결과 영역 스켈레톤. */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeaderSkeleton />
      <SearchResultsSkeleton />
    </div>
  );
}
