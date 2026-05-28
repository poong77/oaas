'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Activity,
  Building2,
  FileText,
  HelpCircle,
  Inbox,
  ListChecks,
  LogOut,
  Megaphone,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/db/schema';

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
};

const ALL_TABS: Tab[] = [
  // 티켓 큐 (Phase 5) — 매니저+어드민, 최상단
  {
    href: '/admin/tickets',
    label: '티켓 큐',
    icon: Inbox,
    roles: ['manager', 'admin'],
  },
  // service-status는 매니저+어드민
  {
    href: '/admin/service-status',
    label: '서비스 상태',
    icon: Activity,
    roles: ['manager', 'admin'],
  },
  // articles는 매니저+어드민 (Phase 3)
  {
    href: '/admin/articles',
    label: '아티클',
    icon: FileText,
    roles: ['manager', 'admin'],
  },
  // notices는 매니저+어드민 (Phase 7)
  {
    href: '/admin/notices',
    label: '공지 관리',
    icon: Megaphone,
    roles: ['manager', 'admin'],
  },
  // FAQ는 매니저+어드민 (Phase 4)
  {
    href: '/admin/faqs',
    label: 'FAQ',
    icon: HelpCircle,
    roles: ['manager', 'admin'],
  },
  // 체크리스트는 매니저+어드민 (Phase 4)
  {
    href: '/admin/checklists',
    label: '체크리스트',
    icon: ListChecks,
    roles: ['manager', 'admin'],
  },
  // users / hotels는 어드민만
  { href: '/admin/users', label: '사용자', icon: Users, roles: ['admin'] },
  { href: '/admin/hotels', label: '호텔', icon: Building2, roles: ['admin'] },
];

export function AdminNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const confirm = useConfirmDialog();

  const tabs = ALL_TABS.filter((t) => t.roles.includes(role));

  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-1">
        <div className="mr-2 flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
          <Shield className="h-3.5 w-3.5" />
          {role === 'admin' ? '어드민' : '매니저'}
        </div>
        {tabs.map((t) => {
          const active =
            pathname === t.href || pathname.startsWith(t.href + '/');
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
              <Icon className="h-3.5 w-3.5" />
              {t.label}
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
