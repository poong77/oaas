'use client';

/**
 * 티켓 메시지 타임라인 — 호텔리어/매니저 공용 가능.
 *
 * showInternalMemo:
 *   - true: internal_memo도 화면에 회색 박스로 표시 (매니저 화면)
 *   - false: internal_memo는 서버에서 필터되어 안 옴 (호텔리어 화면)
 *
 * status_change 메시지는 회색 inline pill로 시간 라인 사이에 표시.
 * system 메시지는 매니저 화면에서만 작은 회색으로 표시 (호텔리어 화면엔 안 옴).
 */

import { Eye, Lock, RefreshCcw, Sparkles, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MarkdownView } from '@/components/articles/markdown-view';
import { cn } from '@/lib/utils';

export type ThreadMessage = {
  id: string;
  kind: 'public' | 'internal_memo' | 'status_change' | 'system';
  content: string;
  authorName: string | null;
  authorRole: string | null;
  createdAt: Date | string;
  metadata?: Record<string, unknown>;
};

function fmtDateTime(d: Date | string): string {
  const date = new Date(d);
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function authorLabel(m: ThreadMessage): string {
  if (!m.authorName) return '시스템';
  if (m.authorRole === 'admin') return `${m.authorName} (어드민)`;
  if (m.authorRole === 'manager') return `${m.authorName} (매니저)`;
  if (m.authorRole === 'hotelier') return m.authorName;
  return m.authorName;
}

function authorTone(role: string | null): 'brand' | 'slate' {
  if (role === 'manager' || role === 'admin') return 'brand';
  return 'slate';
}

export function TicketThread({
  messages,
  showInternalMemo,
  emptyHint = '아직 답변이 없습니다.',
}: {
  messages: ThreadMessage[];
  showInternalMemo: boolean;
  emptyHint?: string;
}) {
  const visibleMessages = messages.filter((m) =>
    showInternalMemo ? true : m.kind !== 'internal_memo' && m.kind !== 'system',
  );

  if (visibleMessages.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/40 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        {emptyHint}
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {visibleMessages.map((m) => {
        if (m.kind === 'status_change') {
          return (
            <li
              key={m.id}
              className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400"
            >
              <RefreshCcw className="h-3 w-3" />
              <span>{m.content}</span>
              <span className="text-slate-400 dark:text-slate-500">·</span>
              <span>{fmtDateTime(m.createdAt)}</span>
            </li>
          );
        }
        if (m.kind === 'system') {
          return (
            <li
              key={m.id}
              className="flex items-center justify-center gap-2 text-[11px] text-slate-400 dark:text-slate-500"
            >
              <Sparkles className="h-3 w-3" />
              <span>{m.content}</span>
              <span>·</span>
              <span>{fmtDateTime(m.createdAt)}</span>
            </li>
          );
        }
        const isInternal = m.kind === 'internal_memo';
        return (
          <li
            key={m.id}
            className={cn(
              'rounded-lg border p-3.5',
              isInternal
                ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30'
                : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                  <User className="h-3 w-3" />
                  <span className="font-medium">{authorLabel(m)}</span>
                </span>
                {isInternal ? (
                  <Badge tone="warn">
                    <Lock className="h-3 w-3" />
                    내부 메모
                  </Badge>
                ) : (
                  m.authorRole && (
                    <Badge tone={authorTone(m.authorRole)}>
                      {m.authorRole === 'admin'
                        ? '어드민'
                        : m.authorRole === 'manager'
                          ? '매니저'
                          : '호텔리어'}
                    </Badge>
                  )
                )}
              </div>
              <span className="text-slate-400 dark:text-slate-500">
                {fmtDateTime(m.createdAt)}
              </span>
            </div>
            <MarkdownView source={m.content} className="text-sm" />
            {isInternal && (
              <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                <Eye className="h-3 w-3" />
                이 메모는 호텔리어에게 표시되지 않습니다
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
