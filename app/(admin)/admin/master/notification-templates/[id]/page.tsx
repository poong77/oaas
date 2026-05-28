/**
 * /admin/master/notification-templates/[id] — 알림 템플릿 편집.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { getTemplateById } from '@/lib/services/master-templates';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { TemplateEditor } from '../_components/template-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '알림 템플릿 편집 — 마스터 데이터' };

type Params = Promise<{ id: string }>;

export default async function TemplateEditPage({ params }: { params: Params }) {
  await requireRole(['manager', 'admin']);
  const { id } = await params;
  const tpl = await getTemplateById(id);
  if (!tpl) notFound();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`알림 템플릿 편집 — ${tpl.channel}/${tpl.eventKey}`}
        description="본문 / 제목 / 설명 수정. 채널과 event_key는 변경할 수 없습니다 (재생성 필요)."
        breadcrumb={
          <Link
            href="/admin/master/notification-templates"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 알림 템플릿
          </Link>
        }
      />
      <Card>
        <CardContent className="p-4">
          <TemplateEditor mode="edit" template={tpl} />
        </CardContent>
      </Card>
    </div>
  );
}
