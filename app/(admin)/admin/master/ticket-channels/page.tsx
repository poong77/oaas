/**
 * /admin/master/ticket-channels — 유입 채널 마스터 (post-MVP).
 *
 * Plan: docs/01-plan/features/ticket-channels-master.plan.md
 * 어드민만 접근. 시스템 채널(web/chatbot)은 비활성화 불가.
 */

import Link from 'next/link';
import { ArrowLeft, Lock, Plus, Radio } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  isSystemChannelCode,
  listTicketChannels,
} from '@/lib/services/master-ticket-channels';
import {
  CHANNEL_ICON_MAP,
  FALLBACK_ICON,
} from '@/lib/ticket-channel-label';
import { ToggleActiveButton } from './_components/toggle-active-button';

export const dynamic = 'force-dynamic';
export const metadata = { title: '유입 채널 — 마스터 데이터' };

export default async function MasterTicketChannelsPage() {
  await requireRole(['admin']);
  const items = await listTicketChannels({ includeInactive: true });
  const activeCount = items.filter((i) => i.isActive).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="유입 채널"
        description={`호텔리어가 어떤 경로로 문의를 보내왔는지 추적합니다. 활성 ${activeCount}건.`}
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
            <Link href="/admin/master/ticket-channels/new">
              <Plus className="h-4 w-4" /> 신규
            </Link>
          </Button>
        }
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Radio className="h-6 w-6" />}
              title="등록된 채널이 없습니다"
              description="시드를 실행하지 않았다면 `npm run db:seed`를 먼저 실행해주세요."
              action={
                <Button asChild size="sm">
                  <Link href="/admin/master/ticket-channels/new">신규 추가</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((c) => {
                const Icon = c.icon
                  ? (CHANNEL_ICON_MAP[c.icon] ?? FALLBACK_ICON)
                  : FALLBACK_ICON;
                const system = isSystemChannelCode(c.code);
                return (
                  <li
                    key={c.id}
                    className={`flex items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 ${
                      c.isActive ? '' : 'opacity-50'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {c.label}
                          </span>
                          <code className="font-mono text-[11px] text-slate-500">
                            {c.code}
                          </code>
                          {system && (
                            <Badge tone="slate">
                              <Lock className="mr-1 h-3 w-3" />
                              시스템
                            </Badge>
                          )}
                          {c.isAgentDefault && <Badge tone="brand">기본</Badge>}
                          {!c.selectableInAgentForm && (
                            <Badge tone="warn">대리폼 숨김</Badge>
                          )}
                          {!c.isActive && <Badge tone="danger">비활성</Badge>}
                          <Badge tone="slate">정렬 {c.sortOrder}</Badge>
                        </div>
                        {c.description && (
                          <span className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                            {c.description}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ToggleActiveButton
                        id={c.id}
                        isActive={c.isActive}
                        isSystem={system}
                      />
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/admin/master/ticket-channels/${c.id}`}
                        >
                          편집
                        </Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
