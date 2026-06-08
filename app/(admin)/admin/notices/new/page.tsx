/**
 * /admin/notices/new — 새 공지 생성 (NT-01).
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/permissions';
import { getProductCategories } from '@/lib/services/categories';
import { PageHeader } from '@/components/ui/page-header';
import { NoticeEditor } from '../_components/notice-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '새 공지 — OA 통합 AS 어드민' };

export default async function NewNoticePage() {
  await requireRole(['manager', 'admin']);
  const categories = await getProductCategories();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="새 공지"
        description="종류·제품을 선택하고 마크다운으로 본문을 작성하세요. Draft 저장 또는 즉시 발행을 선택할 수 있습니다."
        breadcrumb={
          <Link
            href="/admin/notices"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            공지
          </Link>
        }
      />
      <NoticeEditor categories={categories} mode="create" />
    </div>
  );
}
