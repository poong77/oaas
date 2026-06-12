'use client';

/**
 * AiAssistantTrigger — Claude 보조 호출 트리거 (A5, UX v1.4).
 *
 * v1.4 변경: 5종 카드 일괄 표시 X → 각 필드 옆 mini 적용 카드로 분산.
 *           이 컴포넌트는 트리거 + 로딩 + 결과 콜백만 담당.
 *
 * 흐름:
 *   - "✨ 작성 보조" 버튼 → aiAssistArticleAction
 *   - 결과 → onResult 콜백 → 부모(shell)가 aiSuggestion state 보관
 *   - 각 필드 옆 KbAiSuggestionCard가 부분 적용 UI 담당
 *
 * graceful degradation:
 *   - rate-limit: 60초 비활성화 + 토스트
 *   - api-error: 활성 유지, 재시도 가능 (실제 에러 메시지 노출 — production 외)
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

export interface AiAssistantPanelProps {
  inputContext: {
    title: string;
    body: string;
    contentType: ArticleContentType;
    productCode: string;
    categoryPath: string[];
    existingKeywords: string[];
  };
  onResult: (output: AiAssistOutput) => void;
  /** 비활성 조건: 본문 500자 미만, 제목 없음 등. */
  disabled?: boolean;
}

export function AiAssistantPanel({
  inputContext,
  onResult,
  disabled = false,
}: AiAssistantPanelProps) {
  const [loading, setLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);

  const onCooldown = Date.now() < cooldownUntil;
  const canCall =
    !disabled &&
    !loading &&
    !onCooldown &&
    !!inputContext.productCode &&
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
      onResult(result.data);
      toast.success('AI 제안이 각 필드 옆에 표시됐어요. 적용/거부를 선택하세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-300" />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            AI 작성 보조
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            슬러그·요약·키워드·관련문서·챗봇메타 한 번에 추출 (각 필드 옆 적용)
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            type="button"
            size="sm"
            onClick={handleCall}
            disabled={!canCall}
          >
            {loading ? '추출 중...' : '✨ 작성 보조'}
          </Button>
          {disabled && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              본문 500자 또는 제목 입력 후 활성
            </span>
          )}
          {onCooldown && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400">
              분당 한도 — 1분 후 가능
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 각 필드 옆 mini 적용 카드
// ─────────────────────────────────────────────────────────────────────────────

export interface KbAiSuggestionCardProps {
  /** 제안 값. null/undefined이면 카드 표시 안 함. */
  value?: string | null;
  /** 적용 클릭 시 호출. */
  onApply: () => void;
  /** 거부 클릭 시 호출 (해당 제안 dismiss). */
  onReject: () => void;
  /** 표시 라벨 (예: 'slug 제안'). */
  label?: string;
  /** 값을 <code> 스타일로 표시할지. */
  mono?: boolean;
}

/**
 * 각 입력 필드 아래에 inline으로 표시되는 작은 적용 카드.
 *
 * @example
 * <Input value={slug} onChange={...} />
 * <KbAiSuggestionCard
 *   value={aiSuggestion?.slug}
 *   onApply={() => { setSlug(aiSuggestion!.slug); clearSlugSuggestion(); }}
 *   onReject={clearSlugSuggestion}
 *   label="slug 제안"
 *   mono
 * />
 */
export function KbAiSuggestionCard({
  value,
  onApply,
  onReject,
  label = 'AI 제안',
  mono = false,
}: KbAiSuggestionCardProps) {
  if (!value) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md border border-brand-200 bg-brand-50/60 px-2 py-1.5 text-xs dark:border-brand-800 dark:bg-brand-950/30">
      <Sparkles className="h-3 w-3 shrink-0 text-brand-600 dark:text-brand-300" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
        {label}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200 ${
          mono ? 'font-mono text-[11px]' : ''
        }`}
        title={value}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => {
          onApply();
          toast.success(`${label} 적용됨`);
        }}
        className="inline-flex h-6 items-center gap-1 rounded bg-brand-500 px-2 text-[10px] font-medium text-white hover:bg-brand-600"
      >
        <Check className="h-3 w-3" />
        적용
      </button>
      <button
        type="button"
        onClick={onReject}
        aria-label="제안 거부"
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-rose-500 dark:border-slate-700"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 챗봇 KB 메타 카드 (별도 영역, 사이드바 또는 사이드 표시)
// ─────────────────────────────────────────────────────────────────────────────

export interface KbAiChatbotMetaCardProps {
  meta: AiAssistOutput['chatbot_meta'] | null;
  onApply: () => void;
  onReject: () => void;
}

export function KbAiChatbotMetaCard({
  meta,
  onApply,
  onReject,
}: KbAiChatbotMetaCardProps) {
  if (!meta) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-emerald-200 bg-emerald-50/40 p-2 dark:border-emerald-800 dark:bg-emerald-950/20">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
          챗봇 KB 메타 (v2 영속화)
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              onApply();
              toast.success('챗봇 메타 적용됨 (draft에 보관)');
            }}
            className="inline-flex h-6 items-center gap-1 rounded bg-emerald-600 px-2 text-[10px] font-medium text-white hover:bg-emerald-700"
          >
            <Check className="h-3 w-3" />
            적용
          </button>
          <button
            type="button"
            onClick={onReject}
            aria-label="제안 거부"
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-rose-500 dark:border-slate-700"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">의도</dt>
          <dd className="text-slate-700 dark:text-slate-200">{meta.intent}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">예상 시간</dt>
          <dd className="text-slate-700 dark:text-slate-200">
            {meta.expected_time_minutes}분
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">엔티티</dt>
          <dd className="text-slate-700 dark:text-slate-200">
            {meta.entities.join(', ') || '(없음)'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">사전 조건</dt>
          <dd className="text-slate-700 dark:text-slate-200">
            {meta.prerequisites.join(', ') || '(없음)'}
          </dd>
        </div>
        {meta.steps && meta.steps.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="text-slate-500 dark:text-slate-400">단계</dt>
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
