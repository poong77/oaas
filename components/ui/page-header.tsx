import * as React from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  guideAnchor,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  /**
   * 지정 시 타이틀 우측에 테마컬러 도트를 렌더. 클릭하면 업무 가이드의
   * 해당 섹션(`/admin/help/guide#{anchor}`)을 새 탭으로 연다.
   */
  guideAnchor?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {breadcrumb && (
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {breadcrumb}
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              {title}
            </h1>
            {guideAnchor && (
              <a
                href={`/admin/help/guide#${guideAnchor}`}
                target="_blank"
                rel="noopener"
                title="이 메뉴 사용 가이드 보기 (새 탭)"
                aria-label="이 메뉴 사용 가이드 보기"
                className="group inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-brand-100 dark:hover:bg-brand-900/40"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-brand-700 transition-transform group-hover:scale-125 dark:bg-brand-300" />
              </a>
            )}
          </div>
          {description && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
