'use client';

/**
 * 자주 찾는 작업 편집 폼.
 */

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { KNOWN_ICON_NAMES } from '@/components/icon-resolver';
import {
  upsertQuickActionAction,
  setQuickActionActiveAction,
} from '@/app/actions/master-actions';
import type { QuickAction } from '@/db/schema';

export function QuickActionEditor({
  item,
}: {
  item?: QuickAction;
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const isEdit = !!item;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await upsertQuickActionAction(
        item?.id ?? null,
        undefined,
        fd,
      );
      if (res.ok) {
        toast.success('저장되었습니다');
        if (!isEdit && res.id) {
          router.push(`/admin/master/quick-actions/${res.id}`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(res.message ?? '저장 실패');
      }
    });
  }

  async function toggleActive() {
    if (!item) return;
    const target = !item.isActive;
    const ok = await confirm({
      title: target ? '항목을 복구합니다' : '항목을 비활성화합니다',
      confirmText: target ? '복구' : '비활성화',
      tone: target ? 'default' : 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await setQuickActionActiveAction(item.id, target);
      if (res.ok) {
        toast.success(target ? '복구되었습니다' : '비활성화되었습니다');
        router.refresh();
      } else {
        toast.error(res.message ?? '실패');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>라벨</Label>
          <Input
            name="label"
            defaultValue={item?.label ?? ''}
            required
            placeholder="비밀번호 초기화"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>아이콘 (lucide)</Label>
          <Input
            name="icon"
            defaultValue={item?.icon ?? ''}
            list="qa-icons"
            placeholder="KeyRound"
          />
          <datalist id="qa-icons">
            {KNOWN_ICON_NAMES.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label>설명</Label>
        <Input
          name="description"
          defaultValue={item?.description ?? ''}
          placeholder="로그인 비밀번호를 초기화합니다."
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label>링크 URL</Label>
        <Input
          name="linkUrl"
          defaultValue={item?.linkUrl ?? ''}
          required
          placeholder="/profile"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>정렬</Label>
          <Input
            name="sortOrder"
            type="number"
            defaultValue={item?.sortOrder ?? 100}
          />
        </div>
        <div className="flex items-center gap-2 self-end pb-1">
          <input
            type="checkbox"
            name="visible"
            id="visible"
            defaultChecked={item?.visible ?? true}
            className="h-4 w-4"
          />
          <Label htmlFor="visible" className="cursor-pointer">
            홈에 노출
          </Label>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          저장
        </Button>
        {isEdit && (
          <Button
            type="button"
            variant={item!.isActive ? 'ghost' : 'outline'}
            onClick={toggleActive}
            disabled={pending}
          >
            {item!.isActive ? '비활성화' : '복구'}
          </Button>
        )}
      </div>
    </form>
  );
}
