'use client';

/**
 * AiAssistantPanel — Claude 보조 패널 (A5).
 *
 * 흐름:
 *   - "✨ AI 보조" 버튼 → aiAssistArticleAction
 *   - 5종 카드 (slug/summary/keywords/related/chatbot_meta) → 각 [적용]/[거부]
 *   - 적용 시 부모로 patch 전달
 *
 * graceful degradation:
 *   - rate-limit: 60초 비활성화 + 토스트
 *   - api-error: 활성 유지, 재시도 가능
 *   - parse-error: 재시도
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §1-1 (A5)
 */

import { useState } from 'react';
import { Sparkles, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { aiAssistArticleAction } from '@/app/actions/article-actions';
import type { ArticleContentType } from '@/db/schema';
import type { AiAssistOutput } from '@/lib/ai/prompts/article-assistant';

export interface AiAssistPatch {
  slug?: string;
  summary?: string;
  keywords?: string[];
  relatedHints?: string[];
  chatbotMeta?: AiAssistOutput['chatbot_meta'];
}

export interface AiAssistantPanelProps {
  inputContext: {
    title: string;
    body: string;
    contentType: ArticleContentType;
    productCode: string;
    categoryPath: string[];
    existingKeywords: string[];
  };
  onApply: (patch: AiAssistPatch) => void;
  /** 비활성 조건: 본문 500자 미만, 제목 없음 등. */
  disabled?: boolean;
}

export function AiAssistantPanel({
  inputContext,
  onApply,
  disabled = false,
}: AiAssistantPanelProps) {
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<AiAssistOutput | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);

  const onCooldown = Date.now() < cooldownUntil;
  const canCall =
    !disabled &&
    !loading &&
    !onCooldown &&
    inputContext.productCode &&
    (inputContext.title.trim().length > 0 || inputContext.body.length > 200);

  async function handleCall() {
    if (!canCall) return;
    setLoading(true);
    try {
      const result = await aiAssistArticleAction(inputContext);
      if (!result.ok) {
        toast.error(result.message);
        if (result.reason === 'rate-limit') {
          setCooldownUntil(Date.now() + 60_000);
        }
        return;
      }
      if (result.truncated) {
        toast.info(
          `본문이 길어 5000자만 분석했어요 (원본 ${result.originalLength?.toLocaleString()}자).`,
        );
      }
      setOutput(result.data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-300" />
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              AI 보조 — 5종 메타 추출
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleCall}
            disabled={!canCall}
          >
            {loading ? '추출 중...' : '✨ 한 번 클릭으로 작성 보조'}
          </Button>
        </div>

        {disabled && !output && (
          <p className="text-xs text-slate-500">
            본문 500자 또는 제목 작성 후 활성화돼요.
          </p>
        )}
        {onCooldown && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            분당 한도 초과로 잠시 후 다시 시도할 수 있어요.
          </p>
        )}

        {output && (
          <div className="grid gap-2">
            <ApplyCard
              label="slug"
              value={output.slug}
              onApply={() => onApply({ slug: output.slug })}
            />
            <ApplyCard
              label="요약 (summary)"
              value={output.summary}
              onApply={() => onApply({ summary: output.summary })}
            />
            <ApplyCard
              label={`키워드 ${output.keywords.length}개`}
              value={output.keywords.join(', ')}
              onApply={() => onApply({ keywords: output.keywords })}
            />
            <ApplyCard
              label="관련 문서 키워드"
              value={output.related_search_hints.join(', ') || '(없음)'}
              onApply={() =>
                onApply({ relatedHints: output.related_search_hints })
              }
            />
            <ChatbotMetaCard meta={output.chatbot_meta} onApply={onApply} />
            <button
              type="button"
              onClick={() => setOutput(null)}
              className="self-end text-xs text-slate-400 hover:text-rose-500"
            >
              모두 닫기
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApplyCard({
  label,
  value,
  onApply,
}: {
  label: string;
  value: string;
  onApply: () => void;
}) {
  const [applied, setApplied] = useState(false);
  return (
    <div className="rounded-md border border-slate-200 p-2 dark:border-slate-700">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              onApply();
              setApplied(true);
              toast.success(`${label} 적용됨`);
            }}
            disabled={applied}
            className={`inline-flex h-6 items-center gap-1 rounded px-2 text-xs font-medium ${
              applied
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-brand-500 text-white hover:bg-brand-600'
            }`}
          >
            {applied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {applied ? '적용됨' : '적용'}
          </button>
          <button
            type="button"
            onClick={() => setApplied(true)}
            className="inline-flex h-6 items-center rounded border border-slate-200 px-2 text-xs text-slate-500 hover:bg-slate-50 dark:border-slate-700"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}

function ChatbotMetaCard({
  meta,
  onApply,
}: {
  meta: AiAssistOutput['chatbot_meta'];
  onApply: (patch: AiAssistPatch) => void;
}) {
  const [applied, setApplied] = useState(false);
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50/30 p-2 dark:border-emerald-800 dark:bg-emerald-950/20">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
          챗봇 KB 메타 (v2 영속화)
        </span>
        <button
          type="button"
          onClick={() => {
            onApply({ chatbotMeta: meta });
            setApplied(true);
            toast.success('챗봇 메타 적용됨 (draft에 보관)');
          }}
          disabled={applied}
          className={`inline-flex h-6 items-center gap-1 rounded px-2 text-xs font-medium ${
            applied
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {applied ? <Check className="h-3 w-3" /> : null}
          {applied ? '적용됨' : '적용'}
        </button>
      </div>
      <dl className="mt-1.5 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">의도</dt>
          <dd className="text-slate-700 dark:text-slate-200">{meta.intent}</dd>
        </div>
        <div>
          <dt className="text-slate-500">예상 시간</dt>
          <dd className="text-slate-700 dark:text-slate-200">
            {meta.expected_time_minutes}분
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">엔티티</dt>
          <dd className="text-slate-700 dark:text-slate-200">
            {meta.entities.join(', ') || '(없음)'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">사전 조건</dt>
          <dd className="text-slate-700 dark:text-slate-200">
            {meta.prerequisites.join(', ') || '(없음)'}
          </dd>
        </div>
        {meta.steps && meta.steps.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="text-slate-500">단계</dt>
            <dd>
              <ol className="ml-4 list-decimal text-slate-700 dark:text-slate-200">
                {meta.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
