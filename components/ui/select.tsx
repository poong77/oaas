import * as React from 'react';
import { cn } from '@/lib/utils';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-9 w-full appearance-none rounded-md border border-slate-200 bg-white py-1 pl-3 pr-8 text-sm shadow-sm',
        'bg-[length:16px_16px] bg-[right_0.5rem_center] bg-no-repeat',
        // data URI의 공백은 %20으로 인코딩 — 미인코딩 공백은 className 토큰을 끊어 chevron이 사라짐
        "bg-[url(\"data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2020%2020'%20fill='none'%20stroke='%2364748b'%20stroke-width='1.5'%3E%3Cpath%20d='M6%208l4%204%204-4'/%3E%3C/svg%3E\")]",
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50',
        "dark:bg-[url(\"data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2020%2020'%20fill='none'%20stroke='%2394a3b8'%20stroke-width='1.5'%3E%3Cpath%20d='M6%208l4%204%204-4'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
