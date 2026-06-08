import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { getHotelierTemplateById } from '@/lib/services/master-hotelier-templates';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { HotelierTemplateEditor } from '../_components/hotelier-template-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '호텔리어 템플릿 편집 — 마스터DB' };

type Params = Promise<{ id: string }>;

export default async function HotelierTemplateEditPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(['manager', 'admin']);
  const { id } = await params;
  const item = await getHotelierTemplateById(id);
  if (!item) notFound();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`호텔리어 템플릿 편집 — ${item.title}`}
        breadcrumb={
          <Link
            href="/admin/master/hotelier-templates"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 호텔리어 템플릿
          </Link>
        }
      />
      <Card>
        <CardContent className="p-4">
          <HotelierTemplateEditor item={item} />
        </CardContent>
      </Card>
    </div>
  );
}
