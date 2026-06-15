'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  Moon,
  Sun,
  Menu,
  X,
  LogOut,
  User,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { cn } from '@/lib/utils';
import { BusinessStatusBadge } from '@/components/contact/business-status-badge';

/**
 * GNB — LP-02.
 *
 * - 세션 표시 (로그인/프로필 드롭다운)
 * - 프로필 버튼 클릭 시 드롭다운(마이페이지·내문의·로그아웃)으로 진입. 별도 로그아웃 버튼 없음.
 * - 모바일 햄버거 메뉴 (마이페이지·내문의·로그아웃)
 * - 다크모드 토글은 프로필 우측 배치.
 * - 검색 인풋은 홈 hero 검색으로 일원화되어 GNB에서 제거됨.
 */
export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, status } = useCurrentUser();
  const confirm = useConfirmDialog();

  async function handleLogout() {
    const ok = await confirm({
      title: '로그아웃 하시겠습니까?',
      confirmText: '로그아웃',
      tone: 'danger',
    });
    if (ok) await signOut({ callbackUrl: '/' });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <Link
            href="/"
            aria-label="OAtech Support 홈으로"
            className="flex items-center gap-1.5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/oasupport-logo.svg"
              alt="OAtech Support"
              className="h-5 w-auto dark:brightness-110"
            />
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:block">
            <BusinessStatusBadge size="sm" linkTo="#contact" />
          </div>
          {status === 'authenticated' && user ? (
            <ProfileMenu
              name={user.name ?? '내 프로필'}
              onLogout={handleLogout}
            />
          ) : (
            <Link
              href="/login"
              className="hidden rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500 sm:inline-flex"
            >
              로그인
            </Link>
          )}
          {/* 다크모드 전환 — 프로필 우측 배치 */}
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-md p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
            aria-label="메뉴 열기"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* 모바일 메뉴 */}
      <div
        className={cn(
          'md:hidden',
          mobileOpen
            ? 'border-t border-slate-200 dark:border-slate-800'
            : 'hidden',
        )}
      >
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-2">
            {status === 'authenticated' && user ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-700"
                >
                  <User className="h-4 w-4 text-slate-400" />
                  마이페이지
                </Link>
                <Link
                  href="/tickets"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-700"
                >
                  <FileText className="h-4 w-4 text-slate-400" />
                  내문의
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium dark:bg-slate-800"
                >
                  <LogOut className="h-4 w-4 text-slate-400" />
                  로그아웃
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="rounded-md bg-brand-600 px-3 py-2 text-center text-sm font-medium text-white"
              >
                로그인
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * ProfileMenu — 프로필 버튼 + 드롭다운(마이페이지·내문의·로그아웃).
 * 데스크톱(sm+) 전용. 모바일은 햄버거 메뉴에서 동일 항목 제공.
 */
function ProfileMenu({
  name,
  onLogout,
}: {
  name: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <User className="h-3.5 w-3.5" />
        <span className="max-w-[8rem] truncate">{name}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-slate-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-44 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <User className="h-4 w-4 text-slate-400" />
            마이페이지
          </Link>
          <Link
            href="/tickets"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FileText className="h-4 w-4 text-slate-400" />
            내문의
          </Link>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4 text-slate-400" />
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-9 w-9" aria-hidden />;
  }

  const isDark = resolvedTheme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={`현재: ${theme === 'system' ? `system (${resolvedTheme})` : theme}`}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
