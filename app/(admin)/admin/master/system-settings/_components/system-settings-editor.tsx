'use client';

/**
 * 시스템 설정 편집기 (어드민 only).
 *
 * 기존 row는 인라인 편집. 신규는 createOnly 폼에서 key + value 입력.
 * value는 JSON 파싱 시도, 실패하면 원본 문자열.
 */

import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  upsertSystemSettingAction,
  setSystemSettingActiveAction,
} from '@/app/actions/master-actions';
import {
  KNOWN_SETTING_KEYS,
  type KnownSettingKey,
} from '@/lib/services/master-meta';
import type { SystemSetting } from '@/db/schema';

function valueToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function SystemSettingsEditor({
  items,
  createOnly = false,
}: {
  items: SystemSetting[];
  createOnly?: boolean;
}) {
  if (createOnly) return <CreateRow />;
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {items.map((it) => (
        <Row key={it.id} item={it} />
      ))}
    </div>
  );
}

function Row({ item }: { item: SystemSetting }) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await upsertSystemSettingAction(undefined, fd);
      if (res.ok) {
        toast.success('저장되었습니다');
        router.refresh();
      } else {
        toast.error(res.message ?? '저장 실패');
      }
    });
  }

  async function toggleActive() {
    const target = !item.isActive;
    const ok = await confirm({
      title: target ? '설정을 복구합니다' : '설정을 비활성화합니다',
      confirmText: target ? '복구' : '비활성화',
      tone: target ? 'default' : 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await setSystemSettingActiveAction(item.id, target);
      if (res.ok) {
        toast.success(target ? '복구되었습니다' : '비활성화되었습니다');
        router.refresh();
      } else {
        toast.error(res.message ?? '실패');
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`flex flex-col gap-3 p-4 ${item.isActive ? '' : 'opacity-50'}`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-60 flex-col gap-1">
          <Label className="text-[10px]">키</Label>
          <Input
            name="key"
            defaultValue={item.key}
            readOnly
            className="font-mono text-xs"
          />
        </div>
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <Label className="text-[10px]">설명</Label>
          <Input name="description" defaultValue={item.description ?? ''} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-[10px]">값 (JSON or string)</Label>
        <Textarea
          name="value"
          defaultValue={valueToString(item.value)}
          rows={3}
          className="font-mono text-xs"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          저장
        </Button>
        <Button
          type="button"
          size="sm"
          variant={item.isActive ? 'ghost' : 'outline'}
          onClick={toggleActive}
          disabled={pending}
        >
          {item.isActive ? '비활성화' : '복구'}
        </Button>
      </div>
    </form>
  );
}

function CreateRow() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState<string>('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await upsertSystemSettingAction(undefined, fd);
      if (res.ok) {
        toast.success('업서트되었습니다');
        form.reset();
        setKey('');
        router.refresh();
      } else {
        toast.error(res.message ?? '실패');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-60 flex-col gap-1">
          <Label className="text-[10px]">키</Label>
          <Input
            name="key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            list="setting-keys"
            placeholder="max_upload_mb"
            required
            className="font-mono text-xs"
          />
          <datalist id="setting-keys">
            {KNOWN_SETTING_KEYS.map((k: KnownSettingKey) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </div>
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <Label className="text-[10px]">설명</Label>
          <Input
            name="description"
            placeholder="이 설정의 용도 (선택)"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-[10px]">값 (JSON or string)</Label>
        <Textarea
          name="value"
          rows={3}
          placeholder={'예) 50  또는  {"start": "09:00", "end": "19:00"}'}
          className="font-mono text-xs"
        />
      </div>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          업서트
        </Button>
      </div>
    </form>
  );
}
