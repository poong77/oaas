import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { getSolutionLinkPresetById } from '@/lib/services/master-solution-links';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { SolutionLinkEditor } from '../_components/solution-link-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '솔루션 링크 편집 — 마스터 데이터' };

type Params = Promise<{ id: string }>;

export default async function SolutionLinkEditPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(['manager', 'admin']);
  const { id } = await params;
  const item = await getSolutionLinkPresetById(id);
  if (!item) notFound();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`솔루션 링크 편집 — ${item.label}`}
        breadcrumb={
          <Link
            href="/admin/master/solution-links"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 솔루션 링크 프리셋
          </Link>
        }
      />
      <Card>
        <CardContent className="p-4">
          <SolutionLinkEditor item={item} />
        </CardContent>
      </Card>
    </div>
  );
}
