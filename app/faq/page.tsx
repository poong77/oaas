/**
 * /faq — 빠른 해결 (FAQ) — SF-01.
 *
 * Phase 4:
 *   - 제품·문제유형 필터 + 키워드 검색
 *   - 아코디언 (details/summary)
 *   - 펼침 시 view_count +1 (fire-and-forget Server Action)
 *   - 도움됨 위젯 (helpful_yes/no, localStorage 1회 차단)
 *   - URL 해시 #faq-{id} 자동 펼침
 *   - EmptyState → 문의 접수 안내
 *
 * 호환:
 *   - /troubleshoot 링크로 트러블슈팅 허브 안내
 *   - 모바일 우선 디자인 (필터 stack, 카드 풀너비)
 */

import Link from 'next/link';
import { Lightbulb, ListChecks } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  getCategoriesByType,
  getProductCategories,
} from '@/lib/services/categories';
import { listFaqs } from '@/lib/services/faqs';
import { FaqAccordion } from '@/components/faqs/faq-accordion';
import {
  buildIssueTypeMap,
  buildProductMap,
} from '@/components/faqs/category-maps';
import { ContactPanel } from '@/components/contact/contact-panel';
import { FaqFilters } from './_components/faq-filters';

export const dynamic = 'force-dynamic';
export const metadata = { title: '빠른 해결 — OA서포트' };

type SearchParams = Promise<{
  q?: string;
  productCode?: string;
  issueType?: string;
}>;

export default async function FaqPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const [
    { items, total },
    productCategories,
    issueTypeCategories,
  ] = await Promise.all([
    listFaqs({
      q: sp.q,
      productCode: sp.productCode,
      issueType: sp.issueType,
      isActive: true,
      sortBy: 'sort_order',
      sortOrder: 'asc',
      page: 1,
      pageSize: 100,
    }),
    getProductCategories(),
    getCategoriesByType('issue_type'),
  ]);

  const productMap = buildProductMap(productCategories);
  const issueTypeMap = buildIssueTypeMap(
    issueTypeCategories.map((c) => ({ code: c.code, label: c.label })),
  );

  const hasFilter = Boolean(sp.q || sp.productCode || sp.issueType);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_300px] lg:gap-10">
        <div className="flex flex-col gap-6">
      <PageHeader
        title="빠른 해결"
        description={`자주 묻는 질문 ${total}건. 답이 없으면 트러블슈팅 체크리스트나 문의 접수로 이동하세요.`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/troubleshoot">
              <ListChecks className="h-4 w-4" />
              트러블슈팅
            </Link>
          </Button>
        }
      />

      <FaqFilters
        initial={{
          q: sp.q,
          productCode: sp.productCode,
          issueType: sp.issueType,
        }}
        productCategories={productCategories}
        issueTypeCategories={issueTypeCategories.map((c) => ({
          code: c.code,
          label: c.label,
        }))}
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Lightbulb className="h-6 w-6" />}
              title={
                hasFilter
                  ? '조건에 맞는 FAQ가 없습니다'
                  : '등록된 FAQ가 아직 없습니다'
              }
              description={
                hasFilter
                  ? '다른 제품/유형을 선택하거나 검색어를 변경해보세요. 그래도 답이 없으면 직접 문의를 접수해주세요.'
                  : '잠시 후 다시 확인하거나 직접 문의를 접수해주세요.'
              }
              action={
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/troubleshoot">트러블슈팅 시도</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link
                      href={
                        sp.q ? `/tickets/new?q=${encodeURIComponent(sp.q)}` : '/tickets/new'
                      }
                    >
                      문의 접수
                    </Link>
                  </Button>
                </div>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <FaqAccordion
          items={items}
          productMap={productMap}
          issueTypeMap={issueTypeMap}
        />
      )}

      <Card className="bg-slate-50/40 dark:bg-slate-900/30">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            원하시는 답을 찾지 못하셨나요?
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/troubleshoot">트러블슈팅</Link>
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
