'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { toggleTicketChannelAction } from '@/app/actions/master-ticket-channels-actions';

type Props = {
  id: string;
  isActive: boolean;
  isSystem: boolean;
};

export function ToggleActiveButton({ id, isActive, isSystem }: Props) {
  const confirm = useConfirmDialog();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // 시스템 채널은 항상 활성 상태이고 비활성화 버튼 자체를 노출하지 않음 (UI 가드)
  if (isSystem) {
    return (
      <span className="inline-flex h-9 items-center rounded-md border border-slate-200 px-2 text-xs text-slate-400 dark:border-slate-700">
        시스템 잠금
      </span>
    );
  }

  async function onClick() {
    const target = isActive ? 'deactivate' : 'activate';
    const ok = await confirm({
      title: target === 'deactivate' ? '채널을 비활성화합니다' : '채널을 복구합니다',
      description:
        target === 'deactivate'
          ? '비활성 채널은 대리 접수 폼 드롭다운에서 사라집니다. 기존 티켓 라벨은 유지됩니다.'
          : '활성화된 채널은 다시 대리 접수 폼에 노출됩니다.',
      confirmText: target === 'deactivate' ? '비활성화' : '복구',
      tone: target === 'deactivate' ? 'danger' : 'default',
    });
    if (!ok) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.append('id', id);
      fd.append('action', target);
      const res = await toggleTicketChannelAction(fd);
      if (res.ok) {
        toast.success(
          target === 'deactivate' ? '비활성화되었습니다' : '복구되었습니다',
        );
        router.refresh();
      } else {
        toast.error(res.message ?? '실패');
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={isActive ? 'ghost' : 'outline'}
      onClick={onClick}
      disabled={pending}
    >
      {isActive ? '비활성' : '복구'}
    </Button>
  );
}
