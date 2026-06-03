'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type CheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  /** true 시 부분 선택(―) 표시. select-all 헤더용. */
  indeterminate?: boolean;
};

/**
 * 네이티브 체크박스 기반. indeterminate(부분 선택) 상태 지원.
 * accent-brand-600 으로 브랜드 컬러 적용 (forms 플러그인 불필요).
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, indeterminate, ...props }, ref) => {
    const innerRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);
    React.useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = !!indeterminate;
    }, [indeterminate]);

    return (
      <input
        ref={innerRef}
        type="checkbox"
        className={cn(
          'h-4 w-4 flex-shrink-0 cursor-pointer rounded border-slate-300 accent-brand-600',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'dark:border-slate-600',
          className,
        )}
        {...props}
      />
    );
  },
);
Checkbox.displayName = 'Checkbox';
