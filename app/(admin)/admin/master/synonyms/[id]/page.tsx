/**
 * /admin/master/synonyms/[id] — 동의어 그룹 상세 (편집 + 이형어 관리).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { getTermGroupById } from '@/lib/services/master-synonyms';
import { GroupForm } from '../_components/group-form';
import { SynonymsEditor } from '../_components/synonyms-editor';

export const dynamic = 'force-dynamic';

export default async function SynonymsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['manager', 'admin']);
  const { id } = await params;
  const group = await getTermGroupById(id);
  if (!group) notFound();

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
        title={`그룹: ${group.canonicalTerm}`}
        description="대표어·카테고리 편집 + 이형어(동의어) 추가/삭제."
      />

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            그룹 정보
          </h2>
          <GroupForm group={group} suggestedCategoryOptions={[]} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            이형어 (동의어)
          </h2>
          <SynonymsEditor
            groupId={group.id}
            synonyms={group.synonyms}
            canonicalTerm={group.canonicalTerm}
          />
        </CardContent>
      </Card>
    </div>
  );
}
