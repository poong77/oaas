'use client';

/**
 * 매니저 답변 폼 — 공개/내부 메모 선택.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { AlertCircle, Lock, MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  addAdminPublicMessageAction,
  addInternalMemoAction,
} from '@/app/actions/ticket-actions';
import { cn } from '@/lib/utils';

type Kind = 'public' | 'internal_memo';

export function AdminReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>('public');
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
      const result =
        kind === 'public'
          ? await addAdminPublicMessageAction(fd)
          : await addInternalMemoAction(fd);
      if (!result.ok) {
        setError(result.message ?? '저장 실패');
        return;
      }
      setContent('');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <KindToggle
          active={kind === 'public'}
          onClick={() => setKind('public')}
          icon={<MessageSquare className="h-4 w-4" />}
          label="공개 답변"
          hint="호텔리어에게 표시됨"
        />
        <KindToggle
          active={kind === 'internal_memo'}
          onClick={() => setKind('internal_memo')}
          icon={<Lock className="h-4 w-4" />}
          label="내부 메모"
          hint="매니저·어드민만 보임"
          tone="warn"
        />
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          kind === 'public'
            ? '호텔리어에게 전달할 답변을 작성하세요'
            : '내부 처리·후속 조치·근거 등을 자유롭게 기록하세요'
        }
        rows={5}
        disabled={pending}
        className={
          kind === 'internal_memo'
            ? 'border-amber-300 focus-visible:ring-amber-400'
            : ''
        }
      />
      {error && (
        <div className="flex items-start gap-2 text-xs text-red-500">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
          {error}
        </div>
      )}
      <div className="flex items-center justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? '저장 중...' : kind === 'public' ? '공개 답변 등록' : '내부 메모 등록'}
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

function KindToggle({
  active,
  onClick,
  icon,
  label,
  hint,
  tone = 'brand',
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
  tone?: 'brand' | 'warn';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
        active
          ? tone === 'warn'
            ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-300 dark:border-amber-700 dark:bg-amber-950/40 dark:ring-amber-700'
            : 'border-brand-400 bg-brand-50 ring-2 ring-brand-300 dark:border-brand-700 dark:bg-brand-950/40 dark:ring-brand-700'
          : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-700 dark:hover:bg-brand-950/20',
      )}
    >
      <span
        className={cn(
          'rounded-md p-1.5',
          active
            ? tone === 'warn'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
              : 'bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
        )}
      >
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="font-medium">{label}</span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      </div>
    </button>
  );
}
