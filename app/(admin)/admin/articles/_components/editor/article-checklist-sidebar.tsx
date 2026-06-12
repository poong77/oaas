'use client';

/**
 * ArticleChecklistSidebar — 발행 가드 + 실시간 H2 진척률 (A1, A8 표시바 포함).
 *
 * 표시:
 *   - 진척률 막대 (필수 H2 hasContent / total)
 *   - 항목별 ✓ / ⏳ / ⚠
 *   - errors + warnings (body-validator)
 *   - 자동저장 상태바 (A8)
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §1-1
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Save,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { BodyOutline, ValidationResult } from '@/lib/articles/body-validator';
import {
  formatRelative,
  type AutosaveStatus,
} from '@/lib/editor/use-autosave-status';

export interface ArticleChecklistSidebarProps {
  outline: BodyOutline;
  validation: ValidationResult;
  metaChecks: MetaCheck[];
  autosave?: {
    status: AutosaveStatus;
    lastSavedAt: Date | null;
    enabled: boolean;
    onToggle: () => void;
  };
}

export type MetaCheck = {
  /** 라벨 (예: "제품 선택", "메뉴 경로") */
  label: string;
  /** 완료 여부 */
  done: boolean;
  /** 경고 (선택) */
  warn?: string;
};

export function ArticleChecklistSidebar({
  outline,
  validation,
  metaChecks,
  autosave,
}: ArticleChecklistSidebarProps) {
  const totalRequired = outline.totalRequired + metaChecks.length;
  const completed =
    outline.completedRequired + metaChecks.filter((m) => m.done).length;
  const percent =
    totalRequired === 0 ? 0 : Math.round((completed / totalRequired) * 100);
  const allPass = completed === totalRequired && validation.errors.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              발행 준비
            </span>
            <span
              className={`text-sm font-semibold tabular-nums ${
                allPass
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-brand-600 dark:text-brand-300'
              }`}
            >
              {percent}%
            </span>
          </div>
          <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                allPass ? 'bg-emerald-500' : 'bg-brand-500'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* 메타 체크리스트 */}
          <ul className="flex flex-col gap-1.5">
            {metaChecks.map((m) => (
              <li
                key={m.label}
                className="flex items-start gap-1.5 text-xs"
              >
                {m.done ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" />
                )}
                <span
                  className={
                    m.done
                      ? 'text-slate-500 dark:text-slate-400'
                      : 'text-slate-700 dark:text-slate-200'
                  }
                >
                  {m.label}
                </span>
                {m.warn && (
                  <span className="ml-auto text-[10px] text-amber-600 dark:text-amber-400">
                    {m.warn}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {/* H2 진척률 */}
          {outline.items.length > 0 && (
            <>
              <div className="my-3 border-t border-slate-100 dark:border-slate-800" />
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                본문 H2
              </span>
              <ul className="flex flex-col gap-1">
                {outline.items.map((item) => (
                  <li
                    key={item.text}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    {item.hasContent ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    ) : item.present ? (
                      <span
                        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-amber-500"
                        title="섹션은 있지만 내용 미작성"
                      >
                        ⏳
                      </span>
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" />
                    )}
                    <span
                      className={
                        item.hasContent
                          ? 'text-slate-500 dark:text-slate-400'
                          : 'text-slate-700 dark:text-slate-200'
                      }
                    >
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      {/* errors + warnings */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <Card
          className={
            validation.errors.length > 0
              ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
              : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'
          }
        >
          <CardContent className="p-4">
            <div className="mb-1 flex items-center gap-1.5">
              <AlertTriangle
                className={`h-3.5 w-3.5 ${
                  validation.errors.length > 0
                    ? 'text-red-600 dark:text-red-300'
                    : 'text-amber-600 dark:text-amber-300'
                }`}
              />
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {validation.errors.length > 0
                  ? `발행 차단 ${validation.errors.length}건`
                  : `워닝 ${validation.warnings.length}건`}
              </span>
            </div>
            {validation.errors.length > 0 && (
              <ul className="ml-5 list-disc text-xs text-red-700 dark:text-red-300">
                {validation.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            {validation.warnings.length > 0 && (
              <ul className="ml-5 list-disc text-xs text-amber-700 dark:text-amber-300">
                {validation.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* 자동저장 표시바 (A8) */}
      {autosave && <AutosaveStatusBar {...autosave} />}
    </div>
  );
}

function AutosaveStatusBar({
  status,
  lastSavedAt,
  enabled,
  onToggle,
}: {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  enabled: boolean;
  onToggle: () => void;
}) {
  const [, tick] = useState(0);
  // 1초마다 relative time 갱신
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  let label = '';
  let dot = 'bg-slate-300';
  switch (status) {
    case 'saved':
      label = formatRelative(lastSavedAt);
      dot = 'bg-emerald-500';
      break;
    case 'saving':
      label = '저장 중...';
      dot = 'bg-brand-500 animate-pulse';
      break;
    case 'dirty':
      label = '변경됨, 저장 대기 중';
      dot = 'bg-amber-500';
      break;
    case 'error':
      label = '저장 실패';
      dot = 'bg-rose-500';
      break;
    case 'off':
      label = '자동저장 OFF';
      dot = 'bg-slate-400';
      break;
    case 'idle':
    default:
      label = lastSavedAt ? formatRelative(lastSavedAt) : '아직 저장되지 않음';
      dot = 'bg-slate-300';
      break;
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <Save className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
          <span className="text-slate-600 dark:text-slate-300">{label}</span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={enabled}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition ${
            enabled
              ? 'border-brand-500 bg-brand-500'
              : 'border-slate-300 bg-slate-200 dark:border-slate-700 dark:bg-slate-700'
          }`}
        >
          <span
            className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all ${
              enabled ? 'left-[18px]' : 'left-0.5'
            }`}
          />
        </button>
      </CardContent>
    </Card>
  );
}
