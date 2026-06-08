import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import type { PopularKeywordKind } from '@/db/schema';
import { PopularKeywordEditor } from '../_components/popular-keyword-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '신규 인기검색어 — 마스터DB' };

type SearchParams = Promise<{ keyword?: string; kind?: string }>;

export default async function NewPopularKeywordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(['manager', 'admin']);
  const sp = await searchParams;
  const defaultKind: PopularKeywordKind =
    sp.kind === 'block' ? 'block' : 'pin';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="신규 인기검색어"
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
          <PopularKeywordEditor
            defaultKeyword={sp.keyword}
            defaultKind={defaultKind}
          />
        </CardContent>
      </Card>
    </div>
  );
}
