/**
 * /search?q=... — Phase 3에서 실 통합 검색 구현.
 *
 * Phase 2에서는:
 *   - 쿼리 표시
 *   - "Phase 3에서 검색 추가 예정" 안내
 *   - 카테고리 / 자주찾는작업 카드로 사용자가 자가 탐색 가능하게 유도
 */

import Link from 'next/link';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { getProductCategories } from '@/lib/services/categories';
import { resolveIcon } from '@/app/_components/home/_icon-map';
import { QUICK_ACTIONS } from '@/app/_components/home/_constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: '검색 — OA 통합 AS' };

type SearchParams = Promise<{ q?: string }>;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const categories = await getProductCategories();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title={query ? `검색 결과 — "${query}"` : '검색'}
        description={
          query
            ? '입력하신 키워드와 관련된 도움말·FAQ·공지를 통합 검색합니다.'
            : '도움말 통합 검색은 Phase 3에서 추가됩니다.'
        }
      />

      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="검색 결과 준비 중입니다"
            description="Phase 3에서 도움말·FAQ·공지·장애 탭별 통합 검색 기능이 추가됩니다. 그동안은 아래 카테고리 / 자주 찾는 작업을 이용해주세요."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/">홈으로 돌아가기</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>

      {/* 카테고리 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold tracking-tight sm:text-base">
          제품별로 찾기
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((cat) => {
            const Icon = resolveIcon(cat.icon);
            return (
              <li key={cat.id}>
                <Link
                  href={`/help/${cat.code}`}
                  className="flex h-full flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white p-3 text-center text-xs font-medium hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
                >
                  <Icon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <span>{cat.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 자주 찾는 작업 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold tracking-tight sm:text-base">
          자주 찾는 작업
        </h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map((qa) => {
            const Icon = qa.icon;
            return (
              <li key={qa.label}>
                <Link
                  href={qa.href}
                  className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
                >
                  <Icon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  {qa.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
