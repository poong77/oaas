'use client';

/**
 * ai-reply-assist — AI 답변 어시스트 패널.
 *
 * 블록 ① 관련 도움말(articles/faqs)  ② 유사 과거 티켓  ③ AI 초안 생성 버튼.
 * 데스크톱 기본 열림 / 모바일 기본 닫힘(접이식). 추천은 서버 SSR 데이터(로딩 없음).
 * 초안 생성은 모델 모달 → generateReplyDraftAction → onDraft 콜백(부모가 에디터 주입).
 *
 * @see docs/02-design/features/ai-reply-assist.design.md §9
 */

import { useEffect, useState, useTransition } from 'react';
import {
  ChevronDown,
  ExternalLink,
  FileText,
  HelpCircle,
  Quote,
  Sparkles,
  Ticket as TicketIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { generateReplyDraftAction } from '@/app/actions/ticket-assist-actions';
import type {
  AssistDoc,
  AssistModel,
  AssistTicket,
  Citation,
  TicketAssist,
} from '@/lib/services/ticket-assist-types';
import { AiModelSelectModal, type DocRef } from './ai-model-select-modal';

const STATUS_LABEL: Record<string, string> = {
  received: '접수',
  in_progress: '처리중',
  completed: '완료',
};
const STATUS_TONE: Record<string, 'slate' | 'brand' | 'warn' | 'success'> = {
  received: 'brand',
  in_progress: 'warn',
  completed: 'success',
};

export type DraftPayload = {
  draft: string;
  modelLabel: string;
  citations: Citation[];
};

export function AiAssistPanel({
  ticketId,
  assist,
  models,
  defaultModelId,
  onInsertCitation,
  onDraft,
}: {
  ticketId: string;
  assist: TicketAssist;
  models: AssistModel[];
  defaultModelId: string | null;
  onInsertCitation: (text: string) => void;
  onDraft: (payload: DraftPayload) => void;
}) {
  const [open, setOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [inserted, setInserted] = useState<Set<string>>(new Set());

  // 모바일 기본 닫힘
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) setOpen(false);
  }, []);

  const hasRecommend = assist.docs.length > 0 || assist.tickets.length > 0;

  function handleInsert(d: AssistDoc) {
    const text = `> 📎 [${d.title}](${d.url})${d.snippet ? `\n> ${d.snippet}` : ''}`;
    onInsertCitation(text);
    setInserted((prev) => new Set(prev).add(`${d.type}:${d.id}`));
  }

  function handleConfirm({ modelId, docIds }: { modelId: string; docIds: DocRef[] }) {
    setModalOpen(false);
    setError(null);
    startTransition(async () => {
      const res = await generateReplyDraftAction({ ticketId, docIds, modelId });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      const model = models.find((m) => m.id === modelId);
      const citations = buildCitations(docIds, assist);
      onDraft({
        draft: res.draft,
        modelLabel: model?.label ?? 'AI',
        citations,
      });
    });
  }

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50/30 dark:border-brand-900 dark:bg-brand-950/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center gap-1.5 px-3 py-2 text-sm font-semibold text-brand-700 dark:text-brand-300"
      >
        <Sparkles className="h-4 w-4" />
        AI 답변 어시스트
        {hasRecommend && (
          <span className="text-xs font-normal text-brand-500/80">
            추천 {assist.docs.length + assist.tickets.length}건
          </span>
        )}
        <ChevronDown
          className={cn(
            'ml-auto h-4 w-4 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto border-t border-brand-100 p-3 dark:border-brand-900/60">
          {/* 블록 ① 관련 도움말 */}
          <section>
            <h4 className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <HelpCircle className="h-3 w-3" />
              관련 도움말 {assist.docs.length > 0 && `(${assist.docs.length})`}
            </h4>
            {assist.docs.length === 0 ? (
              <EmptyHint text="관련 도움말을 찾지 못했습니다." />
            ) : (
              <ul className="flex flex-col gap-1">
                {assist.docs.map((d) => (
                  <li
                    key={`${d.type}:${d.id}`}
                    className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <Badge tone={d.type === 'faq' ? 'slate' : 'brand'}>
                      {d.type === 'faq' ? 'FAQ' : '도움말'}
                    </Badge>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate text-slate-700 hover:underline dark:text-slate-200"
                      title={d.title}
                    >
                      {d.title}
                    </a>
                    <span
                      className="text-[11px] tabular-nums text-slate-400"
                      aria-label={`유사도 ${Math.round(d.score * 100)}퍼센트`}
                    >
                      {Math.round(d.score * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => handleInsert(d)}
                      disabled={inserted.has(`${d.type}:${d.id}`)}
                      className="inline-flex flex-none items-center gap-0.5 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      <Quote className="h-2.5 w-2.5" />
                      {inserted.has(`${d.type}:${d.id}`) ? '삽입됨' : '인용'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 블록 ② 유사 과거 티켓 */}
          <section>
            <h4 className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <TicketIcon className="h-3 w-3" />
              유사 과거 티켓 {assist.tickets.length > 0 && `(${assist.tickets.length})`}
            </h4>
            {assist.tickets.length === 0 ? (
              <EmptyHint text="유사한 과거 티켓이 없습니다." />
            ) : (
              <ul className="flex flex-col gap-1">
                {assist.tickets.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-400">
                        {t.ticketNo}
                      </span>
                      <Badge tone={STATUS_TONE[t.status] ?? 'slate'}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </Badge>
                      <span
                        className="flex-1 truncate text-slate-700 dark:text-slate-200"
                        title={t.title}
                      >
                        {t.title}
                      </span>
                      <a
                        href={t.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex flex-none items-center gap-0.5 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:text-slate-300"
                      >
                        열기
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                    {t.resolutionSnippet && (
                      <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
                        해결: {t.resolutionSnippet}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 블록 ③ AI 초안 생성 */}
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              disabled={pending || models.length === 0}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {pending ? '초안 생성 중...' : 'AI 답변 초안 생성'}
            </button>
            {models.length === 0 && (
              <p className="flex items-center gap-1 text-[11px] text-slate-400">
                <FileText className="h-3 w-3" />
                활성 AI 모델이 없습니다 (어드민에서 설정).
              </p>
            )}
            {error && (
              <p className="text-[11px] text-red-500">{error}</p>
            )}
          </div>
        </div>
      )}

      <AiModelSelectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        models={models}
        defaultModelId={defaultModelId}
        docs={assist.docs}
        tickets={assist.tickets}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-dashed border-slate-200 px-2.5 py-2 text-[11px] text-slate-400 dark:border-slate-700">
      {text}
    </p>
  );
}

function buildCitations(docIds: DocRef[], assist: TicketAssist): Citation[] {
  const out: Citation[] = [];
  for (const ref of docIds) {
    if (ref.type === 'ticket') {
      const t = assist.tickets.find((x) => x.id === ref.id);
      if (t) out.push({ type: 'ticket', id: t.id, title: t.title, url: t.url });
    } else {
      const d = assist.docs.find((x) => x.id === ref.id && x.type === ref.type);
      if (d) out.push({ type: d.type, id: d.id, title: d.title, url: d.url });
    }
  }
  return out;
}
