/**
 * /admin/master/synonyms/new — 신규 동의어 그룹 추가.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { GroupForm } from '../_components/group-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: '새 동의어 그룹 — 마스터' };

export default async function SynonymsNewPage() {
  await requireRole(['admin']);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/master/synonyms"
        className="inline-flex w-fit items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-3 w-3" />
        동의어 사전 목록
      </Link>
      <PageHeader
        title="새 동의어 그룹"
        description="대표어(canonical)와 카테고리를 정합니다. 저장 후 이형어를 추가할 수 있습니다."
      />
      <Card>
        <CardContent className="p-5">
          <GroupForm suggestedCategoryOptions={[]} />
        </CardContent>
      </Card>
    </div>
  );
}
