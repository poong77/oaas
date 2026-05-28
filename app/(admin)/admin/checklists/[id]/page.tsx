/**
 * /admin/checklists/[id] — 체크리스트 편집 + 단계 관리 (SF-04).
 *
 * 상단: 메타데이터 폼
 * 하단: 단계 리스트 (CRUD + 순서 변경)
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { requireRole } from '@/lib/permissions';
import { getChecklistWithSteps } from '@/lib/services/checklists';
import {
  getCategoriesByType,
  getProductCategories,
} from '@/lib/services/categories';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChecklistMetaForm } from '../_components/checklist-meta-form';
import { ChecklistStepsEditor } from '../_components/checklist-steps-editor';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { id } = await params;
  const c = await getChecklistWithSteps(id, {
    includeInactive: true,
    includeInactiveSteps: true,
  });
  return {
    title: c ? `${c.title} 편집 — 어드민` : '체크리스트 편집 — 어드민',
  };
}

export default async function EditChecklistPage({
  params,
}: {
  params: RouteParams;
}) {
  await requireRole(['manager', 'admin']);
  const { id } = await params;
  const [checklist, productCategories, issueTypeCategories] = await Promise.all(
    [
      getChecklistWithSteps(id, {
        includeInactive: true,
        includeInactiveSteps: true,
      }),
      getProductCategories(),
      getCategoriesByType('issue_type'),
    ],
  );
  if (!checklist) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            체크리스트 편집
            {!checklist.isActive && <Badge tone="danger">비활성</Badge>}
          </span>
        }
        description={checklist.title}
        breadcrumb={
          <Link
            href="/admin/checklists"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            체크리스트 관리
          </Link>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/troubleshoot/${checklist.id}`} target="_blank">
              <ExternalLink className="h-3.5 w-3.5" />
              공개 페이지
            </Link>
          </Button>
        }
      />

      <ChecklistMetaForm
        mode="edit"
        productCategories={productCategories}
        issueTypeCategories={issueTypeCategories.map((c) => ({
          code: c.code,
          label: c.label,
        }))}
        initial={{
          id: checklist.id,
          productCode: checklist.productCode,
          issueType: checklist.issueType,
          title: checklist.title,
          description: checklist.description ?? '',
          sortOrder: checklist.sortOrder,
        }}
      />

      <ChecklistStepsEditor
        checklistId={checklist.id}
        steps={checklist.steps}
      />
    </div>
  );
}
