'use client';

/**
 * 검색 품질 평가 제어 바 — 평가 실행 / 골든셋 시드 / AI 질의 생성.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Play, Sparkles, Database, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  runEvaluationAction,
  seedFromFaqsAction,
  generateQueriesAction,
} from '@/app/actions/search-eval-actions';
import type { SearchEvalJudge } from '@/db/schema';

const JUDGE_OPTIONS: { value: SearchEvalJudge; label: string; hint: string }[] =
  [
    { value: 'label', label: '라벨 기준', hint: '골든셋 정답 ref로 채점 (빠름·무료)' },
    { value: 'hybrid', label: '하이브리드', hint: '라벨 없으면 LLM 채점' },
    { value: 'llm', label: 'LLM 채점', hint: 'GPT가 적합도 0~3 채점 (느림·과금)' },
  ];

export function EvalControls({ goldenCount }: { goldenCount: number }) {
  const router = useRouter();
  const [judge, setJudge] = useState<SearchEvalJudge>('label');
  const [busy, setBusy] = useState<null | 'run' | 'seed' | 'gen'>(null);
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function onRun() {
    setBusy('run');
    try {
      const res = await runEvaluationAction(judge);
      if (res.ok) {
        toast.success('평가 완료 — 점수가 갱신되었습니다');
        refresh();
      } else {
        toast.error(
          res.message === 'NO_GOLDEN_QUERIES'
            ? '골든셋이 비어 있습니다. 먼저 시드하세요.'
            : `평가 실패: ${res.message ?? '오류'}`,
        );
      }
    } finally {
      setBusy(null);
    }
  }

  async function onSeed() {
    setBusy('seed');
    try {
      const res = await seedFromFaqsAction();
      if (res.ok) {
        toast.success(`FAQ에서 ${res.created}건 골든셋 추가`);
        refresh();
      } else {
        toast.error(`시드 실패: ${res.message ?? '오류'}`);
      }
    } finally {
      setBusy(null);
    }
  }

  async function onGenerate() {
    setBusy('gen');
    try {
      toast.info('AI가 질의를 생성 중입니다. 잠시 걸립니다…');
      const res = await generateQueriesAction(20, 2);
      if (res.ok) {
        toast.success(`AI가 ${res.created}건 질의 생성·추가`);
        refresh();
      } else {
        toast.error(`생성 실패: ${res.message ?? '오류'}`);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">
              적합도 판정 방식
            </label>
            <div className="flex flex-wrap gap-2">
              {JUDGE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setJudge(o.value)}
                  title={o.hint}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    judge === o.value
                      ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-950/40 dark:text-brand-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={onRun} disabled={busy !== null || goldenCount === 0}>
            {busy === 'run' ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-4 w-4" />
            )}
            평가 실행
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <span className="text-xs text-slate-500">골든셋 채우기:</span>
          <Button
            onClick={onSeed}
            disabled={busy !== null}
            variant="outline"
            size="sm"
          >
            {busy === 'seed' ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Database className="mr-1.5 h-4 w-4" />
            )}
            FAQ에서 시드
          </Button>
          <Button
            onClick={onGenerate}
            disabled={busy !== null}
            variant="outline"
            size="sm"
          >
            {busy === 'gen' ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-4 w-4" />
            )}
            AI 질의 생성 (아티클 20개)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
