/**
 * /admin/search-quality/queries — 골든셋(정답셋) 관리.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { listEvalQueries } from '@/lib/services/search-eval';
import { QueryManager } from './_components/query-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: '골든셋 관리 — 검색 품질' };

export default async function EvalQueriesPage() {
  await requireRole(['manager', 'admin']);
  const queries = await listEvalQueries();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="골든셋 (정답셋) 관리"
        description="테스트 질의와 그 정답(아티클 slug / FAQ id)을 등록합니다. 자주 묻는 질문일수록 정답셋에 넣으세요."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/search-quality">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              대시보드
            </Link>
          </Button>
        }
      />
      <QueryManager
        queries={queries.map((q) => ({
          id: q.id,
          query: q.query,
          expectedArticleSlugs: q.expectedArticleSlugs,
          expectedFaqIds: q.expectedFaqIds,
          productCode: q.productCode,
          source: q.source,
          note: q.note,
        }))}
      />
    </div>
  );
}
