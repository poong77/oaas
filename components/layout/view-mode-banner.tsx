'use client';

/**
 * ViewModeBanner — 호텔리어 시점 보기 모드 진입 시 영구 노출 배너.
 *
 * - 매니저/어드민이 viewMode=hotelier 쿠키를 켠 상태에서만 RoleScope가 렌더.
 * - 우측 "돌아가기" 버튼 클릭 시 쿠키 삭제 + router.refresh().
 * - 색상은 amber 계열 — brand-* 와 다른 톤으로 "임시 상태" 명시.
 *
 * @see components/layout/role-scope.tsx (마운팅)
 * @see lib/hooks/use-view-mode.ts (clearViewMode)
 */

import { Eye, X } from 'lucide-react';
import { useViewMode } from '@/lib/hooks/use-view-mode';
import type { UserRole } from '@/db/schema';

export function ViewModeBanner({ userRole }: { userRole: UserRole }) {
  const { clearViewMode } = useViewMode();

  const roleLabel = userRole === 'admin' ? '어드민' : '매니저';

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 w-full border-b border-amber-300 bg-amber-100 text-amber-900 shadow-sm dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-200"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-2 text-sm sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-medium">
            호텔리어 시점으로 보고 있습니다 ({roleLabel} 계정)
          </span>
        </div>
        <button
          type="button"
          onClick={clearViewMode}
          className="inline-flex items-center gap-1 rounded-md bg-amber-200 px-2.5 py-1 text-xs font-medium hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 dark:bg-amber-900 dark:hover:bg-amber-800"
          aria-label={`${roleLabel} 모드로 돌아가기`}
        >
          <X className="h-3 w-3" aria-hidden />
          {roleLabel} 모드로 돌아가기
        </button>
      </div>
    </div>
  );
}
