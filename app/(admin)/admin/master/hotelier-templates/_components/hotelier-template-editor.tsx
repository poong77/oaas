'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { RichEditor } from '@/components/editor/rich-editor';
import { deleteDraftAfterPublish } from '@/lib/editor/draft-client';
import {
  upsertHotelierTemplateAction,
  setHotelierTemplateActiveAction,
} from '@/app/actions/master-actions';
import type { HotelierTemplate } from '@/db/schema';

export function HotelierTemplateEditor({
  item,
}: {
  item?: HotelierTemplate;
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const isEdit = !!item;

  const [title, setTitle] = useState(item?.title ?? '');
  const [category, setCategory] = useState(item?.category ?? '');
  const [content, setContent] = useState(item?.content ?? '');
  const [sortOrder, setSortOrder] = useState<string>(
    item?.sortOrder !== undefined ? String(item.sortOrder) : '100',
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set('title', title.trim());
    fd.set('category', category.trim());
    fd.set('content', content);
    fd.set('sortOrder', sortOrder.trim() || '100');

    startTransition(async () => {
      const res = await upsertHotelierTemplateAction(
        item?.id ?? null,
        undefined,
        fd,
      );
      if (res.ok) {
        await deleteDraftAfterPublish('hotelier-template', item?.id ?? null);
        toast.success('저장되었습니다');
        if (!isEdit && res.id) {
          router.push(`/admin/master/hotelier-templates/${res.id}`);
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
      const res = await setHotelierTemplateActiveAction(item.id, target);
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
          <Label htmlFor="ht-title">버튼 라벨</Label>
          <Input
            id="ht-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="계정생성/삭제"
          />
          <span className="text-[11px] text-slate-400">
            접수폼 「자세한 내용」 위에 노출되는 버튼 이름입니다.
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ht-category">카테고리 (선택)</Label>
          <Input
            id="ht-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="계정 / 매출 / 예약 등"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label>본문 템플릿</Label>
        <RichEditor
          mode="lite"
          value={content}
          onChange={setContent}
          minHeight={220}
          placeholder="버튼 클릭 시 접수 본문에 끼워넣을 양식을 작성하세요. (예: 항목별 라벨 + 빈칸)"
          autoSave={{
            scope: 'hotelier-template',
            targetId: item?.id ?? null,
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="ht-sort">정렬</Label>
        <Input
          id="ht-sort"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="w-24"
        />
        <span className="text-[11px] text-slate-400">
          숫자가 작을수록 버튼이 왼쪽에 노출됩니다.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || !content.trim()}>
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
