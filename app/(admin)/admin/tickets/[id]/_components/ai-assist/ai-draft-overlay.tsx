'use client';

/**
 * ai-reply-assist — AI 초안 검수 배지 + 출처 칩 (에디터 상단).
 *
 * 검수 강제(시각): AI가 생성한 초안임을 amber 배너로 고정 표시.
 * 출처 칩: 초안 근거 문서/티켓 — 클릭 시 새 탭. 기술적 검수 게이트는 reply-form 발송 시 ConfirmDialog.
 *
 * @see docs/02-design/features/ai-reply-assist.design.md §9.4
 */

import { AlertTriangle, ExternalLink, FileText } from 'lucide-react';
import type { Citation } from '@/lib/services/ticket-assist-types';

export function AiDraftOverlay({
  modelLabel,
  citations,
}: {
  modelLabel: string;
  citations: Citation[];
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-950/30"
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5" />
        AI 생성 — 검수 후 발송하세요
        <span className="ml-auto font-normal text-amber-600/80 dark:text-amber-400/80">
          {modelLabel}
        </span>
      </div>
      {citations.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700/80 dark:text-amber-400/80">
            <FileText className="h-3 w-3" />
            출처
          </span>
          {citations.map((c) => (
            <a
              key={`${c.type}:${c.id}`}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-[200px] items-center gap-1 truncate rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[11px] text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200"
              title={c.title}
            >
              <span className="truncate">{c.title}</span>
              <ExternalLink className="h-2.5 w-2.5 flex-none" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
