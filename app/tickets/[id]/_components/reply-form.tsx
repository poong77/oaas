'use client';

/**
 * 호텔리어 추가 답변 폼 (IS-02).
 *
 * - completed 상태에선 폼을 숨기고 안내 노출.
 * - 제출 후 router.refresh()로 메시지 타임라인 갱신.
 * - Phase 3: RichEditor lite 통합 + 자동 저장
 */

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RichEditor } from '@/components/editor/rich-editor';
import { deleteDraftAfterPublish } from '@/lib/editor/draft-client';
import { addPublicMessageAction } from '@/app/actions/ticket-actions';

export function ReplyForm({
  ticketId,
  disabled,
  disabledReason,
}: {
  ticketId: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (content.trim().length === 0) {
      setError('내용을 입력해주세요');
      return;
    }
    const fd = new FormData();
    fd.append('ticketId', ticketId);
    fd.append('content', content.trim());
    startTransition(async () => {
      const result = await addPublicMessageAction(fd);
      if (!result.ok) {
        setError(result.message ?? '저장 실패');
        return;
      }
      await deleteDraftAfterPublish('ticket-message', ticketId);
      setContent('');
      router.refresh();
    });
  }

  if (disabled) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/40 px-4 py-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        {disabledReason ?? '현재 상태에서는 답변을 작성할 수 없습니다.'}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <RichEditor
        mode="lite"
        value={content}
        onChange={setContent}
        minHeight={140}
        placeholder="추가로 알려주실 내용을 작성해주세요."
        disabled={pending}
        autoSave={{
          scope: 'ticket-message',
          targetId: ticketId,
        }}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? '저장 중...' : '답변 등록'}
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
