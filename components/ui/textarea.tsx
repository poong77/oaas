import * as React from 'react';
import { cn } from '@/lib/utils';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm',
      'placeholder:text-slate-400',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-500',
      'min-h-[80px]',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
