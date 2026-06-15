import * as React from 'react';
import { cn } from '@/lib/utils';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

// chevron(아래 화살표)은 inline style의 background-image로 그린다.
// Tailwind v4의 arbitrary background-url 클래스는 따옴표/공백 때문에 CSS 파싱이 깨지고,
// 또 콘텐츠 스캐너가 주석 속 패턴까지 클래스로 추출하므로 여기선 사용하지 않는다.
// 위치·크기·반복은 Tailwind 유틸이 담당. 색은 라이트/다크 공용으로 slate-400(#94a3b8).
const CHEVRON_BG =
  "url(\"data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2020%2020'%20fill='none'%20stroke='%2394a3b8'%20stroke-width='1.5'%3E%3Cpath%20d='M6%208l4%204%204-4'/%3E%3C/svg%3E\")";

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, style, ...props }, ref) => (
    <select
      ref={ref}
      // chevron 위치·크기·반복까지 모두 inline style로 지정.
      // (Tailwind v4는 타입힌트 없는 bg-[right_0.5rem_center]를 background-position으로
      //  인식하지 못해 화살표가 좌상단(0% 0%)에 찍히는 문제가 있음)
      style={{
        backgroundImage: CHEVRON_BG,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.5rem center',
        backgroundSize: '16px 16px',
        ...style,
      }}
      className={cn(
        'flex h-9 w-full appearance-none rounded-md border border-slate-200 bg-white py-1 pl-3 pr-8 text-sm shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
