'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  upsertQuickReplyAction,
  setQuickReplyActiveAction,
} from '@/app/actions/master-actions';
import type { QuickReplyTemplate } from '@/db/schema';

export function QuickReplyEditor({
  item,
}: {
  item?: QuickReplyTemplate;
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const isEdit = !!item;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await upsertQuickReplyAction(item?.id ?? null, undefined, fd);
      if (res.ok) {
        toast.success('저장되었습니다');
        if (!isEdit && res.id) {
          router.push(`/admin/master/quick-replies/${res.id}`);
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
      title: target ? '템플릿을 복구합니다' : '템플릿을 비활성화합니다',
      confirmText: target ? '복구' : '비활성화',
      tone: target ? 'default' : 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await setQuickReplyActiveAction(item.id, target);
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
          <Label>제목</Label>
          <Input
            name="title"
            defaultValue={item?.title ?? ''}
            required
            placeholder="결제 오류 1차 응대"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>카테고리 (선택)</Label>
          <Input
            name="category"
            defaultValue={item?.category ?? ''}
            placeholder="결제 / 카드키 / 일반 등"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label>본문</Label>
        <Textarea
          name="content"
          defaultValue={item?.content ?? ''}
          rows={8}
          required
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
