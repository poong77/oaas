/**
 * /admin/master/message-templates — 메시지 템플릿 (통합 마스터, 2026-06-09).
 *
 * notification_templates(알림 SMS/이메일) + quick_reply_templates(빠른 응대)를 탭으로 통합.
 * ?tab=notification|quick-reply. 매니저+어드민(메뉴 접근 제어 가드는 layout).
 * 신규/편집은 기존 /admin/master/{notification-templates,quick-replies}/{new,[id]} 재사용.
 */

import Link from 'next/link';
import { ArrowLeft, Bell, MessageSquare, Plus } from 'lucide-react';

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
import { listQuickReplies } from '@/lib/services/master-quick-replies';

export const dynamic = 'force-dynamic';
export const metadata = { title: '메시지 템플릿 — 마스터DB' };

type TabKey = 'notification' | 'quick-reply';

const TABS: Array<{ key: TabKey; label: string; description: string }> = [
  {
    key: 'notification',
    label: '알림',
    description: 'SMS/이메일 자동 발송 — 티켓 상태 전환·계정 초대·비밀번호 초기화',
  },
  {
    key: 'quick-reply',
    label: '빠른 응대',
    description: '매니저가 티켓 답변 작성 시 사용할 정형 응대 문구',
  },
];

const BASE_PATH = '/admin/master/message-templates';
const CHANNEL_LABEL: Record<string, string> = {
  sms: 'SMS',
  email: 'Email',
  slack: 'Slack',
};

type SearchParams = Promise<{ tab?: string }>;

export default async function MessageTemplatesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(['manager', 'admin']);
  const sp = await searchParams;
  const activeTab: TabKey =
    sp.tab === 'quick-reply' ? 'quick-reply' : 'notification';
  const activeMeta = TABS.find((t) => t.key === activeTab)!;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="메시지 템플릿"
        description="발송 알림(SMS/이메일)과 매니저 빠른 응대 문구를 한 곳에서 관리합니다."
        breadcrumb={
          <Link
            href="/admin/master"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 마스터DB
          </Link>
        }
        actions={
          <Button asChild>
            <Link
              href={
                activeTab === 'notification'
                  ? '/admin/master/notification-templates/new'
                  : '/admin/master/quick-replies/new'
              }
            >
              <Plus className="h-4 w-4" /> 신규
            </Link>
          </Button>
        }
      />

      {/* 탭 */}
      <nav className="flex flex-wrap gap-1 border-b border-slate-200 pb-1 dark:border-slate-800">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Link
              key={tab.key}
              href={{ pathname: BASE_PATH, query: { tab: tab.key } }}
              className={
                isActive
                  ? 'rounded-md bg-brand-100 px-3 py-1.5 text-sm font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                  : 'rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <Card>
        <CardContent className="flex flex-col gap-1 p-4">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {activeMeta.label}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {activeMeta.description}
          </div>
        </CardContent>
      </Card>

      {activeTab === 'notification' ? (
        <NotificationPanel />
      ) : (
        <QuickReplyPanel />
      )}
    </div>
  );
}

/** 알림 탭 — 구 /admin/master/notification-templates 본문 이관 */
async function NotificationPanel() {
  const items = await listTemplates({ includeInactive: true });
  return (
    <>
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
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
                      <Badge tone={tpl.channel === 'email' ? 'brand' : 'success'}>
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
                    <Link href={`/admin/master/notification-templates/${tpl.id}`}>
                      편집
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/** 빠른 응대 탭 — 구 /admin/master/quick-replies 본문 이관 */
async function QuickReplyPanel() {
  const items = await listQuickReplies(true);
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={<MessageSquare className="h-6 w-6" />}
            title="등록된 응대 문구가 없습니다"
            description="자주 쓰는 답변 문구를 미리 등록해두면 응답 시간이 단축됩니다."
            action={
              <Button asChild size="sm">
                <Link href="/admin/master/quick-replies/new">신규 추가</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((it) => (
            <li
              key={it.id}
              className={`flex items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 ${
                it.isActive ? '' : 'opacity-50'
              }`}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{it.title}</span>
                  {it.category && <Badge tone="slate">{it.category}</Badge>}
                  {!it.isActive && <Badge tone="danger">비활성</Badge>}
                </div>
                <span className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                  {it.content}
                </span>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/master/quick-replies/${it.id}`}>편집</Link>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
