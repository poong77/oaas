'use client';

/**
 * 서비스 상태 변경 폼.
 *
 * incident / degraded → 메시지 필수.
 * normal / maintenance → 메시지 선택.
 *
 * 변경 확정 전 ConfirmDialog로 한 번 더 확인. (특히 incident)
 */

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { updateServiceStatusAction } from '@/app/actions/service-status-actions';
import { SERVICE_STATUS_META } from '@/lib/services/service-status-meta';
import type { ServiceStatusValue } from '@/db/schema';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: Array<{
  value: ServiceStatusValue;
  description: string;
  requiresMessage: boolean;
}> = [
  {
    value: 'normal',
    description: '모든 서비스가 정상 동작합니다.',
    requiresMessage: false,
  },
  {
    value: 'degraded',
    description: '일부 기능에 제한이 있습니다.',
    requiresMessage: true,
  },
  {
    value: 'incident',
    description: '서비스 장애 발생 — 홈 상단 빨간 배너가 자동 노출됩니다.',
    requiresMessage: true,
  },
  {
    value: 'maintenance',
    description: '예정된 점검이 진행 중입니다.',
    requiresMessage: false,
  },
];

export function ServiceStatusForm({
  current,
}: {
  current: { status: ServiceStatusValue; message: string };
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [status, setStatus] = useState<ServiceStatusValue>(current.status);
  const [message, setMessage] = useState<string>(current.message);
  const [pending, startTransition] = useTransition();

  const option = STATUS_OPTIONS.find((o) => o.value === status)!;

  async function handleSubmit() {
    const trimmed = message.trim();
    if (option.requiresMessage && trimmed.length === 0) {
      toast.error('해당 상태에서는 안내 메시지를 입력해야 합니다.');
      return;
    }

    const ok = await confirm({
      title: `서비스 상태를 "${SERVICE_STATUS_META[status].label}"(으)로 변경하시겠습니까?`,
      description:
        status === 'incident'
          ? '홈 화면 최상단에 빨간색 긴급 배너가 노출되며, 모든 사용자에게 즉시 영향을 줍니다.'
          : '이전 상태는 자동으로 종료되고 새 상태가 즉시 적용됩니다.',
      confirmText: '변경',
      cancelText: '취소',
      tone: status === 'incident' ? 'danger' : 'default',
    });
    if (!ok) return;

    startTransition(async () => {
      try {
        const res = await updateServiceStatusAction({
          status,
          message: trimmed,
        });
        if (res.ok) {
          toast.success('서비스 상태가 변경되었습니다.');
          router.refresh();
        } else {
          toast.error(`변경 실패: ${res.reason}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        toast.error(`변경 실패: ${msg}`);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          상태 선택
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {STATUS_OPTIONS.map((opt) => {
            const meta = SERVICE_STATUS_META[opt.value];
            const checked = status === opt.value;
            return (
              <label
                key={opt.value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                  checked
                    ? 'border-brand-400 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/40'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600',
                )}
              >
                <input
                  type="radio"
                  name="service-status"
                  value={opt.value}
                  checked={checked}
                  onChange={() => setStatus(opt.value)}
                  className="mt-1"
                  disabled={pending}
                />
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Badge tone={meta.tone}>
                      {meta.emoji} {meta.label}
                    </Badge>
                    {opt.requiresMessage && (
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        * 메시지 필수
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    {opt.description}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="status-message">
          안내 메시지
          {option.requiresMessage && (
            <span className="ml-1 text-red-600 dark:text-red-400">*</span>
          )}
        </Label>
        <Textarea
          id="status-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            status === 'incident'
              ? '예) PMS 결제 모듈에서 일시적 오류가 발생하고 있습니다. 복구 중입니다.'
              : status === 'degraded'
                ? '예) Keyless 일부 호텔에서 키 발급이 지연되고 있습니다.'
                : status === 'maintenance'
                  ? '예) 23:00 ~ 24:00 정기 점검 진행'
                  : '평상시에는 빈 칸으로 두셔도 됩니다.'
          }
          rows={3}
          maxLength={500}
          disabled={pending}
        />
        <span className="text-right text-xs text-slate-400 dark:text-slate-500">
          {message.length} / 500
        </span>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setStatus(current.status);
            setMessage(current.message);
          }}
          disabled={pending}
        >
          되돌리기
        </Button>
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? '변경 중…' : '상태 변경'}
        </Button>
      </div>
    </div>
  );
}
