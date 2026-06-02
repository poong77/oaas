import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * 사용자 편집 페이지 로딩 스켈레톤.
 *
 * 리스트에서 행 클릭 → /admin/users/[id] 전환 시, 서버에서
 * getUserById + listHotels(200건)를 가져오는 동안 즉시 표시된다.
 * 실제 페이지(헤더 + 편집 카드 + 액션 카드)와 동일 골격으로 맞춰 CLS를 방지.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      {/* 페이지 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-48 sm:w-64" />
          <Skeleton className="h-4 w-64 max-w-full sm:w-80" />
        </div>
        <Skeleton className="h-9 w-24 flex-shrink-0 rounded-md" />
      </div>

      {/* 계정 정보 편집 카드 */}
      <Card>
        <CardHeader className="flex flex-col gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <Skeleton className="h-9 w-20 rounded-md" />
        </CardFooter>
      </Card>

      {/* 계정 관리(액션) 카드 */}
      <Card>
        <CardHeader className="flex flex-col gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-9 w-full rounded-md sm:w-40" />
          <Skeleton className="h-9 w-full rounded-md sm:w-40" />
        </CardContent>
      </Card>
    </div>
  );
}
