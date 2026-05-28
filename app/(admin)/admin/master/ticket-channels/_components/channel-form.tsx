'use client';

/**
 * 유입 채널 마스터 편집 폼 (신규 + 수정 공용).
 * Design §6.1, §6.3 (Lucide CHANNEL_ICON_MAP 화이트리스트).
 */

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  createTicketChannelAction,
  updateTicketChannelAction,
  type ChannelActionState,
} from '@/app/actions/master-ticket-channels-actions';
import {
  CHANNEL_ICON_KEYS,
  CHANNEL_ICON_MAP,
  FALLBACK_ICON,
} from '@/lib/ticket-channel-label';
import { isSystemChannelCode } from '@/lib/ticket-channel-codes';
import type { TicketChannelRow } from '@/db/schema';

type Props = {
  channel?: TicketChannelRow;
};

const INITIAL: ChannelActionState = { ok: false };

export function ChannelForm({ channel }: Props) {
  const router = useRouter();
  const isEdit = !!channel;
  const isSystem = !!channel && isSystemChannelCode(channel.code);

  const action = isEdit
    ? updateTicketChannelAction.bind(null, channel!.id)
    : createTicketChannelAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);

  const [icon, setIcon] = useState<string>(channel?.icon ?? '');
  const PreviewIcon = icon ? (CHANNEL_ICON_MAP[icon] ?? FALLBACK_ICON) : FALLBACK_ICON;

  // 수정 모드에서 ok=true는 redirect 안 함 → toast로 알림
  if (isEdit && state.ok) {
    setTimeout(() => {
      toast.success('저장되었습니다');
      router.refresh();
    }, 0);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="code">
            코드 <span className="text-red-500">*</span>
          </Label>
          <Input
            id="code"
            name="code"
            defaultValue={channel?.code ?? ''}
            placeholder="kakao"
            required
            maxLength={40}
            disabled={pending || isSystem}
            aria-invalid={!!state.fieldErrors?.code}
          />
          {state.fieldErrors?.code ? (
            <p className="text-xs text-red-500">{state.fieldErrors.code}</p>
          ) : (
            <p className="text-xs text-slate-500">
              snake_case 영문 소문자/숫자만. 저장 후 변경 불가.
              {isSystem && ' (시스템 채널 — 잠금)'}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="label">
            라벨 <span className="text-red-500">*</span>
          </Label>
          <Input
            id="label"
            name="label"
            defaultValue={channel?.label ?? ''}
            placeholder="카카오톡"
            required
            maxLength={40}
            disabled={pending}
            aria-invalid={!!state.fieldErrors?.label}
          />
          {state.fieldErrors?.label && (
            <p className="text-xs text-red-500">{state.fieldErrors.label}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="description">설명</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={channel?.description ?? ''}
          placeholder="고객이 카카오톡 비즈니스 채널로 보내온 문의"
          maxLength={200}
          rows={2}
          disabled={pending}
        />
        {state.fieldErrors?.description && (
          <p className="text-xs text-red-500">{state.fieldErrors.description}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_120px]">
        <div className="flex flex-col gap-1">
          <Label htmlFor="icon">아이콘</Label>
          <Select
            id="icon"
            name="icon"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            disabled={pending}
          >
            <option value="">— 없음 —</option>
            {CHANNEL_ICON_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end pb-1">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
            <PreviewIcon className="h-4 w-4 text-slate-700 dark:text-slate-200" />
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="sortOrder">정렬</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            min={0}
            max={9999}
            defaultValue={channel?.sortOrder ?? 100}
            disabled={pending}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        새 아이콘이 필요하면 <code className="font-mono">lib/ticket-channel-label.ts</code>{' '}
        <code className="font-mono">CHANNEL_ICON_MAP</code>에 추가 후 배포해주세요.
      </p>

      <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="selectableInAgentForm"
            defaultChecked={channel?.selectableInAgentForm ?? true}
            disabled={pending}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="font-medium text-slate-700 dark:text-slate-200">
              대리 접수 폼에 노출
            </span>
            <span className="ml-1 text-xs text-slate-500">
              (체크 해제 시 매니저 폼 드롭다운에서 숨김. 'web'/'chatbot'은 자동 태깅용으로 끄세요)
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="isAgentDefault"
            defaultChecked={channel?.isAgentDefault ?? false}
            disabled={pending}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="font-medium text-slate-700 dark:text-slate-200">
              대리 접수 폼 기본 선택값
            </span>
            <span className="ml-1 text-xs text-slate-500">
              (true는 1개만. 저장 시 기존 기본값은 자동 해제)
            </span>
          </span>
        </label>
      </div>

      {state.message && (
        <p className="text-sm text-red-500">{state.message}</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? '저장 중…' : '저장'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/admin/master/ticket-channels')}
          disabled={pending}
        >
          취소
        </Button>
      </div>
    </form>
  );
}
