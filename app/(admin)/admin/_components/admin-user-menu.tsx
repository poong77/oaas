'use client';

/**
 * AdminUserMenu — 어드민/매니저 아바타 드롭다운.
 *
 * 통합:
 *   - 사용자 정보 (이름, 이메일, 역할 배지)
 *   - 내 프로필 → /profile
 *   - 로그아웃 (ConfirmDialog 사용)
 *
 * 3가지 배치 모드 (placement prop):
 *   - 'sidebar-expanded': 사이드바 footer 펼침. 트리거: 아바타 + 이름 + ▼. popup: 위쪽으로 펼침
 *   - 'sidebar-collapsed': 사이드바 footer 접힘. 트리거: 아바타만. popup: 오른쪽으로 펼침
 *   - 'mobile-compact': 모바일 헤더 우측. 트리거: 작은 아바타. popup: 아래쪽으로 펼침
 *
 * @see docs/02-design/features/admin-sidebar-layout.design.md §3.6
 */

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { LogOut, Shield, User, ChevronDown } from 'lucide-react';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { cn } from '@/lib/utils';

export type AdminUserMenuPlacement =
  | 'sidebar-expanded'
  | 'sidebar-collapsed'
  | 'mobile-compact';

interface AdminUserMenuProps {
  /** 기본값: 'sidebar-expanded' (기존 동작과 가장 유사) */
  placement?: AdminUserMenuPlacement;
}

export function AdminUserMenu({
  placement = 'sidebar-expanded',
}: AdminUserMenuProps) {
  const { user } = useCurrentUser();
  const confirm = useConfirmDialog();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // onClickOutside + Escape
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user || user.role === 'hotelier') return null;

  const roleLabel = user.role === 'admin' ? '어드민' : '매니저';
  const displayName = user.name ?? user.email ?? '계정';

  async function handleLogout() {
    setOpen(false);
    const ok = await confirm({
      title: '로그아웃 하시겠습니까?',
      confirmText: '로그아웃',
      tone: 'danger',
    });
    if (ok) await signOut({ callbackUrl: '/' });
  }

  const triggerCompact = placement !== 'sidebar-expanded';

  // placement별 popup 위치 클래스
  const popupPositionClass = cn(
    'absolute z-50 w-64 rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900',
    placement === 'sidebar-expanded' && 'bottom-full left-2 mb-2 origin-bottom-left',
    placement === 'sidebar-collapsed' && 'bottom-0 left-full ml-2 origin-bottom-left',
    placement === 'mobile-compact' && 'right-0 top-full mt-2 origin-top-right',
  );

  // 트리거 버튼
  const Trigger = triggerCompact ? (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label="계정 메뉴"
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-brand-100 text-brand-700 transition-colors hover:bg-brand-200 dark:bg-brand-900/40 dark:text-brand-300 dark:hover:bg-brand-900/60',
        placement === 'mobile-compact' ? 'h-8 w-8' : 'mx-auto my-1.5 h-6 w-6',
      )}
    >
      <User
        className={cn(
          placement === 'mobile-compact' ? 'h-4 w-4' : 'h-3 w-3',
        )}
        aria-hidden
      />
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-haspopup="menu"
      aria-expanded={open}
      className="flex w-full items-center gap-1.5 px-2 py-2 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
        <User className="h-3 w-3" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-left font-medium">{displayName}</span>
      <ChevronDown
        className={cn('h-3 w-3 shrink-0 transition-transform', open && 'rotate-180')}
        aria-hidden
      />
    </button>
  );

  return (
    <div ref={rootRef} className="relative">
      {Trigger}

      {open && (
        <div role="menu" className={popupPositionClass}>
          {/* 사용자 정보 */}
          <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <Shield className="h-3 w-3" aria-hidden />
                {roleLabel}
              </span>
              <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                {user.email}
              </span>
            </div>
            <div className="mt-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {displayName}
            </div>
          </div>

          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            role="menuitem"
          >
            <User className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
            <span className="flex-1">내 프로필</span>
          </Link>

          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            role="menuitem"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            <span className="flex-1">로그아웃</span>
          </button>
        </div>
      )}
    </div>
  );
}
