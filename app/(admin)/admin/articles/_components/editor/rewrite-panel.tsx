'use client';

/**
 * RewritePanel — A6 재편집 4모드 트리거 (Phase 4).
 *
 * 흐름:
 *   - 매니저가 4모드 中 1 선택 (라디오)
 *   - custom 모드면 자유 명령 입력란 활성 (예: "더 짧게")
 *   - 트리거 클릭 → 부모(shell) onRequest(mode, command?) 호출 → aiRewriteArticleAction
 *   - 결과 본문은 부모가 DiffPreviewModal로 표시
 *
 * 비활성 조건:
 *   - 본문 최소 50자 (너무 짧으면 의미 없음)
 *   - 부모 loading 중
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §16
 */

import { useState } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  REWRITE_MODES,
  REWRITE_MODE_LABEL,
  REWRITE_MODE_DESCRIPTION,
  type RewriteMode,
} from '@/lib/ai/prompts/article-rewriter-types';

const CUSTOM_QUICK_PRESETS: ReadonlyArray<{ label: string; command: string }> = [
  { label: '더 짧게', command: '본문을 30% 줄여주세요. 핵심 정보는 유지.' },
  { label: '단계 자세히', command: '단계를 더 자세히 풀어서 설명해주세요. 화면 위치/버튼 이름 명시.' },
  { label: '용어 통일', command: '같은 의미 단어는 한 가지로 통일. 가장 표준적인 호텔 현장 용어 우선.' },
  { label: '초보 눈높이', command: '입사 첫 주 호텔리어가 이해할 수준으로 풀어쓰기.' },
  { label: '약어 풀어쓰기', command: '약어는 첫 등장 시 한 번 풀어쓰기 (예: "체크인(CI)").' },
] as const;

export interface RewritePanelProps {
  /** 본문 (활성 조건 판정 + UX 안내). */
  body: string;
  /** AI 호출 진행 중 (부모가 관리). */
  loading: boolean;
  /** 마지막 호출이 rate-limit이면 cooldown 안내용. */
  cooldownUntil?: number;
  /** 트리거 — 부모(shell)가 aiRewriteArticleAction 호출. */
  onRequest: (mode: RewriteMode, command?: string) => void;
}

export function RewritePanel({
  body,
  loading,
  cooldownUntil = 0,
  onRequest,
}: RewritePanelProps) {
  const [mode, setMode] = useState<RewriteMode>('tone');
  const [command, setCommand] = useState('');

  const onCooldown = Date.now() < cooldownUntil;
  // 본문 길이 카운트 시 골격 placeholder(`> ...`)와 H2/H3 헤딩은 제외 —
  // 신규 페이지의 자동 주입 골격만 있는 상태는 0자로 간주해야
  // 트리거가 의미 없이 활성화되지 않음 (KB-09 e2e).
  const meaningfulBodyLength = body
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith('>') && !trimmed.startsWith('#');
    })
    .join('\n')
    .trim().length;
  const bodyTooShort = meaningfulBodyLength < 50;
  const canCall = !loading && !onCooldown && !bodyTooShort;

  function handleSubmit() {
    if (!canCall) return;
    if (mode === 'custom' && command.trim().length === 0) return;
    onRequest(mode, mode === 'custom' ? command.trim() : undefined);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-1.5">
          <Wand2 className="h-4 w-4 text-brand-600 dark:text-brand-300" />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            AI 재편집
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            본문을 모드별로 다듬어요. 결과는 diff로 미리보기 후 적용.
          </span>
        </div>

        {/* 4모드 라디오 */}
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">재편집 모드</legend>
          {REWRITE_MODES.map((m) => {
            const selected = mode === m;
            return (
              <label
                key={m}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-md border px-3 py-2 transition ${
                  selected
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/30 dark:border-brand-400 dark:bg-brand-950/40'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="rewrite-mode"
                    value={m}
                    checked={selected}
                    onChange={() => setMode(m)}
                    className="h-3 w-3 accent-brand-500"
                  />
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {REWRITE_MODE_LABEL[m]}
                  </span>
                  {m === 'tone' && (
                    <span className="ml-auto rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Haiku
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {REWRITE_MODE_DESCRIPTION[m]}
                </span>
              </label>
            );
          })}
        </fieldset>

        {/* custom 모드 명령 입력 + 빠른 프리셋 */}
        {mode === 'custom' && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rewrite-command" className="text-xs">
              자유 명령 *
            </Label>
            <Input
              id="rewrite-command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="예: 더 짧게 (30% 줄이기)"
              maxLength={500}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canCall && command.trim().length > 0) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className="flex flex-wrap gap-1">
              {CUSTOM_QUICK_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setCommand(p.command)}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-700 dark:hover:bg-brand-950/30"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 액션 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {bodyTooShort
              ? '본문 50자 이상 입력 후 활성'
              : onCooldown
                ? '분당 한도 — 잠시 후 가능'
                : `호출 1회 — ${mode === 'tone' ? 'Haiku' : 'Sonnet'} 사용`}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!canCall || (mode === 'custom' && command.trim().length === 0)}
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                재편집 중...
              </>
            ) : (
              <>
                <Wand2 className="h-3.5 w-3.5" />
                재편집 미리보기
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
