/**
 * /admin/master/notification-templates/new — 신규 알림 템플릿.
 *
 * (channel, event_key) unique. 동일 조합 입력 시 upsert.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { TemplateEditor } from '../_components/template-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '신규 알림 템플릿 — 마스터DB' };

export default async function NewTemplatePage() {
  await requireRole(['manager', 'admin']);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="신규 알림 템플릿"
        description="채널과 이벤트 키를 지정하고 본문을 작성하세요. {{변수}} 치환자를 사용할 수 있습니다."
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
          <TemplateEditor mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
