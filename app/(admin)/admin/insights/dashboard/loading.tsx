/**
 * /admin/insights/dashboard 로딩 스켈레톤.
 * 서버 컴포넌트가 집계 쿼리를 수행하는 동안 Suspense fallback으로 즉시 표시.
 * 실제 레이아웃과 같은 구조/높이로 맞춰 CLS 최소화.
 */

import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function SectionLabel() {
  return <Skeleton className="h-3 w-40" />;
}

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="대시보드"
        description="데이터를 불러오는 중…"
      />

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-900/30">
        <Skeleton className="h-7 w-12" />
        <Skeleton className="h-7 w-12" />
        <Skeleton className="h-7 w-14" />
        <Skeleton className="ml-2 h-7 w-28" />
      </div>

      {/* ① 액션 카드 2 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-start gap-4 p-5">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-3 w-48" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* ② 핵심지표 3 */}
      <section className="flex flex-col gap-2">
        <SectionLabel />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-1.5 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ③ 퍼널 */}
      <section className="flex flex-col gap-2">
        <SectionLabel />
        <Card>
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-stretch">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 flex-1 rounded-xl" />
            ))}
          </CardContent>
        </Card>
      </section>

      {/* ④ 검색 · 호텔 */}
      <section className="flex flex-col gap-2">
        <SectionLabel />
        <Card>
          <CardContent className="p-5">
            <Skeleton className="mb-3 h-4 w-40" />
            <Skeleton className="h-[280px] w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Skeleton className="mb-4 h-4 w-48" />
            <Skeleton className="h-[420px] w-full rounded-lg" />
          </CardContent>
        </Card>
      </section>

      {/* ⑤ 유입 분석 */}
      <section className="flex flex-col gap-2">
        <SectionLabel />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="p-5">
              <Skeleton className="mb-3 h-4 w-40" />
              <Skeleton className="h-[240px] w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <Skeleton className="mb-3 h-4 w-24" />
              <Skeleton className="h-[240px] w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent className="p-5">
            <Skeleton className="mb-3 h-4 w-48" />
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </CardContent>
        </Card>
      </section>

      {/* ⑥ 처리 · 완료 */}
      <section className="flex flex-col gap-2">
        <SectionLabel />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4 text-center">
                <Skeleton className="mx-auto h-3 w-12" />
                <Skeleton className="mx-auto h-7 w-10" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-4 w-48" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
