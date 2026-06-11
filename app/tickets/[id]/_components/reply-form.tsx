'use client';

/**
 * 호텔리어 '답변 보완' 폼 (IS-02, major-overhaul P4).
 *
 * - 접수(received) 단계에서만 노출(페이지가 제어). 답변 보완 + 접수 취소.
 * - 답변 보완: 공개 메시지 추가 + 운영팀 Slack 알림.
 * - 접수 취소: 완료 처리(로그). 확인 다이얼로그 경유.
 * - 제출 후 router.refresh()로 타임라인 갱신.
 */

import { useCallback, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Send, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RichEditor } from '@/components/editor/rich-editor';
import {
  SaveIndicator,
  type SaveStatus,
} from '@/components/editor/panels/save-indicator';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { toast } from 'sonner';
import { deleteDraftAfterPublish } from '@/lib/editor/draft-client';
import {
  addAnswerSupplementAction,
  cancelTicketAction,
} from '@/app/actions/ticket-actions';

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const handleAutosaveStatus = useCallback(
    (status: SaveStatus, lastSavedAt: number | null) => {
      setSaveStatus(status);
      setSavedAt(lastSavedAt);
    },
    [],
  );

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
      const result = await addAnswerSupplementAction(fd);
      if (!result.ok) {
        setError(result.message ?? '저장 실패');
        return;
      }
      await deleteDraftAfterPublish('ticket-message', ticketId);
      setContent('');
      toast.success('답변 보완을 등록했습니다');
      router.refresh();
    });
  }

  async function handleCancelTicket() {
    const ok = await confirm({
      title: '접수를 취소하시겠습니까?',
      description:
        '취소하면 이 문의는 완료 처리되며 더 이상 답변을 추가할 수 없습니다. 필요 시 새로 접수해주세요.',
      confirmText: '접수 취소',
      tone: 'danger',
    });
    if (!ok) return;
    const fd = new FormData();
    fd.append('ticketId', ticketId);
    startTransition(async () => {
      const result = await cancelTicketAction(fd);
      if (!result.ok) {
        toast.error(result.message ?? '취소 실패');
        return;
      }
      toast.success('접수가 취소되었습니다');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <RichEditor
        mode="lite"
        value={content}
        onChange={setContent}
        minHeight={180}
        placeholder="접수 내용에 보완하거나 추가로 알려주실 내용을 작성해주세요."
        disabled={pending}
        autoSave={{
          scope: 'ticket-message',
          targetId: ticketId,
          serverDebounceMs: 8000,
        }}
        onAutosaveStatusChange={handleAutosaveStatus}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SaveIndicator status={saveStatus} lastSavedAt={savedAt} />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancelTicket}
            disabled={pending}
            className="text-red-600 hover:text-red-700 dark:text-red-400"
          >
            <XCircle className="h-4 w-4" />
            접수 취소
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? '저장 중...' : '답변 보완'}
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
