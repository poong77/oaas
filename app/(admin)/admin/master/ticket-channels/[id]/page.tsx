/**
 * /admin/master/ticket-channels/[id] — 유입 채널 상세/수정.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { getTicketChannelById } from '@/lib/services/master-ticket-channels';
import { ChannelForm } from '../_components/channel-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: '유입 채널 편집 — 마스터DB' };

type Params = Promise<{ id: string }>;

export default async function EditTicketChannelPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(['manager', 'admin']);
  const { id } = await params;
  const channel = await getTicketChannelById(id);
  if (!channel) notFound();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`유입 채널 편집 — ${channel.label}`}
        description={
          <span className="font-mono text-xs">
            code: <strong>{channel.code}</strong>
          </span>
        }
        breadcrumb={
          <Link
            href="/admin/master/inquiry-classification?tab=channels"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 유입 채널
          </Link>
        }
      />
      <Card>
        <CardContent className="p-5">
          <ChannelForm channel={channel} />
        </CardContent>
      </Card>
    </div>
  );
}
