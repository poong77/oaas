import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { getPopularKeywordById } from '@/lib/services/master-popular-keywords';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { PopularKeywordEditor } from '../_components/popular-keyword-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '인기검색어 편집 — 마스터 데이터' };

type Params = Promise<{ id: string }>;

export default async function PopularKeywordEditPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(['manager', 'admin']);
  const { id } = await params;
  const item = await getPopularKeywordById(id);
  if (!item) notFound();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`인기검색어 편집 — ${item.keyword}`}
        breadcrumb={
          <Link
            href="/admin/master/popular-keywords"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 인기검색어
          </Link>
        }
      />
      <Card>
        <CardContent className="p-4">
          <PopularKeywordEditor item={item} />
        </CardContent>
      </Card>
    </div>
  );
}
