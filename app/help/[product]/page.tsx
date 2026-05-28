/**
 * /help/[product] — 제품별 핸드북 placeholder.
 *
 * Phase 3에서 articles 테이블 + 마크다운 렌더 + 검색 구현.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { getProductCategories } from '@/lib/services/categories';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ product: string }>;

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { product } = await params;
  return { title: `${product.toUpperCase()} 가이드 — OA 통합 AS` };
}

export default async function HelpProductPage({
  params,
}: {
  params: RouteParams;
}) {
  const { product } = await params;
  const categories = await getProductCategories();
  const current = categories.find((c) => c.code === product);
  if (!current) notFound();

  const others = categories.filter((c) => c.code !== product);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title={`${current.label} 가이드`}
        description={`${current.label} 사용을 위한 핸드북 · FAQ · 체크리스트가 모일 공간입니다.`}
        breadcrumb={
          <Link
            href="/help"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            제품별 가이드
          </Link>
        }
      />

      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={<BookOpen className="h-6 w-6" />}
            title="핸드북 콘텐츠는 Phase 3에서 추가됩니다"
            description="현재 help.oapms.com에 있는 콘텐츠를 정식 이관할 예정입니다. 급한 문의는 아래 버튼으로 접수해주세요."
            action={
              <Button asChild size="sm">
                <Link href={`/tickets/new?product=${current.code}`}>
                  {current.label} 문의 접수
                </Link>
              </Button>
            }
          />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">다른 제품도 함께 살펴보기</h3>
        <ul className="flex flex-wrap gap-2">
          {others.map((o) => (
            <li key={o.id}>
              <Link
                href={`/help/${o.code}`}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-700"
              >
                {o.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
