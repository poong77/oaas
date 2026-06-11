'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Plus, Trash2, Pencil } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  deleteSolutionLinkAction,
  upsertSolutionLinkAction,
} from '@/app/actions/profile-actions';
import type { HotelSolutionLink } from '@/db/schema';

const MAX_LINKS = 50;

export function SolutionLinks({
  links,
  hasHotel,
}: {
  links: HotelSolutionLink[];
  hasHotel: boolean;
}) {
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!hasHotel) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>솔루션 링크</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>, id?: string) {
    e.preventDefault();
    setErrors({});
    const formData = new FormData(e.currentTarget);
    if (id) formData.set('id', id);
    startTransition(async () => {
      const res = await upsertSolutionLinkAction(formData);
      if (res.ok) {
        toast.success(id ? '링크가 수정되었습니다' : '링크가 추가되었습니다');
        setEditingId(null);
        setShowNew(false);
      } else {
        if (res.fields) setErrors(res.fields);
        toast.error(res.error);
      }
    });
  }

  async function handleDelete(id: string, label: string) {
    const ok = await confirm({
      title: `'${label}' 링크를 삭제하시겠습니까?`,
      tone: 'danger',
      confirmText: '삭제',
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set('id', id);
    startTransition(async () => {
      const res = await deleteSolutionLinkAction(fd);
      if (res.ok) toast.success('삭제되었습니다');
      else toast.error(res.error);
    });
  }

  const canAddMore = links.length < MAX_LINKS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          솔루션 링크
          <span className="ml-2 text-xs font-normal text-slate-500">
            ({links.length} / {MAX_LINKS})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {links.length === 0 && !showNew && (
          <EmptyState
            icon={<ExternalLink className="h-6 w-6" />}
            title="등록된 솔루션 링크가 없습니다"
            description="아래 버튼으로 첫 링크를 추가해보세요."
          />
        )}

        {links.map((link) => (
          <div
            key={link.id}
            className="rounded-md border border-slate-200 dark:border-slate-800"
          >
            {editingId === link.id ? (
              <form
                onSubmit={(e) => handleSubmit(e, link.id)}
                className="grid gap-3 p-3 sm:grid-cols-[1fr_2fr_auto]"
              >
                <Input name="label" defaultValue={link.label} required maxLength={50} placeholder="라벨" />
                <Input name="url" defaultValue={link.url} type="url" required placeholder="https://..." />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={pending}>저장</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>취소</Button>
                </div>
                {(errors.label || errors.url) && (
                  <div className="col-span-full text-xs text-red-600">
                    {errors.label || errors.url}
                  </div>
                )}
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="font-medium">{link.label}</span>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {link.url}
                  </a>
                </div>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(link.id)}>
                    <Pencil className="h-3.5 w-3.5" />수정
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(link.id, link.label)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />삭제
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {showNew && (
          <form
            onSubmit={(e) => handleSubmit(e)}
            className="grid gap-3 rounded-md border border-dashed border-brand-400 p-3 sm:grid-cols-[1fr_2fr_auto]"
          >
            <div>
              <Label htmlFor="new-label" className="sr-only">라벨</Label>
              <Input id="new-label" name="label" placeholder="라벨 (예: Keyless)" required maxLength={50} />
            </div>
            <div>
              <Label htmlFor="new-url" className="sr-only">URL</Label>
              <Input id="new-url" name="url" placeholder="https://..." type="url" required />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>추가</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowNew(false)}>취소</Button>
            </div>
            {(errors.label || errors.url) && (
              <div className="col-span-full text-xs text-red-600">{errors.label || errors.url}</div>
            )}
          </form>
        )}

        {!showNew && canAddMore && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowNew(true)}
            className="self-start"
          >
            <Plus className="h-4 w-4" />링크 추가
          </Button>
        )}

        {!canAddMore && (
          <p className="text-xs text-slate-500">
            최대 {MAX_LINKS}개까지 등록 가능합니다. 추가하려면 기존 항목을 먼저 삭제해주세요.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
