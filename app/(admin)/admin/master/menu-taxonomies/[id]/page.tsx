/**
 * /admin/master/menu-taxonomies/[id] — 메뉴 노드 상세 (편집 + 활성 토글).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FolderTree } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getMenuTaxonomyById,
  listMenuTaxonomyFlat,
  type MenuTaxonomyFlatNode,
} from '@/lib/services/master-menu-taxonomies';
import { getProductCategories } from '@/lib/services/categories';
import {
  MenuTaxonomyForm,
  type ParentOption,
  type ProductOption,
} from '../_components/menu-taxonomy-form';
import { ToggleActiveButton } from '../_components/toggle-active-button';

export const dynamic = 'force-dynamic';

export default async function MenuTaxonomyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['manager', 'admin']);
  const { id } = await params;
  const node = await getMenuTaxonomyById(id);
  if (!node) notFound();

  const [flat, productCategories] = await Promise.all([
    listMenuTaxonomyFlat({ includeInactive: false }),
    getProductCategories(),
  ]);

  const productOptions: ProductOption[] = productCategories.map((p) => ({
    code: p.code,
    label: p.label,
  }));

  // 자기 자신 + 후손은 부모로 선택 불가
  const descendants = collectDescendants(flat, id);
  const excludeParentIds = [id, ...descendants];

  const parentOptions: ParentOption[] = flat.map((n) => ({
    value: n.id,
    label: n.pathLabels.join(' › '),
    productCode: n.productCode,
    depth: n.depth,
  }));

  const productLabel =
    productCategories.find((c) => c.code === node.productCode)?.label ??
    node.productCode;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/master/menu-taxonomies"
        className="inline-flex w-fit items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-3 w-3" />
        메뉴 구조 목록
      </Link>

      <PageHeader
        title={node.label}
        description={`${productLabel} · 경로: ${node.pathLabels.join(' › ')}`}
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
            <FolderTree className="h-4 w-4" />
          </span>
          <div className="flex flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {node.productCode}
              </span>
              <Badge tone="slate" className="text-[10px]">
                깊이 {node.depth}
              </Badge>
              <Badge
                tone={node.isActive ? 'success' : 'slate'}
                className="text-[10px]"
              >
                {node.isActive ? '활성' : '비활성'}
              </Badge>
              {node.childCount > 0 && (
                <Badge tone="brand" className="text-[10px]">
                  하위 {node.childCount}개
                </Badge>
              )}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              생성 {new Date(node.createdAt).toLocaleDateString('ko-KR')} · 수정{' '}
              {new Date(node.updatedAt).toLocaleDateString('ko-KR')}
            </span>
          </div>
          <ToggleActiveButton
            id={node.id}
            isActive={node.isActive}
            childCount={node.childCount}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            메뉴 정보 편집
          </h2>
          <MenuTaxonomyForm
            node={node}
            productOptions={productOptions}
            parentOptions={parentOptions}
            excludeParentIds={excludeParentIds}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function collectDescendants(
  flat: MenuTaxonomyFlatNode[],
  rootId: string,
): string[] {
  const result: string[] = [];
  const queue: string[] = [rootId];
  let safety = 0;
  while (queue.length > 0 && safety < 100) {
    const cur = queue.shift()!;
    for (const n of flat) {
      if (n.parentId === cur) {
        result.push(n.id);
        queue.push(n.id);
      }
    }
    safety += 1;
  }
  return result;
}
