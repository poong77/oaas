/**
 * /troubleshoot — 트러블슈팅 허브 (SF-02).
 *
 * Phase 4:
 *   - 제품별 체크리스트 카드 그리드
 *   - 검색·필터·정렬
 *   - 각 카드: 제목, 설명, 단계 수, 해결률(%)
 *   - 카드 클릭 → /troubleshoot/[id] 진행 화면
 */

import Link from 'next/link';
import {
  ArrowRight,
  HelpCircle,
  ListChecks,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { listChecklists } from '@/lib/services/checklists';
import { getProductCategories } from '@/lib/services/categories';
import { buildProductMap } from '@/components/faqs/category-maps';
import { ContactPanel } from '@/components/contact/contact-panel';
import { TroubleshootFilters } from './_components/troubleshoot-filters';

export const dynamic = 'force-dynamic';
export const metadata = { title: '트러블슈팅 — OA서포트' };

type SearchParams = Promise<{
  q?: string;
  productCode?: string;
}>;

export default async function TroubleshootHubPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const [{ items, total }, productCategories] = await Promise.all([
    listChecklists({
      q: sp.q,
      productCode: sp.productCode,
      isActive: true,
      sortBy: 'sort_order',
      sortOrder: 'asc',
      page: 1,
      pageSize: 100,
    }),
    getProductCategories(),
  ]);

  const productMap = buildProductMap(productCategories);
  const hasFilter = Boolean(sp.q || sp.productCode);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_300px] lg:gap-10">
        <div className="flex flex-col gap-6">
      <PageHeader
        title="트러블슈팅 체크리스트"
        description={`단계별로 진단하며 ${total}개 시나리오에서 해결 방법을 찾습니다.`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/faq">
              <HelpCircle className="h-4 w-4" />
              FAQ
            </Link>
          </Button>
        }
      />

      <TroubleshootFilters
        initial={{ q: sp.q, productCode: sp.productCode }}
        productCategories={productCategories}
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<ListChecks className="h-6 w-6" />}
              title={
                hasFilter
                  ? '조건에 맞는 체크리스트가 없습니다'
                  : '등록된 체크리스트가 아직 없습니다'
              }
              description={
                hasFilter
                  ? '다른 제품을 선택하거나 검색어를 변경해보세요. 그래도 답이 없으면 직접 문의를 접수해주세요.'
                  : 'FAQ를 먼저 확인하거나 직접 문의를 접수해주세요.'
              }
              action={
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/faq">FAQ 보기</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/tickets/new">문의 접수</Link>
                  </Button>
                </div>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => {
            const resolved = c.resolvedCount;
            const escalated = c.escalatedCount;
            const completed = resolved + escalated;
            const successRate =
              completed > 0
                ? Math.round((resolved / completed) * 100)
                : null;
            const productLabel =
              productMap[c.productCode]?.label ?? c.productCode;
            return (
              <Link
                key={c.id}
                href={`/troubleshoot/${c.id}`}
                className="group flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/30 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700 dark:hover:bg-brand-950/20"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="brand" className="uppercase">
                    {productLabel}
                  </Badge>
                  <Badge tone="slate">{c.stepCount}단계</Badge>
                </div>
                <h3 className="text-base font-semibold leading-snug text-slate-900 dark:text-slate-100">
                  {c.title}
                </h3>
                {c.description && (
                  <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                    {c.description}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between pt-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex flex-col gap-0.5">
                    <span>진행 {c.viewCount.toLocaleString()}회</span>
                    {successRate !== null && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        해결률 {successRate}%
                        <span className="ml-1 text-slate-400">
                          ({resolved}/{completed})
                        </span>
                      </span>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-brand-500 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Card className="bg-slate-50/40 dark:bg-slate-900/30">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            적절한 체크리스트가 없거나 단계 진행 후에도 해결되지 않으면 문의를 접수해주세요.
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/faq">FAQ</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/tickets/new">문의 접수</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
        </div>
        <ContactPanel variant="sidebar" />
      </div>
    </div>
  );
}
