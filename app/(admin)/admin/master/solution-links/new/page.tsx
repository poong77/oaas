import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { SolutionLinkEditor } from '../_components/solution-link-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '신규 솔루션 링크 프리셋 — 마스터DB' };

export default async function NewSolutionLinkPresetPage() {
  await requireRole(['manager', 'admin']);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="신규 솔루션 링크 프리셋"
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
          <SolutionLinkEditor />
        </CardContent>
      </Card>
    </div>
  );
}
