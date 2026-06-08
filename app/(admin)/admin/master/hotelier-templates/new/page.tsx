import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { HotelierTemplateEditor } from '../_components/hotelier-template-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '신규 호텔리어 템플릿 — 마스터DB' };

export default async function NewHotelierTemplatePage() {
  await requireRole(['manager', 'admin']);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="신규 호텔리어 템플릿"
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
          <HotelierTemplateEditor />
        </CardContent>
      </Card>
    </div>
  );
}
