/**
 * ChoiceCard / ToggleCard / FieldLabel — 버튼형 선택 UI 공용 컴포넌트.
 *
 * 드롭다운(select) 대신 클릭형 카드로 선택하는 폼 UX의 디자인 토큰을 한 곳에 모음.
 * 이슈 접수 폼(ticket-create-form)의 선택 카드와 동일한 시각 언어를 공유한다.
 *
 *   - ChoiceCard : 단일/다중 선택 1칸 (라벨 중앙 정렬, tone 3종)
 *   - ToggleCard : on/off 토글 (제목 + 설명 + 체크 인디케이터, 좌측 정렬)
 *   - FieldLabel : 필드 제목 + 필수(*) + 우측 에러 메시지
 */

'use client';

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ChoiceTone = 'brand' | 'warn' | 'danger';

const SELECTED_TONE: Record<ChoiceTone, string> = {
  brand:
    'border-brand-400 bg-brand-50 text-brand-700 ring-2 ring-brand-300 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-700',
  warn: 'border-amber-300 bg-amber-50 text-amber-800 ring-2 ring-amber-300 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-700',
  danger:
    'border-red-300 bg-red-50 text-red-700 ring-2 ring-red-300 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-700',
};

const UNSELECTED =
  'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-700 dark:hover:bg-brand-950/20';

export function FieldLabel({
  title,
  required,
  error,
  hint,
}: {
  title: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {title}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {error ? (
        <span className="text-xs text-red-500">{error}</span>
      ) : hint ? (
        <span className="text-xs text-slate-400 dark:text-slate-500">{hint}</span>
      ) : null}
    </div>
  );
}

export function ChoiceCard({
  label,
  selected,
  onClick,
  tone = 'brand',
  icon,
  disabled,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  tone?: ChoiceTone;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        selected ? SELECTED_TONE[tone] : UNSELECTED,
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function ToggleCard({
  active,
  onClick,
  title,
  description,
  icon,
  tone = 'brand',
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
  icon?: ReactNode;
  tone?: ChoiceTone;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-col gap-1 rounded-md border px-3 py-2.5 text-left transition-colors',
        active ? SELECTED_TONE[tone] : UNSELECTED,
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </span>
        <span
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
            active
              ? 'border-current bg-current/90 text-white dark:text-slate-900'
              : 'border-slate-300 dark:border-slate-600',
          )}
        >
          {active && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
      </span>
      <span
        className={cn(
          'text-xs leading-snug',
          active ? 'opacity-80' : 'text-slate-500 dark:text-slate-400',
        )}
      >
        {description}
      </span>
    </button>
  );
}
