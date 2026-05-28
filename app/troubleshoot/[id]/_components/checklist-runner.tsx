'use client';

/**
 * 체크리스트 진행 UI — Phase 4 SF-02.
 *
 * - 현재 step_no를 client state로 관리
 * - 진입 시 view counter +1 (fire-and-forget)
 * - 'next' → 다음 활성 단계로 (없으면 'resolved' 처리)
 * - 'resolved' → 해결 결과 화면 + 카운터 +1
 * - 'escalate' → 접수 안내 화면 + 카운터 +1 + /tickets/new?from=checklist&checklist=...&step=...
 */

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ListChecks,
  RefreshCw,
  Send,
  TriangleAlert,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MarkdownView } from '@/components/articles/markdown-view';
import {
  bumpChecklistViewAction,
  markChecklistEscalatedAction,
  markChecklistResolvedAction,
} from '@/app/actions/checklist-actions';
import type {
  Checklist,
  ChecklistStep,
  ChecklistStepAction,
} from '@/db/schema';
import { cn } from '@/lib/utils';

type Outcome = 'resolved' | 'escalate' | null;

export function ChecklistRunner({
  checklist,
  steps,
  productLabel,
}: {
  checklist: Checklist;
  steps: ChecklistStep[];
  productLabel: string;
}) {
  // 정렬: step_no 오름차순 (이미 정렬되었지만 안전망)
  const orderedSteps = useMemo(
    () => [...steps].sort((a, b) => a.stepNo - b.stepNo),
    [steps],
  );

  const [currentIdx, setCurrentIdx] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [resolvedAtStep, setResolvedAtStep] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const viewBumpedRef = useRef(false);

  // view counter
  useEffect(() => {
    if (viewBumpedRef.current) return;
    viewBumpedRef.current = true;
    void bumpChecklistViewAction(checklist.id);
  }, [checklist.id]);

  const totalSteps = orderedSteps.length;
  const currentStep =
    currentIdx >= 0 && currentIdx < totalSteps
      ? orderedSteps[currentIdx]
      : null;

  function handleAction(action: ChecklistStepAction, stepNo: number) {
    if (action === 'next') {
      const nextIdx = currentIdx + 1;
      if (nextIdx >= totalSteps) {
        // 마지막 단계 이후 next → resolved 처리
        finishResolved(stepNo);
      } else {
        setCurrentIdx(nextIdx);
      }
      return;
    }
    if (action === 'resolved') {
      finishResolved(stepNo);
      return;
    }
    if (action === 'escalate') {
      finishEscalated(stepNo);
      return;
    }
  }

  function finishResolved(stepNo: number) {
    setOutcome('resolved');
    setResolvedAtStep(stepNo);
    startTransition(async () => {
      await markChecklistResolvedAction(checklist.id);
    });
  }

  function finishEscalated(stepNo: number) {
    setOutcome('escalate');
    setResolvedAtStep(stepNo);
    startTransition(async () => {
      await markChecklistEscalatedAction(checklist.id);
    });
  }

  function restart() {
    setCurrentIdx(0);
    setOutcome(null);
    setResolvedAtStep(null);
  }

  // 단계가 0개인 경우
  if (totalSteps === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-6 text-center">
          <ListChecks className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="text-base font-semibold">
            이 체크리스트는 아직 단계가 등록되지 않았습니다
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            잠시 후 다시 시도하거나 직접 문의를 접수해주세요.
          </p>
          <div className="mt-2 flex justify-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/troubleshoot">
                <ArrowLeft className="h-4 w-4" />
                목록으로
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/tickets/new">문의 접수</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 결과 화면
  if (outcome === 'resolved') {
    return (
      <Card className="border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30">
        <CardContent className="flex flex-col gap-4 p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <div>
            <h2 className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
              🎉 문제가 해결되었습니다!
            </h2>
            <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-300/80">
              {resolvedAtStep
                ? `${resolvedAtStep}단계에서 해결되었습니다.`
                : '도움이 되었다니 다행입니다.'}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={restart} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
              다시 진단하기
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/troubleshoot">
                다른 체크리스트 보기
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/">홈으로</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (outcome === 'escalate') {
    // TODO(phase-4-temp): Phase 5 접수 폼이 from/checklist/step 컨텍스트를 활용해 pre-fill 예정
    const escalateLink = `/tickets/new?from=checklist&checklist=${
      checklist.id
    }${resolvedAtStep ? `&step=${resolvedAtStep}` : ''}`;
    return (
      <Card className="border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
        <CardContent className="flex flex-col gap-4 p-6 text-center">
          <TriangleAlert className="mx-auto h-12 w-12 text-amber-500" />
          <div>
            <h2 className="text-xl font-bold text-amber-700 dark:text-amber-300">
              이슈 접수가 필요한 상황입니다
            </h2>
            <p className="mt-1 text-sm text-amber-700/80 dark:text-amber-300/80">
              체크리스트로 해결되지 않는 문제입니다. 운영팀이 직접 확인할 수 있도록
              문의를 접수해주세요.
              {resolvedAtStep && (
                <span className="block">
                  ({resolvedAtStep}단계에서 분기되었습니다.)
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href={escalateLink}>
                <Send className="h-4 w-4" />
                문의 접수 하기
              </Link>
            </Button>
            <Button onClick={restart} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
              다시 진단
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/troubleshoot">목록으로</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 진행 화면
  const step = currentStep!;
  const stepIndexDisplay = currentIdx + 1;
  const progressPct = Math.round(((stepIndexDisplay - 1) / totalSteps) * 100);

  return (
    <div className="flex flex-col gap-4">
      {/* 진행 정보 */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            <Badge tone="brand" className="mr-1 uppercase">
              {productLabel}
            </Badge>
            {checklist.title}
          </span>
          <span>
            {stepIndexDisplay} / {totalSteps} 단계
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* 단계 카드 */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              {step.stepNo}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {step.title}
              </h2>
              {step.bodyMarkdown && (
                <div className="mt-2 text-sm">
                  <MarkdownView
                    source={step.bodyMarkdown}
                    className="text-sm leading-7"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              size="lg"
              variant="default"
              disabled={pending}
              onClick={() => handleAction(step.conditionYesAction, step.stepNo)}
              className="min-w-[8rem]"
            >
              {step.yesLabel}
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={pending}
              onClick={() => handleAction(step.conditionNoAction, step.stepNo)}
              className={cn('min-w-[8rem]')}
            >
              {step.noLabel}
            </Button>
          </div>

          {/* 액션 힌트 */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span>
              {step.yesLabel}: {actionLabel(step.conditionYesAction)}
            </span>
            <span className="text-slate-300">·</span>
            <span>
              {step.noLabel}: {actionLabel(step.conditionNoAction)}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <Link
          href="/troubleshoot"
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-3 w-3" />
          체크리스트 목록
        </Link>
        <button
          type="button"
          onClick={restart}
          disabled={pending || currentIdx === 0}
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <RefreshCw className="h-3 w-3" />
          처음부터 다시
        </button>
      </div>
    </div>
  );
}

function actionLabel(a: ChecklistStepAction): string {
  switch (a) {
    case 'next':
      return '다음 단계';
    case 'resolved':
      return '해결됨';
    case 'escalate':
      return '접수 필요';
    default:
      return a;
  }
}
