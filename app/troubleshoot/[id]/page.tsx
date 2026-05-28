/**
 * /troubleshoot/[id] — 체크리스트 진행 화면 (SF-02).
 *
 * Server Component (메타데이터 + 데이터 페치) → Client `ChecklistRunner` 위임.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { getChecklistWithSteps } from '@/lib/services/checklists';
import { getProductCategories } from '@/lib/services/categories';
import { buildProductMap } from '@/components/faqs/category-maps';
import { ChecklistRunner } from './_components/checklist-runner';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { id } = await params;
  const checklist = await getChecklistWithSteps(id);
  return {
    title: checklist
      ? `${checklist.title} — 트러블슈팅`
      : '트러블슈팅 체크리스트',
  };
}

export default async function TroubleshootRunPage({
  params,
}: {
  params: RouteParams;
}) {
  const { id } = await params;

  const [checklist, productCategories] = await Promise.all([
    getChecklistWithSteps(id),
    getProductCategories(),
  ]);

  if (!checklist) {
    notFound();
  }

  const productMap = buildProductMap(productCategories);
  const productLabel = productMap[checklist.productCode]?.label ?? checklist.productCode;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title={checklist.title}
        description={checklist.description ?? '단계별로 답하여 문제를 진단합니다.'}
        breadcrumb={
          <Link
            href="/troubleshoot"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            트러블슈팅 목록
          </Link>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/faq">FAQ도 확인</Link>
          </Button>
        }
      />

      <ChecklistRunner
        checklist={checklist}
        steps={checklist.steps}
        productLabel={productLabel}
      />
    </div>
  );
}
