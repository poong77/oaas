'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { KNOWN_ICON_NAMES } from '@/components/icon-resolver';
import {
  upsertRoleStarterAction,
  setRoleStarterActiveAction,
} from '@/app/actions/master-actions';
import { KNOWN_ROLE_KEYS } from '@/lib/services/master-meta';
import type { RoleStarter } from '@/db/schema';

export function RoleStarterUpsert({ item }: { item?: RoleStarter }) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const isEdit = !!item;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await upsertRoleStarterAction(undefined, fd);
      if (res.ok) {
        toast.success('저장되었습니다');
        if (!isEdit) form.reset();
        router.refresh();
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
      const res = await setRoleStarterActiveAction(item.id, target);
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
          <Label>역할 키</Label>
          <Input
            name="roleKey"
            defaultValue={item?.roleKey ?? ''}
            list="role-keys"
            required
            disabled={isEdit}
            className="font-mono text-xs"
            placeholder="front"
          />
          <datalist id="role-keys">
            {KNOWN_ROLE_KEYS.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <Label>라벨</Label>
          <Input
            name="label"
            defaultValue={item?.label ?? ''}
            required
            placeholder="프론트"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label>설명</Label>
        <Input
          name="description"
          defaultValue={item?.description ?? ''}
          placeholder="체크인·체크아웃·키 발급 등 프론트 데스크 업무 가이드"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>아이콘 (lucide)</Label>
          <Input
            name="icon"
            defaultValue={item?.icon ?? ''}
            list="rs-icons"
            placeholder="BellRing"
          />
          <datalist id="rs-icons">
            {KNOWN_ICON_NAMES.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <Label>정렬</Label>
          <Input
            name="sortOrder"
            type="number"
            defaultValue={item?.sortOrder ?? 100}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {isEdit ? '저장' : '업서트'}
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
