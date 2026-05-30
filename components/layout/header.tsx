'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Menu, X, LogOut, User } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { cn } from '@/lib/utils';
import { BusinessStatusBadge } from '@/components/contact/business-status-badge';

/**
 * GNB — LP-02.
 *
 * - 활성 메뉴 표시 (usePathname)
 * - 세션 표시 (로그인/로그아웃)
 * - 모바일 햄버거 메뉴
 * - 검색 인풋은 홈 hero 검색으로 일원화되어 GNB에서 제거됨.
 */
const NAV_ITEMS = [
  { label: '홈', href: '/' },
  { label: '빠른 해결', href: '/faq' },
  { label: '제품별 가이드', href: '/help' },
  { label: '문의 접수', href: '/tickets/new' },
  { label: '공지/업데이트', href: '/notices' },
];

function isActiveNav(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, status } = useCurrentUser();
  const confirm = useConfirmDialog();
  const pathname = usePathname();

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
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <Link
            href="/"
            aria-label="OAtech 홈으로"
            className="flex items-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/oatech-logo.png"
              alt="OAtech"
              className="h-5 w-auto dark:brightness-110"
            />
          </Link>
        </div>

        {/* 데스크탑 GNB */}
        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActiveNav(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors lg:px-3',
                  active
                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:block">
            <BusinessStatusBadge size="sm" linkTo="#contact" />
          </div>
          <ThemeToggle />
          {status === 'authenticated' && user ? (
            <>
              <Link
                href="/profile"
                className="hidden items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 sm:inline-flex"
              >
                <User className="h-3.5 w-3.5" />
                <span className="max-w-[8rem] truncate">
                  {user.name ?? '내 프로필'}
                </span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="hidden items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 sm:inline-flex"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">로그아웃</span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500 sm:inline-flex"
            >
              로그인
            </Link>
          )}
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
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActiveNav(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium',
                    active
                      ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            {status === 'authenticated' && user ? (
              <>
                <div className="flex gap-2">
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-center text-sm font-medium dark:border-slate-700"
                  >
                    내 프로필
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      handleLogout();
                    }}
                    className="flex-1 rounded-md bg-slate-100 px-3 py-2 text-center text-sm font-medium dark:bg-slate-800"
                  >
                    로그아웃
                  </button>
                </div>
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
