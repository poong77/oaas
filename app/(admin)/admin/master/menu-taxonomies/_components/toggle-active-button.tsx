'use client';

/**
 * 메뉴 노드 활성/비활성 토글 버튼.
 *
 * 비활성 시 confirm 다이얼로그로 cascade(자식 함께 비활성) 안내.
 */

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { toggleMenuTaxonomyAction } from '@/app/actions/master-menu-taxonomies-actions';

type Props = {
  id: string;
  isActive: boolean;
  childCount: number;
};

export function ToggleActiveButton({ id, isActive, childCount }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const confirm = useConfirmDialog();

  async function handleClick() {
    if (isActive) {
      const ok = await confirm({
        title: '메뉴 비활성화',
        description:
          childCount > 0
            ? `자식 ${childCount}개도 함께 비활성화됩니다. 진행하시겠어요?`
            : '이 메뉴를 비활성화하시겠어요? 아티클에서 더 이상 선택할 수 없게 됩니다.',
        confirmText: '비활성화',
        tone: 'danger',
      });
      if (!ok) return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', id);
      fd.set('action', isActive ? 'deactivate' : 'activate');
      const res = await toggleMenuTaxonomyAction(fd);
      if (res.ok) {
        toast.success(
          isActive
            ? res.affectedCount && res.affectedCount > 1
              ? `${res.affectedCount}개 노드가 비활성화되었습니다`
              : '비활성화되었습니다'
            : '활성화되었습니다',
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
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={pending}
    >
      {isActive ? (
        <>
          <PowerOff className="h-3 w-3" />
          비활성화
        </>
      ) : (
        <>
          <Power className="h-3 w-3" />
          활성화
        </>
      )}
    </Button>
  );
}
