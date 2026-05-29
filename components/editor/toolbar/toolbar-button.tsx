'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ToolbarButtonProps {
  onClick: () => void;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

export function ToolbarButton({
  onClick,
  label,
  shortcut,
  active = false,
  disabled = false,
  children,
}: ToolbarButtonProps) {
  const title = shortcut ? `${label} (${shortcut})` : label;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      aria-pressed={active}
      title={title}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors',
        'hover:bg-brand-100 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-brand-900/30 dark:hover:text-brand-300',
        active &&
          'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
      )}
    >
      {children}
    </button>
  );
}

export function ToolbarDivider() {
  return (
    <span
      aria-hidden
      className="mx-0.5 h-5 w-px self-center bg-slate-200 dark:bg-slate-700"
    />
  );
}
