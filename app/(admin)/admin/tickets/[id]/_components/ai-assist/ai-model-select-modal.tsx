'use client';

/**
 * ai-reply-assist — AI 모델 선택 모달.
 *
 * 초안 생성 버튼 클릭 시 오픈. 모델 라디오 + 근거 문서 체크 + "이 모델 기억"(localStorage).
 * 활성 모델만 노출(부모가 listActiveModels 결과 전달). 모델 0개면 안내 EmptyState.
 *
 * @see docs/02-design/features/ai-reply-assist.design.md §9.1
 */

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useMemo, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  AssistDoc,
  AssistModel,
  AssistTicket,
} from '@/lib/services/ticket-assist-types';

const LS_MODEL = 'ai-reply-model';

export type DocRef = { type: 'article' | 'faq' | 'ticket'; id: string };

type Candidate = {
  type: 'article' | 'faq' | 'ticket';
  id: string;
  title: string;
  badge: string;
  score: number;
};

const TIER_TONE: Record<AssistModel['tier'], 'slate' | 'brand' | 'warn'> = {
  economy: 'slate',
  balanced: 'brand',
  premium: 'warn',
};

export function AiModelSelectModal({
  open,
  onClose,
  models,
  defaultModelId,
  docs,
  tickets,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  models: AssistModel[];
  defaultModelId: string | null;
  docs: AssistDoc[];
  tickets: AssistTicket[];
  onConfirm: (input: { modelId: string; docIds: DocRef[] }) => void;
}) {
  const candidates = useMemo<Candidate[]>(
    () => [
      ...docs.map((d) => ({
        type: d.type,
        id: d.id,
        title: d.title,
        badge: d.type === 'faq' ? 'FAQ' : '도움말',
        score: d.score,
      })),
      ...tickets.map((t) => ({
        type: 'ticket' as const,
        id: t.id,
        title: t.title,
        badge: '과거 티켓',
        score: t.score,
      })),
    ],
    [docs, tickets],
  );

  const [modelId, setModelId] = useState<string>('');
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // 오픈 시 초기화: 모델(기억값 > 기본값 > 첫번째), 문서 top-3 체크
  useEffect(() => {
    if (!open) return;
    const remembered =
      typeof window !== 'undefined' ? localStorage.getItem(LS_MODEL) : null;
    const valid = (id: string | null) =>
      id && models.some((m) => m.id === id) ? id : null;
    setModelId(
      valid(remembered) ?? valid(defaultModelId) ?? models[0]?.id ?? '',
    );
    setChecked(new Set(candidates.slice(0, 3).map((c) => `${c.type}:${c.id}`)));
  }, [open, models, defaultModelId, candidates]);

  function toggle(c: Candidate) {
    const key = `${c.type}:${c.id}`;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleConfirm() {
    if (!modelId) return;
    localStorage.setItem(LS_MODEL, modelId);
    const docIds: DocRef[] = candidates
      .filter((c) => checked.has(`${c.type}:${c.id}`))
      .map((c) => ({ type: c.type, id: c.id }));
    onConfirm({ modelId, docIds });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between border-b border-slate-100 p-4 dark:border-slate-800">
            <div>
              <Dialog.Title className="flex items-center gap-1.5 text-base font-semibold text-slate-900 dark:text-slate-50">
                <Sparkles className="h-4 w-4 text-brand-500" />
                AI 답변 초안 생성
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                모델과 참고 문서를 선택하세요. 생성된 초안은 검수 후 발송됩니다.
              </Dialog.Description>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {models.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-400">
                활성화된 AI 모델이 없습니다.
                <br />
                어드민 → 시스템 설정 → AI 모델에서 활성화해주세요.
              </div>
            ) : (
              <>
                <div className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  모델
                </div>
                <div className="flex flex-col gap-1.5" role="radiogroup">
                  {models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={modelId === m.id}
                      onClick={() => setModelId(m.id)}
                      className={cn(
                        'flex items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors',
                        modelId === m.id
                          ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-300 dark:border-brand-700 dark:bg-brand-950/40 dark:ring-brand-700'
                          : 'border-slate-200 hover:border-brand-300 hover:bg-brand-50/30 dark:border-slate-700 dark:hover:border-brand-700',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border',
                          modelId === m.id
                            ? 'border-brand-500'
                            : 'border-slate-300 dark:border-slate-600',
                        )}
                      >
                        {modelId === m.id && (
                          <span className="h-2 w-2 rounded-full bg-brand-500" />
                        )}
                      </span>
                      <span className="flex flex-col">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
                          {m.label}
                          <Badge tone={TIER_TONE[m.tier]}>{m.tier}</Badge>
                        </span>
                        {m.description && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {m.description}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>

                {candidates.length > 0 && (
                  <>
                    <div className="mb-2 mt-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      참고 문서{' '}
                      <span className="font-normal text-slate-400">
                        (체크된 문서만 근거로 사용)
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {candidates.map((c) => {
                        const key = `${c.type}:${c.id}`;
                        const on = checked.has(key);
                        return (
                          <label
                            key={key}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => toggle(c)}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                            />
                            <Badge tone="slate">{c.badge}</Badge>
                            <span className="flex-1 truncate text-slate-700 dark:text-slate-200">
                              {c.title}
                            </span>
                            <span className="text-[11px] tabular-nums text-slate-400">
                              {Math.round(c.score * 100)}%
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!modelId}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              초안 생성
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
