'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Building2, LogOut, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/admin/users', label: '사용자', icon: Users },
  { href: '/admin/hotels', label: '호텔', icon: Building2 },
];

export function AdminNav() {
  const pathname = usePathname();
  const confirm = useConfirmDialog();

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-1">
        <div className="mr-2 flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
          <Shield className="h-3.5 w-3.5" />어드민
        </div>
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + '/');
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              <Icon className="h-3.5 w-3.5" />{t.label}
            </Link>
          );
        })}
        <Link
          href="/profile"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          내 프로필 →
        </Link>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          const ok = await confirm({
            title: '로그아웃 하시겠습니까?',
            confirmText: '로그아웃',
            tone: 'danger',
          });
          if (ok) await signOut({ callbackUrl: '/' });
        }}
      >
        <LogOut className="h-4 w-4" />로그아웃
      </Button>
    </nav>
  );
}
