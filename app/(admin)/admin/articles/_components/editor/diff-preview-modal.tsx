'use client';

/**
 * DiffPreviewModal — A6 재편집 결과 사이드-바이-사이드 diff (Phase 4).
 *
 * 표시:
 *   - 상단: AI 변경 요약(summaryOfChanges)
 *   - 본문: 섹션별 카드. 좌(기존) / 우(AI 제안) 색상 라인 diff
 *   - 섹션별 체크박스 (default: changed=true이면 체크)
 *   - 액션: [전부 적용 N개] [선택만 적용 K개] [거부]
 *
 * 적용 흐름:
 *   - 사용자가 체크박스로 적용할 섹션 선택
 *   - [선택만 적용] 클릭 → applySelectedSections로 부분 병합 → 부모 onApply(merged)
 *   - [전부 적용] → 모든 changed 섹션 적용
 *   - [거부] → 그냥 닫기
 *
 * 모달:
 *   - Radix Dialog (shadcn/ui 패턴, sheet.tsx와 동일 라이브러리)
 *   - ESC 닫기, 백드롭 클릭은 명시적 [거부]만 허용 (실수 방지)
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §16-5
 */

import { useEffect, useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check, X, GitCompare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  applySelectedSections,
  diffMarkdownByH2,
  PREAMBLE_KEY,
  type DiffLine,
  type SectionDiff,
} from '@/lib/articles/markdown-diff';

function normalizeHeading(s: string): string {
  return s.trim().toLowerCase();
}

export interface DiffPreviewModalProps {
  open: boolean;
  onClose: () => void;
  /** 모드 표시용 (예: "tone (CS 톤 보정)"). */
  modeLabel: string;
  /** 사용된 모델 표시용 (예: "Sonnet 4.5"). */
  modelLabel?: string;
  /** 현재 본문 (사용자가 편집 중인 markdown). */
  beforeBody: string;
  /** AI 제안 본문. */
  afterBody: string;
  /** AI가 작성한 요약. */
  summaryOfChanges: string[];
  /** 사용자 적용 시 호출 — merged markdown 전달. */
  onApply: (mergedBody: string) => void;
}

