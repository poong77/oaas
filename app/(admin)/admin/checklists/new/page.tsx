/**
 * /admin/checklists/new — 새 체크리스트 메타데이터 작성 (SF-04).
 *
 * 메타 저장 후 자동으로 /[id] 편집 페이지로 이동해 단계를 추가합니다.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/permissions';
import {
  getCategoriesByType,
  getProductCategories,
} from '@/lib/services/categories';
import { PageHeader } from '@/components/ui/page-header';
import { ChecklistMetaForm } from '../_components/checklist-meta-form';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: '새 체크리스트 — OA서포트 어드민',
};

export default async function NewChecklistPage() {
  await requireRole(['manager', 'admin']);
  const [productCategories, issueTypeCategories] = await Promise.all([
    getProductCategories(),
    getCategoriesByType('issue_type'),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="새 체크리스트"
        description="제품과 제목 등 메타데이터를 입력하면 단계 편집 페이지로 이동합니다."
        breadcrumb={
          <Link
            href="/admin/checklists"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            체크리스트 관리
          </Link>
        }
      />

      <ChecklistMetaForm
        mode="create"
        productCategories={productCategories}
        issueTypeCategories={issueTypeCategories.map((c) => ({
          code: c.code,
          label: c.label,
        }))}
      />
    </div>
  );
}
