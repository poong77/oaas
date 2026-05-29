'use client';

/**
 * 매니저 답변 폼 — 공개/내부 메모 선택.
 *
 * Phase 3:
 *   - RichEditor full 통합 + 자동 저장
 *   - 빠른답변 패널 (Cmd+/ 또는 우상단 버튼)
 * 후속 (Phase 3 Step 2c+): SMS 미리보기 패널, Slack 발송(Cmd+Shift+Enter), Cmd+Enter 저장+발송
 */

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition, type FormEvent } from 'react';
import { AlertCircle, Lock, MessageSquare, Send, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RichEditor } from '@/components/editor/rich-editor';
import { QuickReplyPanel } from '@/components/editor/panels/quick-reply-panel';
import { SmsPreview } from '@/components/editor/panels/sms-preview';
import { deleteDraftAfterPublish } from '@/lib/editor/draft-client';
import {
  addAdminPublicMessageAction,
  addInternalMemoAction,
} from '@/app/actions/ticket-actions';
import { cn } from '@/lib/utils';

type Kind = 'public' | 'internal_memo';

interface AdminReplyFormProps {
  ticketId: string;
  /** 빠른답변 변수 치환용 컨텍스트 (옵션 — 부모가 전달) */
  vars?: {
    hotelName?: string;
    hotelierName?: string;
    ticketNo?: string;
    managerName?: string;
  };
}

export function AdminReplyForm({ ticketId, vars }: AdminReplyFormProps) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>('public');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);

  // Cmd+/ — 빠른답변 패널 토글 (입력 필드 focus 시에만 작동, 폼 영역 한정)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      setQuickReplyOpen((v) => !v);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleInsertTemplate = useCallback(
    (text: string) => {
      // 기존 content 끝에 줄바꿈 + 템플릿 append (간단·안전)
      setContent((prev) => {
        if (!prev.trim()) return text;
        return prev.replace(/\n+$/, '') + '\n\n' + text;
      });
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
      const result =
        kind === 'public'
          ? await addAdminPublicMessageAction(fd)
          : await addInternalMemoAction(fd);
      if (!result.ok) {
        setError(result.message ?? '저장 실패');
        return;
      }
      await deleteDraftAfterPublish('ticket-message', ticketId);
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
          label="📢 공개 답변"
          hint="호텔리어에게 표시 + 상태 변경 시 SMS/이메일 발송 가능"
        />
        <KindToggle
          active={kind === 'internal_memo'}
          onClick={() => setKind('internal_memo')}
          icon={<Lock className="h-4 w-4" />}
          label="🔒 내부 메모"
          hint="매니저·어드민만 보임 · Slack 발송 가능"
          tone="warn"
        />
        <button
          type="button"
          onClick={() => setQuickReplyOpen(true)}
          title="빠른답변 (Cmd+/)"
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-700"
        >
          <Zap className="h-3 w-3" />
          빠른답변
          <kbd className="ml-1 rounded border border-slate-300 px-1 font-mono text-[10px] dark:border-slate-600">
            ⌘/
          </kbd>
        </button>
      </div>
      <RichEditor
        mode="full"
        value={content}
        onChange={setContent}
        minHeight={200}
        placeholder={
          kind === 'public'
            ? '호텔리어에게 전달할 답변을 작성하세요. 빠른답변 템플릿은 Cmd+/'
            : '내부 처리·후속 조치·근거 등을 자유롭게 기록하세요.'
        }
        disabled={pending}
        autoSave={{
          scope: 'ticket-message',
          targetId: ticketId,
        }}
        className={
          kind === 'internal_memo'
            ? 'border-amber-300 dark:border-amber-700'
            : ''
        }
      />
      {/* SMS 미리보기 — 공개 답변에서만 (내부 메모는 SMS 발송 대상 아님) */}
      {kind === 'public' && content.trim().length > 0 && (
        <SmsPreview source={content} />
      )}

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

      <QuickReplyPanel
        open={quickReplyOpen}
        onClose={() => setQuickReplyOpen(false)}
        onInsert={handleInsertTemplate}
        vars={vars}
      />
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
