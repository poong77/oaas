/**
 * /admin/master/product-categories — 제품 분류(대/중/소 + 메모) 트리 관리.
 *
 * categories(type='product')의 parent_id 계층을 트리 UI로 편집한다.
 * 대(0)/중(1)/소(2) 최대 3단. 매니저+어드민 (메뉴 접근 제어 토글 대상).
 *
 * 기존 4종 카테고리 페이지(/admin/master/categories)에서 '제품'을 분리한 전용 메뉴.
 */

import Link from 'next/link';
import { ArrowLeft, FolderTree, Layers, ListTree } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  listProductCategoryAdminTree,
  type ProductCategoryAdminNode,
} from '@/lib/services/master-categories';
import { ProductTreeEditor } from './_components/product-tree-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '제품 분류 — 마스터DB' };

type Stats = { roots: number; total: number; inactive: number; maxDepth: number };

function collectStats(tree: ProductCategoryAdminNode[]): Stats {
  let total = 0;
  let inactive = 0;
  let maxDepth = 0;
  const walk = (nodes: ProductCategoryAdminNode[]) => {
    for (const n of nodes) {
      total += 1;
      if (!n.isActive) inactive += 1;
      if (n.depth > maxDepth) maxDepth = n.depth;
      walk(n.children);
    }
  };
  walk(tree);
  return { roots: tree.length, total, inactive, maxDepth };
}

export default async function MasterProductCategoriesPage() {
  await requireRole(['manager', 'admin']);
  const tree = await listProductCategoryAdminTree();
  const stats = collectStats(tree);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="제품 분류"
        description="대분류 · 중분류 · 소분류 3단계 + 메모로 제품 분류 트리를 관리합니다. 접수폼·홈·검색 전반에 영향."
        breadcrumb={
          <Link
            href="/admin/master"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 마스터DB
          </Link>
        }
      />

      {/* 요약 통계 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="대분류" value={stats.roots} />
        <StatCard label="전체 항목" value={stats.total} />
        <StatCard label="비활성" value={stats.inactive} />
        <StatCard
          label="최대 깊이"
          value={`${stats.maxDepth + 1}단`}
          hint={['대', '대·중', '대·중·소'][stats.maxDepth] ?? '대'}
        />
      </div>

      {tree.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<FolderTree className="h-6 w-6" />}
              title="등록된 제품 분류가 없습니다"
              description="“대분류 추가”로 PMS·CMS·Keyless 같은 대분류부터 만들어 보세요. 시드 스크립트(db/seed-product-taxonomy.ts)로 일괄 생성할 수도 있습니다."
            />
            <div className="mt-4">
              <ProductTreeEditor tree={tree} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <ProductTreeEditor tree={tree} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
            <ListTree className="h-4 w-4" />
          </span>
          <div className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            <strong className="text-slate-900 dark:text-slate-100">
              제품 분류 사용처 · 운영 원칙
            </strong>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              문의 접수 시 <strong>호텔리어는 대분류만</strong>, 매니저·어드민은
              대·중·소 전 단계를 선택합니다. 비활성화는 소프트 삭제로, 접수폼·홈에서는
              숨겨지지만 기존 티켓의 제품 참조는 유지됩니다. 코드(code)는 티켓·아티클이
              참조하므로 가급적 변경하지 마세요. 이슈 유형 · 긴급도 · 영향 범위는{' '}
              <Link
                href="/admin/master/inquiry-classification?tab=issue_type"
                className="text-brand-600 underline"
              >
                문의 분류 메뉴
              </Link>
              에서 편집합니다.
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400">
        <Layers className="mr-1 inline h-3 w-3" />
        Phase 9 — 제품 분류 마스터
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-0.5 p-3">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {value}
        </span>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </CardContent>
    </Card>
  );
}
