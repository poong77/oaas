'use client';

/**
 * 알림 템플릿 편집 컴포넌트.
 *
 * mode=create: 신규 (channel/eventKey 입력) → upsertTemplateAction
 * mode=edit:   기존 (channel/eventKey 잠금) → updateTemplateAction
 */

import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  upsertTemplateAction,
  updateTemplateAction,
  setTemplateActiveAction,
} from '@/app/actions/master-actions';
import { KNOWN_EVENT_KEYS } from '@/lib/services/master-meta';
import type { NotificationTemplate } from '@/db/schema';

export function TemplateEditor({
  mode,
  template,
}: {
  mode: 'create' | 'edit';
  template?: NotificationTemplate;
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [channel, setChannel] = useState<string>(template?.channel ?? 'email');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res =
        mode === 'create'
          ? await upsertTemplateAction(undefined, fd)
          : await updateTemplateAction(template!.id, undefined, fd);
      if (res.ok) {
        toast.success('저장되었습니다');
        if (mode === 'create' && res.id) {
          router.push(`/admin/master/notification-templates/${res.id}`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(res.message ?? '저장 실패');
      }
    });
  }

  async function toggleActive() {
    if (!template) return;
    const target = !template.isActive;
    const ok = await confirm({
      title: target ? '템플릿을 복구합니다' : '템플릿을 비활성화합니다',
      confirmText: target ? '복구' : '비활성화',
      tone: target ? 'default' : 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await setTemplateActiveAction(template.id, target);
      if (res.ok) {
        toast.success(target ? '복구되었습니다' : '비활성화되었습니다');
        router.refresh();
      } else {
        toast.error(res.message ?? '실패');
      }
    });
  }

  const isEdit = mode === 'edit';
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>채널</Label>
          {isEdit ? (
            <Input
              value={template!.channel}
              disabled
              className="text-xs font-mono"
            />
          ) : (
            <Select
              name="channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              required
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="slack">Slack</option>
            </Select>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label>이벤트 키</Label>
          {isEdit ? (
            <Input
              value={template!.eventKey}
              disabled
              className="text-xs font-mono"
            />
          ) : (
            <Input
              name="eventKey"
              list="event-keys"
              placeholder="ticket.received"
              required
              className="text-xs font-mono"
            />
          )}
          <datalist id="event-keys">
            {KNOWN_EVENT_KEYS.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </div>
      </div>

      {/* email 채널만 subject */}
      {(isEdit ? template!.channel === 'email' : channel === 'email') && (
        <div className="flex flex-col gap-1">
          <Label>제목 (Email)</Label>
          <Input
            name="subject"
            defaultValue={template?.subject ?? ''}
            placeholder="[OA서포트] 접수 완료 — {{ticket_no}}"
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Label>본문 템플릿</Label>
        <Textarea
          name="bodyTemplate"
          defaultValue={template?.bodyTemplate ?? ''}
          rows={10}
          required
          className="font-mono text-xs"
          placeholder="안녕하세요 {{reporter_name}}님, 티켓 {{ticket_no}} 이(가) 접수되었습니다."
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          치환자: <code>{`{{변수명}}`}</code> 형식. 예:{' '}
          <code>{`{{ticket_no}}`}</code>, <code>{`{{title}}`}</code>,{' '}
          <code>{`{{ticket_url}}`}</code>
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <Label>설명 (내부)</Label>
        <Input
          name="description"
          defaultValue={template?.description ?? ''}
          placeholder="이 템플릿이 어떤 상황에서 사용되는지 설명"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          저장
        </Button>
        {isEdit && (
          <Button
            type="button"
            variant={template!.isActive ? 'ghost' : 'outline'}
            onClick={toggleActive}
            disabled={pending}
          >
            {template!.isActive ? '비활성화' : '복구'}
          </Button>
        )}
      </div>
    </form>
  );
}
