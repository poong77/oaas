/**
 * /admin/master/menu-taxonomies — 메뉴 구조 마스터 인덱스.
 *
 * 제품별 트리 시각화. 깊이별 들여쓰기. 활성/비활성 토글. 어드민 only.
 *
 * @see docs/01-plan/features/아티클관리시스템.plan.md §5.2, P0-W
 */

import Link from 'next/link';
import {
  ArrowRight,
  FolderTree,
  Plus,
  Sparkles,
} from 'lucide-react';
import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  listMenuTaxonomyTree,
  type MenuTaxonomyTreeNode,
} from '@/lib/services/master-menu-taxonomies';
import { getProductCategories } from '@/lib/services/categories';

export const dynamic = 'force-dynamic';
export const metadata = { title: '메뉴 구조 — 마스터' };

export default async function MenuTaxonomyIndexPage() {
  await requireRole(['admin']);

  const [tree, productCategories] = await Promise.all([
    listMenuTaxonomyTree({ includeInactive: true }),
    getProductCategories(),
  ]);

  const productLabel = (code: string): string =>
    productCategories.find((c) => c.code === code)?.label ?? code;

  const productsWithMenus = Object.keys(tree);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="메뉴 구조"
        description="도움말 아티클의 menu_path 정본. 제품별 대메뉴/중메뉴/소메뉴 트리. 최대 3단."
      />

      <div className="flex justify-end">
        <Link href="/admin/master/menu-taxonomies/new">
          <Button>
            <Plus className="h-4 w-4" />새 메뉴
          </Button>
        </Link>
      </div>

      {productsWithMenus.length === 0 ? (
        <EmptyState
          icon={<FolderTree className="h-10 w-10 text-slate-300" />}
          title="등록된 메뉴 구조가 없습니다"
          description="제품별 메뉴 트리를 만들어 아티클의 menu_path가 가리킬 정본을 마련하세요."
          action={
            <Link href="/admin/master/menu-taxonomies/new">
              <Button size="sm">
                <Plus className="h-3 w-3" />첫 메뉴 추가
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {productsWithMenus.map((productCode) => (
            <Card key={productCode}>
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {productLabel(productCode)}
                    </span>
                    <Badge tone="slate" className="text-[10px] font-mono">
                      {productCode}
                    </Badge>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {countNodes(tree[productCode])}개 노드
                    </span>
                  </div>
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tree[productCode].map((node) => (
                    <TreeNodeRow key={node.id} node={node} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            <strong className="text-slate-900 dark:text-slate-100">
              메뉴 구조 사용처
            </strong>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              여기서 정의한 트리는 <span className="font-mono">articles.category_path</span>{' '}
              필드(=menu_path)가 가리키는 정본입니다. 아티클 작성 시 cascading
              select로 노출되며, 비활성된 노드를 가리키는 아티클은 어드민
              경고 배지로 표시됩니다. FK는 두지 않아 라벨 변경/이동이 자유롭습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function countNodes(nodes: MenuTaxonomyTreeNode[]): number {
  let n = 0;
  const walk = (arr: MenuTaxonomyTreeNode[]): void => {
    for (const node of arr) {
      n += 1;
      walk(node.children);
    }
  };
  walk(nodes);
  return n;
}

function TreeNodeRow({ node }: { node: MenuTaxonomyTreeNode }) {
  return (
    <>
      <li>
        <Link
          href={`/admin/master/menu-taxonomies/${node.id}`}
          className="group flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          style={{ paddingLeft: `${16 + node.depth * 24}px` }}
        >
          <FolderTree
            className={`h-3.5 w-3.5 shrink-0 ${
              node.depth === 0
                ? 'text-brand-500'
                : node.depth === 1
                  ? 'text-amber-500'
                  : 'text-slate-400'
            }`}
          />
          <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
            {node.label}
          </span>
          {!node.isActive && (
            <Badge tone="slate" className="text-[10px]">
              비활성
            </Badge>
          )}
          {node.children.length > 0 && (
            <span className="text-xs text-slate-400">
              · 하위 {node.children.length}
            </span>
          )}
          <ArrowRight className="h-3.5 w-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </li>
      {node.children.map((child) => (
        <TreeNodeRow key={child.id} node={child} />
      ))}
    </>
  );
}
