/**
 * /admin/master/notification-templates — 알림 템플릿 (Phase 9).
 *
 * (channel, event_key) unique. UI에서 신규 row를 만들면 upsert.
 * sms/email/slack 채널 중 master 운영용은 sms/email 주력. slack도 동일 테이블에 저장 가능.
 */

import Link from 'next/link';
import { ArrowLeft, Bell, Plus } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  listTemplates,
  KNOWN_EVENT_KEYS,
} from '@/lib/services/master-templates';

export const dynamic = 'force-dynamic';
export const metadata = { title: '알림 템플릿 — 마스터 데이터' };

const CHANNEL_LABEL: Record<string, string> = {
  sms: 'SMS',
  email: 'Email',
  slack: 'Slack',
};

export default async function MasterNotificationTemplatesPage() {
  await requireRole(['manager', 'admin']);
  const items = await listTemplates({ includeInactive: true });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="알림 템플릿"
        description="이벤트(event_key) + 채널(sms/email) 조합별 본문 템플릿. {{변수}} 치환 지원."
        breadcrumb={
          <Link
            href="/admin/master"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 마스터 데이터
          </Link>
        }
        actions={
          <Button asChild>
            <Link href="/admin/master/notification-templates/new">
              <Plus className="h-4 w-4" /> 신규 템플릿
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-1 p-4">
          <div className="text-sm font-semibold">알려진 event_key</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {KNOWN_EVENT_KEYS.map((k) => (
              <code
                key={k}
                className="rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {k}
              </code>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            DB에 row 없으면 <code>lib/notifications/templates.ts</code>의 하드코딩
            빌더로 자동 fallback됩니다.
          </p>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Bell className="h-6 w-6" />}
              title="등록된 템플릿이 없습니다"
              description="신규 템플릿을 추가하거나 DB 시드를 실행하세요. 없으면 하드코딩 빌더로 자동 동작합니다."
              action={
                <Button asChild size="sm">
                  <Link href="/admin/master/notification-templates/new">
                    신규 템플릿
                  </Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((tpl) => (
                <li
                  key={tpl.id}
                  className={`flex items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 ${
                    tpl.isActive ? '' : 'opacity-60'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        tone={tpl.channel === 'email' ? 'brand' : 'success'}
                      >
                        {CHANNEL_LABEL[tpl.channel] ?? tpl.channel}
                      </Badge>
                      <code className="font-mono text-xs text-slate-700 dark:text-slate-300">
                        {tpl.eventKey}
                      </code>
                      {!tpl.isActive && <Badge tone="danger">비활성</Badge>}
                    </div>
                    {tpl.subject && (
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {tpl.subject}
                      </div>
                    )}
                    <div className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {tpl.bodyTemplate}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/admin/master/notification-templates/${tpl.id}`}
                    >
                      편집
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
