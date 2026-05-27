'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Menu, X, LifeBuoy } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { cn } from '@/lib/utils';

/**
 * GNB — LP-02 기준 자리잡기.
 * 실제 라우팅·검색·로그인은 Phase 1 이후 연결.
 */
const NAV_ITEMS = [
  { label: '홈', href: '/' },
  { label: '빠른 해결', href: '/faq' },
  { label: '제품별 가이드', href: '/help' },
  { label: '서비스 상태', href: '/status' },
  { label: '문의 접수', href: '/tickets/new' },
  { label: '공지/업데이트', href: '/notices' },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-semibold tracking-tight"
          >
            <LifeBuoy className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <span>OA 통합 AS</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ConfirmDemoButton />
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 sm:inline-flex"
          >
            로그인
          </Link>
          <Link
            href="/tickets"
            className="hidden rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500 sm:inline-flex"
          >
            내 문의
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-md p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
            aria-label="메뉴 열기"
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
        <nav className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 flex gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <Link
              href="/login"
              className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-center text-sm font-medium dark:border-slate-700"
            >
              로그인
            </Link>
            <Link
              href="/tickets"
              className="flex-1 rounded-md bg-brand-600 px-3 py-2 text-center text-sm font-medium text-white"
            >
              내 문의
            </Link>
          </div>
        </nav>
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

function ConfirmDemoButton() {
  const confirm = useConfirmDialog();
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await confirm({
          title: 'ConfirmDialog 데모',
          description:
            'window.confirm() 대체 글로벌 다이얼로그입니다. 이대로 진행할까요?',
          confirmText: '진행',
          cancelText: '취소',
        });
        if (ok) {
          toast.success('확인됨 — Toaster + ConfirmDialog 모두 정상 동작합니다.');
        } else {
          toast.info('취소되었습니다.');
        }
      }}
      className="hidden rounded-md border border-dashed border-brand-400 px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-300 dark:hover:bg-brand-950/50 lg:inline-flex"
    >
      데모: ConfirmDialog
    </button>
  );
}
