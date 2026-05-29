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

  // controlled 입력으로 전환 (RichEditor의 onChange 통합 위해)
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
      const res = await upsertQuickReplyAction(item?.id ?? null, undefined, fd);
      if (res.ok) {
        await deleteDraftAfterPublish('quick-reply', item?.id ?? null);
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
          <Label htmlFor="qr-title">제목</Label>
          <Input
            id="qr-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="결제 오류 1차 응대"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="qr-category">카테고리 (선택)</Label>
          <Input
            id="qr-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="결제 / 카드키 / 일반 등"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label>본문</Label>
        <RichEditor
          mode="full"
          value={content}
          onChange={setContent}
          minHeight={240}
          placeholder="자주 쓰는 응대 문구를 작성하세요. {{호텔명}} {{호텔리어명}} {{티켓번호}} 변수가 매니저 발송 시 치환됩니다."
          autoSave={{
            scope: 'quick-reply',
            targetId: item?.id ?? null,
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="qr-sort">정렬</Label>
        <Input
          id="qr-sort"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="w-24"
        />
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
