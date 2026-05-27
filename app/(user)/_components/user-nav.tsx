'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import type { UserRole } from '@/db/schema';

const TABS = [
  { href: '/profile', label: '내 프로필' },
  { href: '/profile/staff', label: '직원 관리' },
];

export function UserNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const confirm = useConfirmDialog();

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-1">
        {TABS.map((t) => {
          const active =
            pathname === t.href || pathname.startsWith(t.href + '/');
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              {t.label}
            </Link>
          );
        })}
        {(role === 'admin' || role === 'manager') && (
          <Link
            href={role === 'admin' ? '/admin/users' : '/admin/users'}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {role === 'admin' ? '어드민' : '매니저'} 영역으로 →
          </Link>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          const ok = await confirm({
            title: '로그아웃 하시겠습니까?',
            confirmText: '로그아웃',
            cancelText: '취소',
            tone: 'danger',
          });
          if (ok) await signOut({ callbackUrl: '/' });
        }}
      >
        <LogOut className="h-4 w-4" />
        <span>로그아웃</span>
      </Button>
    </nav>
  );
}
