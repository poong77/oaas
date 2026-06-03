'use client';

/**
 * 인기검색어(pin/block) 편집 폼.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  upsertPopularKeywordAction,
  setPopularKeywordActiveAction,
} from '@/app/actions/master-actions';
import type { PopularKeyword, PopularKeywordKind } from '@/db/schema';

export function PopularKeywordEditor({
  item,
  defaultKeyword,
  defaultKind,
}: {
  item?: PopularKeyword;
  defaultKeyword?: string;
  defaultKind?: PopularKeywordKind;
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<PopularKeywordKind>(
    item?.kind ?? defaultKind ?? 'pin',
  );
  const isEdit = !!item;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await upsertPopularKeywordAction(item?.id ?? null, undefined, fd);
      if (res.ok) {
        toast.success('저장되었습니다');
        router.push('/admin/master/popular-keywords');
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
      const res = await setPopularKeywordActiveAction(item.id, target);
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
      <div className="flex flex-col gap-1">
        <Label>키워드</Label>
        <Input
          name="keyword"
          defaultValue={item?.keyword ?? defaultKeyword ?? ''}
          required
          placeholder="체크인 오류"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {kind === 'pin'
            ? '입력한 그대로 칩에 노출됩니다 (# 키워드).'
            : '이 검색어는 자동집계 인기검색어에서 제외됩니다. (대소문자·공백 정규화 후 매칭)'}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <Label>구분</Label>
        <div className="grid grid-cols-2 gap-2">
          <label
            className={`flex cursor-pointer flex-col gap-0.5 rounded-md border p-3 text-sm ${
              kind === 'pin'
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <span className="flex items-center gap-2 font-semibold">
              <input
                type="radio"
                name="kind"
                value="pin"
                checked={kind === 'pin'}
                onChange={() => setKind('pin')}
                className="h-4 w-4"
              />
              고정 (pin)
            </span>
            <span className="pl-6 text-xs text-slate-500 dark:text-slate-400">
              항상 상단에 노출
            </span>
          </label>
          <label
            className={`flex cursor-pointer flex-col gap-0.5 rounded-md border p-3 text-sm ${
              kind === 'block'
                ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <span className="flex items-center gap-2 font-semibold">
              <input
                type="radio"
                name="kind"
                value="block"
                checked={kind === 'block'}
                onChange={() => setKind('block')}
                className="h-4 w-4"
              />
              제외 (block)
            </span>
            <span className="pl-6 text-xs text-slate-500 dark:text-slate-400">
              자동집계에서 숨김
            </span>
          </label>
        </div>
      </div>

      {kind === 'pin' && (
        <div className="flex flex-col gap-1">
          <Label>정렬 (작을수록 앞)</Label>
          <Input
            name="sortOrder"
            type="number"
            defaultValue={item?.sortOrder ?? 100}
            className="max-w-[160px]"
          />
        </div>
      )}
      {kind === 'block' && (
        <input type="hidden" name="sortOrder" value={item?.sortOrder ?? 0} />
      )}

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
