/**
 * /admin/master/ticket-channels/new — 새 유입 채널 추가.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ChannelForm } from '../_components/channel-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: '새 유입 채널 — 마스터 데이터' };

export default async function NewTicketChannelPage() {
  await requireRole(['admin']);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="새 유입 채널"
        description="대리 접수 폼에서 선택할 수 있는 채널을 추가합니다."
        breadcrumb={
          <Link
            href="/admin/master/ticket-channels"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 유입 채널
          </Link>
        }
      />
      <Card>
        <CardContent className="p-5">
          <ChannelForm />
        </CardContent>
      </Card>
    </div>
  );
}