export function DiffPreviewModal({
  open,
  onClose,
  modeLabel,
  modelLabel,
  beforeBody,
  afterBody,
  summaryOfChanges,
  onApply,
}: DiffPreviewModalProps) {
  const { sections, anyChanged } = useMemo(
    () => diffMarkdownByH2(beforeBody, afterBody),
    [beforeBody, afterBody],
  );

  // 적용할 섹션 (default: changed=true인 섹션 모두 체크)
  const [checked, setChecked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!open) return;
    const init = new Set<string>();
    for (const s of sections) {
      if (s.changed) init.add(normalizeHeading(s.heading));
    }
    setChecked(init);
  }, [open, sections]);

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleApplyAll() {
    const allChanged = sections
      .filter((s) => s.changed)
      .map((s) => normalizeHeading(s.heading));
    const merged = applySelectedSections(
      beforeBody,
      afterBody,
      new Set(allChanged),
    );
    onApply(merged);
    onClose();
  }

  function handleApplySelected() {
    const merged = applySelectedSections(beforeBody, afterBody, checked);
    onApply(merged);
    onClose();
  }

  const changedCount = sections.filter((s) => s.changed).length;
  const selectedCount = sections.filter(
    (s) => s.changed && checked.has(normalizeHeading(s.heading)),
  ).length;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[95vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-hidden rounded-lg border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          {/* 헤더 */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
            <div className="flex-1 min-w-0">
              <DialogPrimitive.Title className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                <GitCompare className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                재편집 미리보기 — {modeLabel}
                {modelLabel && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {modelLabel}
                  </span>
                )}
              </DialogPrimitive.Title>
              {summaryOfChanges.length > 0 && (
                <DialogPrimitive.Description asChild>
                  <ul className="mt-1.5 ml-4 list-disc text-xs text-slate-600 dark:text-slate-300">
                    {summaryOfChanges.slice(0, 5).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </DialogPrimitive.Description>
              )}
              {summaryOfChanges.length === 0 && (
                <DialogPrimitive.Description className="mt-1 text-xs text-slate-500">
                  변경된 섹션을 확인하고 적용/거부를 선택해주세요.
                </DialogPrimitive.Description>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 섹션 카드 리스트 */}
          <div className="flex-1 overflow-y-auto px-5 py-2">
            {!anyChanged && (
              <p className="my-8 text-center text-sm text-slate-500">
                AI가 제안한 변경 사항이 없어요. 본문 그대로 유지됩니다.
              </p>
            )}
            <div className="flex flex-col gap-3">
              {sections.map((sec, i) => {
                const key = normalizeHeading(sec.heading);
                const isChecked = checked.has(key);
                const displayHeading =
                  sec.heading === PREAMBLE_KEY
                    ? '(헤더 이전 영역)'
                    : sec.heading;
                return (
                  <SectionDiffCard
                    key={`${key}-${i}`}
                    sec={sec}
                    headingLabel={displayHeading}
                    checked={isChecked}
                    onToggle={() => toggle(key)}
                  />
                );
              })}
            </div>
          </div>

          {/* 액션 */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
            <span className="text-xs text-slate-500">
              변경 {changedCount}개 섹션 · 선택 {selectedCount}개
            </span>
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onClose}
              >
                <X className="h-3.5 w-3.5" />
                거부
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleApplySelected}
                disabled={selectedCount === 0}
              >
                <Check className="h-3.5 w-3.5" />
                선택만 적용 ({selectedCount})
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApplyAll}
                disabled={changedCount === 0}
              >
                <Check className="h-3.5 w-3.5" />
                전부 적용 ({changedCount})
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 섹션별 카드
// ─────────────────────────────────────────────────────────────────────────────

function SectionDiffCard({
  sec,
  headingLabel,
  checked,
  onToggle,
}: {
  sec: SectionDiff;
  headingLabel: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        'rounded-md border',
        sec.changed
          ? 'border-amber-300 bg-amber-50/30 dark:border-amber-700 dark:bg-amber-950/20'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
      )}
    >
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-1.5 dark:border-slate-700">
        <input
          type="checkbox"
          id={`sec-${headingLabel}`}
          checked={checked}
          onChange={onToggle}
          disabled={!sec.changed}
          className="h-3.5 w-3.5 accent-brand-500 disabled:opacity-30"
        />
        <label
          htmlFor={`sec-${headingLabel}`}
          className={cn(
            'flex-1 truncate text-xs',
            sec.changed
              ? 'font-semibold text-slate-900 dark:text-slate-100 cursor-pointer'
              : 'text-slate-500',
          )}
        >
          {headingLabel}
        </label>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium',
            sec.changed
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
          )}
        >
          {sec.changed ? '변경' : '동일'}
        </span>
      </div>
      {sec.changed && (
        <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
          {/* 좌: 기존 */}
          <div className="border-r border-slate-200 p-2 dark:border-slate-700">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              기존
            </div>
            <DiffLineList lines={sec.lineDiff} side="before" />
          </div>
          {/* 우: 제안 */}
          <div className="p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              AI 제안
            </div>
            <DiffLineList lines={sec.lineDiff} side="after" />
          </div>
        </div>
      )}
    </div>
  );
}

function DiffLineList({
  lines,
  side,
}: {
  lines: DiffLine[];
  side: 'before' | 'after';
}) {
  // before 측에서는 remove + equal만 표시, after 측에서는 add + equal만 표시
  const visible = lines.filter((l) => {
    if (side === 'before') return l.type === 'equal' || l.type === 'remove';
    return l.type === 'equal' || l.type === 'add';
  });
  if (visible.length === 0) {
    return (
      <p className="text-[11px] italic text-slate-400">(비어있음)</p>
    );
  }
  return (
    <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-snug">
      {visible.map((l, i) => (
        <div
          key={i}
          className={cn(
            'rounded px-1',
            l.type === 'add' && 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
            l.type === 'remove' && 'bg-rose-100 text-rose-900 line-through dark:bg-rose-950/40 dark:text-rose-200',
            l.type === 'equal' && 'text-slate-600 dark:text-slate-300',
          )}
        >
          {l.text || ' '}
        </div>
      ))}
    </pre>
  );
}
