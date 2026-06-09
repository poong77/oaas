'use client';

/**
 * 호텔 상세 — 슬랙 채널 연동 섹션 (N:N).
 *
 * 채널명/채널ID로 검색 → 연동(공개채널 봇 자동입장) → 로고 회색↔컬러.
 * 비공개/봇 미참여 채널은 '봇 미초대' 표시 + 상태 새로고침. 연동해제·테스트 발송 지원.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Hash, Lock, RefreshCw, Send, Slack, X } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  SlackChannelCombobox,
  type SlackChannelOption,
} from '@/components/ui/slack-channel-combobox';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  linkHotelSlackChannelAction,
  unlinkHotelSlackChannelAction,
  sendTestHotelSlackChannelAction,
  refreshHotelSlackChannelAction,
} from '@/app/actions/hotel-actions';
import type { HotelSlackChannelView } from '@/lib/services/hotels';
import { cn } from '@/lib/utils';

export function HotelSlackChannels({
  hotelId,
  channels,
}: {
  hotelId: string;
  channels: HotelSlackChannelView[];
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();

  const connected = channels.some((c) => c.botJoined);

  function handleLink(ch: SlackChannelOption) {
    if (channels.some((c) => c.channelId === ch.id)) {
      toast.info('이미 연동된 채널입니다');
      return;
    }
    const fd = new FormData();
    fd.set('hotelId', hotelId);
    fd.set('channelId', ch.id);
    fd.set('channelName', ch.name);
    startTransition(async () => {
      const res = await linkHotelSlackChannelAction(fd);
      if (res.ok) {
        const data = res.data as
          | { botJoined: boolean; channelIsPrivate: boolean }
          | undefined;
        if (data?.botJoined) {
          toast.success(`#${ch.name} 연동 완료 — 채널에 알림 메시지를 보냈습니다`);
        } else {
          toast.warning(
            `#${ch.name} 연동됨 (봇 미참여) — 채널에서 /invite @봇 후 상태 새로고침하세요`,
          );
        }
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleTest(c: HotelSlackChannelView) {
    const fd = new FormData();
    fd.set('hotelId', hotelId);
    fd.set('channelId', c.channelId);
    startTransition(async () => {
      const res = await sendTestHotelSlackChannelAction(fd);
      if (res.ok) toast.success(`#${c.channelName ?? c.channelId} 으로 테스트 메시지를 보냈습니다`);
      else toast.error(res.error);
    });
  }

  function handleRefresh(c: HotelSlackChannelView) {
    const fd = new FormData();
    fd.set('hotelId', hotelId);
    fd.set('channelId', c.channelId);
    startTransition(async () => {
      const res = await refreshHotelSlackChannelAction(fd);
      if (res.ok) {
        const data = res.data as { botJoined: boolean } | undefined;
        toast.success(
          data?.botJoined ? '봇 참여 확인 — 연동 완료' : '상태 갱신됨 (아직 봇 미참여)',
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  async function handleUnlink(c: HotelSlackChannelView) {
    const ok = await confirm({
      title: `#${c.channelName ?? c.channelId} 연동을 해제하시겠습니까?`,
      description: '이 채널로는 더 이상 접수 알림이 전송되지 않습니다.',
      confirmText: '연동해제',
      tone: 'danger',
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set('hotelId', hotelId);
    fd.set('channelId', c.channelId);
    startTransition(async () => {
      const res = await unlinkHotelSlackChannelAction(fd);
      if (res.ok) {
        toast.success('연동이 해제되었습니다');
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors',
              connected
                ? 'bg-[#4A154B] text-white'
                : 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500',
            )}
            aria-label={connected ? '슬랙 연동됨' : '슬랙 미연동'}
          >
            <Slack className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              슬랙 채널 연동
              {connected ? (
                <Badge tone="success">연동됨 · {channels.filter((c) => c.botJoined).length}</Badge>
              ) : (
                <Badge tone="slate">미연동</Badge>
              )}
            </CardTitle>
            <CardDescription>
              이 호텔 접수 발생 시 연동된 채널로 알림을 보냅니다 (기존 #support_new 병행).
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SlackChannelCombobox onSelect={handleLink} disabled={pending} />

        {channels.length === 0 ? (
          <p className="text-sm text-slate-400">
            연동된 슬랙 채널이 없습니다. 채널명 또는 채널 ID로 검색해 연동하세요.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {channels.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800">
                  {c.channelIsPrivate ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <Hash className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {c.channelName ?? c.channelId}
                    </span>
                    {c.botJoined ? (
                      <Badge tone="success">연동됨</Badge>
                    ) : (
                      <Badge tone="warn">봇 미초대</Badge>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-slate-400">
                    {c.channelId}
                    {c.channelIsPrivate && ' · 비공개'}
                  </div>
                  {!c.botJoined && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      채널에서 <code className="rounded bg-amber-50 px-1 dark:bg-amber-950/40">/invite @봇</code> 실행 후 상태 새로고침을 눌러주세요.
                    </p>
                  )}
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  {!c.botJoined && (
                    <button
                      type="button"
                      onClick={() => handleRefresh(c)}
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />상태 새로고침
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleTest(c)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Send className="h-3.5 w-3.5" />테스트 발송
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnlink(c)}
                    disabled={pending}
                    aria-label={`${c.channelName ?? c.channelId} 연동 해제`}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
