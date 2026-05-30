/**
 * /admin/master/menu-taxonomies/new — 신규 메뉴 노드.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  listMenuTaxonomyFlat,
  type MenuTaxonomyFlatNode,
} from '@/lib/services/master-menu-taxonomies';
import { getProductCategories } from '@/lib/services/categories';
import {
  MenuTaxonomyForm,
  type ParentOption,
  type ProductOption,
} from '../_components/menu-taxonomy-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: '새 메뉴 노드 — 마스터' };

export default async function MenuTaxonomyNewPage() {
  await requireRole(['admin']);

  const [flat, productCategories] = await Promise.all([
    listMenuTaxonomyFlat({ includeInactive: false }),
    getProductCategories(),
  ]);

  const productOptions: ProductOption[] = productCategories.map((p) => ({
    code: p.code,
    label: p.label,
  }));

  const parentOptions = toParentOptions(flat);

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
        title="새 메뉴 노드"
        description="제품과 상위 메뉴를 정합니다. 비우면 대메뉴(루트)로 추가됩니다."
      />
      <Card>
        <CardContent className="p-5">
          <MenuTaxonomyForm
            productOptions={productOptions}
            parentOptions={parentOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function toParentOptions(flat: MenuTaxonomyFlatNode[]): ParentOption[] {
  return flat.map((n) => ({
    value: n.id,
    label: n.pathLabels.join(' › '),
    productCode: n.productCode,
    depth: n.depth,
  }));
}
