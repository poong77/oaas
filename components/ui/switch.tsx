'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type SwitchProps = {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** 접근성 라벨 (시각 라벨이 별도일 때) */
  'aria-label'?: string;
  className?: string;
};

/**
 * 심플 토글 스위치 (네이티브 button + role=switch).
 * ON: brand-600 / OFF: slate-300. 키보드(Space/Enter) 토글 지원.
 */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, disabled, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked
            ? 'bg-brand-600 dark:bg-brand-500'
            : 'bg-slate-300 dark:bg-slate-700',
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    );
  },
);
Switch.displayName = 'Switch';
