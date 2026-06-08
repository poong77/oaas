import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { QuickReplyEditor } from '../_components/quick-reply-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '신규 빠른 응대 — 마스터DB' };

export default async function NewQuickReplyPage() {
  await requireRole(['manager', 'admin']);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="신규 빠른 응대"
        breadcrumb={
          <Link
            href="/admin/master/quick-replies"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 빠른 응대
          </Link>
        }
      />
      <Card>
        <CardContent className="p-4">
          <QuickReplyEditor />
        </CardContent>
      </Card>
    </div>
  );
}
