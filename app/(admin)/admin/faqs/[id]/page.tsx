/**
 * /admin/faqs/[id] — FAQ 편집 (SF-04).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { requireRole } from '@/lib/permissions';
import { getFaqById } from '@/lib/services/faqs';
import {
  getCategoriesByType,
  getProductCategories,
} from '@/lib/services/categories';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FaqEditor } from '../_components/faq-editor';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { id } = await params;
  const f = await getFaqById(id);
  return {
    title: f ? `${f.question.slice(0, 30)} 편집` : 'FAQ 편집 — OA 통합 AS 어드민',
  };
}

export default async function EditFaqPage({ params }: { params: RouteParams }) {
  await requireRole(['manager', 'admin']);
  const { id } = await params;
  const [faq, productCategories, issueTypeCategories] = await Promise.all([
    getFaqById(id),
    getProductCategories(),
    getCategoriesByType('issue_type'),
  ]);
  if (!faq) notFound();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            FAQ 편집
            {!faq.isActive && <Badge tone="danger">비활성</Badge>}
          </span>
        }
        description={faq.question.length > 50 ? faq.question.slice(0, 50) + '…' : faq.question}
        breadcrumb={
          <Link
            href="/admin/faqs"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            FAQ 관리
          </Link>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/faq#faq-${faq.id}`} target="_blank">
              <ExternalLink className="h-3.5 w-3.5" />
              공개 페이지
            </Link>
          </Button>
        }
      />
      <FaqEditor
        mode="edit"
        productCategories={productCategories}
        issueTypeCategories={issueTypeCategories.map((c) => ({
          code: c.code,
          label: c.label,
        }))}
        initial={{
          id: faq.id,
          productCode: faq.productCode,
          issueType: faq.issueType,
          question: faq.question,
          answerMarkdown: faq.answerMarkdown,
          sortOrder: faq.sortOrder,
        }}
      />
    </div>
  );
}
