import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * 페이지 전환·검색 대기 중 보여줄 합성 스켈레톤 모음.
 *
 * 실제 페이지의 컨테이너 규격(max-w, padding, gap)과 카드 구조를 그대로 맞춰
 * 스켈레톤 → 콘텐츠 전환 시 화면이 튀지 않도록 한다.
 */

/** 페이지 상단 제목 + 설명 자리. */
export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-7 w-48 sm:w-64" />
      <Skeleton className="h-4 w-72 max-w-full sm:w-96" />
    </div>
  );
}

/** 검색/목록 결과 카드 1개. */
export function ResultCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="mt-1 flex items-center gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/** 결과 카드 N개 리스트. */
export function ListSkeleton({
  count = 5,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <ul className={cn('grid gap-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <ResultCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

/** 가로 탭 줄 (검색 탭 / 필터 칩). */
export function TabBarSkeleton({ tabs = 5 }: { tabs?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {Array.from({ length: tabs }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-20 rounded-full" />
      ))}
    </div>
  );
}

/** 검색 결과 영역(탭 + 필터 + 리스트) Suspense fallback. */
export function SearchResultsSkeleton() {
  return (
    <>
      <TabBarSkeleton tabs={5} />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <ListSkeleton count={6} />
    </>
  );
}

/**
 * 범용 페이지 스켈레톤 — loading.tsx 기본형.
 * 목록형 페이지 전환 시 헤더 + 카드 리스트 자리를 잡아준다.
 */
export function PageShellSkeleton({
  cards = 5,
  withTabs = false,
}: {
  cards?: number;
  withTabs?: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeaderSkeleton />
      {withTabs && <TabBarSkeleton />}
      <ListSkeleton count={cards} />
    </div>
  );
}
