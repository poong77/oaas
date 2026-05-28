'use client';

/**
 * ViewModeToggle — 어드민/매니저용 호텔리어 시점 보기 토글.
 *
 * - 아바타 드롭다운(AdminUserMenu) 내부 메뉴 아이템으로 사용.
 * - 현재 시점 보기 ON이면 "돌아가기", OFF면 "호텔리어 시점으로 보기" 표시.
 * - 호텔리어 본인은 본 컴포넌트를 노출하지 않는다 (시점 보기 개념 없음).
 *
 * @see lib/hooks/use-view-mode.ts
 * @see app/(admin)/admin/_components/admin-user-menu.tsx (사용처)
 */

import { Eye, EyeOff } from 'lucide-react';
import { useViewMode } from '@/lib/hooks/use-view-mode';
import type { UserRole } from '@/db/schema';
import { cn } from '@/lib/utils';

export function ViewModeToggle({
  currentRole,
  onAfterToggle,
  className,
}: {
  currentRole: UserRole;
  onAfterToggle?: () => void;
  className?: string;
}) {
  const { isViewMode, setHotelierView, clearViewMode } = useViewMode();

  if (currentRole === 'hotelier') return null;

  const handleClick = () => {
    if (isViewMode) {
      clearViewMode();
    } else {
      setHotelierView();
    }
    onAfterToggle?.();
  };

  const roleLabel = currentRole === 'admin' ? '어드민' : '매니저';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800',
        className,
      )}
    >
      {isViewMode ? (
        <>
          <EyeOff className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
          <span className="flex-1">{roleLabel} 모드로 돌아가기</span>
        </>
      ) : (
        <>
          <Eye className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
          <span className="flex-1">호텔리어 시점으로 보기</span>
        </>
      )}
    </button>
  );
}
