import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { getQuickReplyById } from '@/lib/services/master-quick-replies';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { QuickReplyEditor } from '../_components/quick-reply-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '빠른 응대 편집 — 마스터DB' };

type Params = Promise<{ id: string }>;

export default async function QuickReplyEditPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(['manager', 'admin']);
  const { id } = await params;
  const item = await getQuickReplyById(id);
  if (!item) notFound();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`빠른 응대 편집 — ${item.title}`}
        breadcrumb={
          <Link
            href="/admin/master/message-templates?tab=quick-reply"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 빠른 응대
          </Link>
        }
      />
      <Card>
        <CardContent className="p-4">
          <QuickReplyEditor item={item} />
        </CardContent>
      </Card>
    </div>
  );
}
