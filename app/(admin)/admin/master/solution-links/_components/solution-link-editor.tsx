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
  upsertSolutionLinkPresetAction,
  setSolutionLinkActiveAction,
} from '@/app/actions/master-actions';
import type { SolutionLinkPreset } from '@/db/schema';

export function SolutionLinkEditor({
  item,
}: {
  item?: SolutionLinkPreset;
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const isEdit = !!item;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await upsertSolutionLinkPresetAction(
        item?.id ?? null,
        undefined,
        fd,
      );
      if (res.ok) {
        toast.success('저장되었습니다');
        if (!isEdit && res.id) {
          router.push(`/admin/master/solution-links/${res.id}`);
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
      title: target ? '프리셋을 복구합니다' : '프리셋을 비활성화합니다',
      confirmText: target ? '복구' : '비활성화',
      tone: target ? 'default' : 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await setSolutionLinkActiveAction(item.id, target);
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
            placeholder="PMS"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>아이콘 (lucide)</Label>
          <Input
            name="icon"
            defaultValue={item?.icon ?? ''}
            list="sl-icons"
            placeholder="Building2"
          />
          <datalist id="sl-icons">
            {KNOWN_ICON_NAMES.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label>기본 URL 템플릿 (선택)</Label>
        <Input
          name="defaultUrlTemplate"
          defaultValue={item?.defaultUrlTemplate ?? ''}
          placeholder="https://hotel-${slug}.example.com"
          className="font-mono text-xs"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label>정렬</Label>
        <Input
          name="sortOrder"
          type="number"
          defaultValue={item?.sortOrder ?? 100}
          className="w-24"
        />
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
