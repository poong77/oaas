import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { QuickActionEditor } from '../_components/quick-action-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '신규 자주 찾는 작업 — 마스터DB' };

export default async function NewQuickActionPage() {
  await requireRole(['manager', 'admin']);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="신규 자주 찾는 작업"
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
          <QuickActionEditor />
        </CardContent>
      </Card>
    </div>
  );
}
