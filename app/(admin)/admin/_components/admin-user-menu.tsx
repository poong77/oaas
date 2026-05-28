'use client';

/**
 * AdminUserMenu — 어드민/매니저 영역 우측 아바타 드롭다운.
 *
 * 통합:
 *   - 사용자 정보 (이름, 이메일, 역할 배지)
 *   - 내 프로필 → /profile (AdminNav에서 분리되어 옮겨옴)
 *   - 호텔리어 시점으로 보기 토글 (ViewModeToggle)
 *   - 로그아웃 (ConfirmDialog 사용)
 *
 * 단순 useState + onClickOutside 패턴 (shadcn DropdownMenu 도입은 별도 PR).
 *
 * @see docs/02-design/features/role-mode-ui.design.md §3.4
 */

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { LogOut, Shield, User, ChevronDown } from 'lucide-react';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { ViewModeToggle } from '@/components/layout/view-mode-toggle';
import { cn } from '@/lib/utils';

export function AdminUserMenu() {
  const { user } = useCurrentUser();
  const confirm = useConfirmDialog();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // onClickOutside
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

  if (!user) return null;

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <User className="h-3.5 w-3.5" aria-hidden />
        <span className="max-w-[8rem] truncate">{displayName}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {/* 사용자 정보 */}
          <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <Shield className="h-3 w-3" aria-hidden />
                {roleLabel}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {user.email}
              </span>
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
              {displayName}
            </div>
          </div>

          {/* 메뉴 항목 */}
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            role="menuitem"
          >
            <User className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
            <span className="flex-1">내 프로필</span>
          </Link>

          <ViewModeToggle currentRole={user.role} onAfterToggle={() => setOpen(false)} />

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
