/**
 * /admin/articles/new — 새 아티클 생성 (SS-06).
 *
 * 마크다운 split view 폼 (좌: 입력, 우: 미리보기).
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/permissions';
import { getProductCategories } from '@/lib/services/categories';
import { PageHeader } from '@/components/ui/page-header';
import { ArticleEditor } from '../_components/article-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '새 아티클 — OA서포트 어드민' };

export default async function NewArticlePage() {
  await requireRole(['manager', 'admin']);
  const categories = await getProductCategories();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="새 아티클"
        description="제품과 카테고리를 선택하고 마크다운으로 본문을 작성하세요. Draft 저장 또는 즉시 발행을 선택할 수 있습니다."
        breadcrumb={
          <Link
            href="/admin/articles"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            아티클 관리
          </Link>
        }
      />
      <ArticleEditor categories={categories} mode="create" />
    </div>
  );
}
