import { cn } from '@/lib/utils';

/**
 * 로딩 자리표시용 펄스 블록.
 *
 * 사용처: loading.tsx, Suspense fallback. 실제 콘텐츠와 같은 크기/모서리를 맞춰
 * 레이아웃 이동(CLS) 없이 "곧 채워질 영역"을 보여준다.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-800/70',
        className,
      )}
      {...props}
    />
  );
}
