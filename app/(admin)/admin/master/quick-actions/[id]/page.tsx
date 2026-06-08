import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { getQuickActionById } from '@/lib/services/master-quick-actions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { QuickActionEditor } from '../_components/quick-action-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '자주 찾는 작업 편집 — 마스터DB' };

type Params = Promise<{ id: string }>;

export default async function QuickActionEditPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(['manager', 'admin']);
  const { id } = await params;
  const item = await getQuickActionById(id);
  if (!item) notFound();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`자주 찾는 작업 편집 — ${item.label}`}
        breadcrumb={
          <Link
            href="/admin/master/quick-actions"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 자주 찾는 작업
          </Link>
        }
      />
      <Card>
        <CardContent className="p-4">
          <QuickActionEditor item={item} />
        </CardContent>
      </Card>
    </div>
  );
}
