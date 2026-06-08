/**
 * /admin/master/categories — 카테고리 관리 (Phase 9).
 *
 * 4 타입(product/issue_type/urgency/impact) 탭 UI. 단일 페이지에서 type 쿼리로 분기.
 * 매니저+어드민. (type, code) unique.
 */

import Link from 'next/link';
import { ArrowLeft, Layers } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { listAllCategories } from '@/lib/services/master-categories';
import type { CategoryType } from '@/db/schema';
import { CategoriesEditor } from './_components/categories-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '카테고리 관리 — 마스터DB' };

const TABS: Array<{ key: CategoryType; label: string; description: string }> = [
  {
    key: 'product',
    label: '제품',
    description: 'PMS · CMS · Keyless · 키오스크 · 웹서비스 · 설정',
  },
  {
    key: 'issue_type',
    label: '이슈 유형',
    description: '오류 · 장애 · 기능문의 · 기능개발 · 데이터수정 · 기타',
  },
  {
    key: 'urgency',
    label: '긴급도',
    description: 'P1 (긴급) · P2 (보통) · P3 (낮음)',
  },
  {
    key: 'impact',
    label: '영향 범위',
    description: '전체 호텔 · 단일 호텔 · 단일 사용자 · 정보성',
  },
];

type SearchParams = Promise<{ type?: CategoryType }>;

export default async function MasterCategoriesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(['manager', 'admin']);
  const sp = await searchParams;
  const activeType: CategoryType =
    sp.type && TABS.some((t) => t.key === sp.type) ? sp.type : 'product';

  const items = await listAllCategories(activeType, true);

  const activeTabMeta = TABS.find((t) => t.key === activeType)!;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="카테고리 관리"
        description="제품 · 이슈 유형 · 긴급도 · 영향 범위 4종을 통합 편집합니다."
        breadcrumb={
          <Link
            href="/admin/master"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 마스터DB
          </Link>
        }
      />

      {/* 탭 */}
      <nav className="flex flex-wrap gap-1 border-b border-slate-200 pb-1 dark:border-slate-800">
        {TABS.map((tab) => {
          const isActive = tab.key === activeType;
          return (
            <Link
              key={tab.key}
              href={{
                pathname: '/admin/master/categories',
                query: { type: tab.key },
              }}
              className={
                isActive
                  ? 'rounded-md bg-brand-100 px-3 py-1.5 text-sm font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                  : 'rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
              }
            >
              {tab.label}{' '}
              <Badge tone="slate" className="ml-1 text-[10px]">
                {tab.key === activeType ? items.length : '·'}
              </Badge>
            </Link>
          );
        })}
      </nav>

      <Card>
        <CardContent className="flex flex-col gap-1 p-4">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {activeTabMeta.label}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {activeTabMeta.description}
          </div>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Layers className="h-6 w-6" />}
              title="등록된 항목이 없습니다"
              description="아래 폼에서 신규 추가하세요."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <CategoriesEditor type={activeType} items={items} />
          </CardContent>
        </Card>
      )}

      {/* 신규 추가 폼 (재사용 — id 없음) */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              신규 추가
            </h3>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              asChild
            >
              <Link
                href={{
                  pathname: '/admin/master/categories',
                  query: { type: activeType },
                }}
              >
                새로고침
              </Link>
            </Button>
          </div>
          <CategoriesEditor type={activeType} items={[]} createOnly />
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400">
        <Layers className="mr-1 inline h-3 w-3" />
        Phase 9 — 카테고리 마스터
      </p>
    </div>
  );
}
