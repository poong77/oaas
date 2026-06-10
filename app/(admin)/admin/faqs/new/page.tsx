/**
 * /admin/faqs/new — 새 FAQ 생성 (SF-04).
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/permissions';
import {
  getCategoriesByType,
  getProductCategories,
} from '@/lib/services/categories';
import { PageHeader } from '@/components/ui/page-header';
import { FaqEditor } from '../_components/faq-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '새 FAQ — OA서포트 어드민' };

export default async function NewFaqPage({
  searchParams,
}: {
  searchParams: Promise<{ question?: string }>;
}) {
  await requireRole(['manager', 'admin']);
  const [{ question }, productCategories, issueTypeCategories] =
    await Promise.all([
      searchParams,
      getProductCategories(),
      getCategoriesByType('issue_type'),
    ]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="새 FAQ"
        description="제품·문제유형을 선택하고 질문과 답변(마크다운)을 입력하세요."
        breadcrumb={
          <Link
            href="/admin/faqs"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            FAQ 관리
          </Link>
        }
      />
      <FaqEditor
        mode="create"
        productCategories={productCategories}
        issueTypeCategories={issueTypeCategories.map((c) => ({
          code: c.code,
          label: c.label,
        }))}
        defaultQuestion={question?.trim() || undefined}
      />
    </div>
  );
}
