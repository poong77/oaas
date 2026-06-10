'use client';

/**
 * AdminMobileHeader — 모바일(<lg) 환경에서만 노출되는 상단 컴팩트 헤더.
 *
 * 구조: [햄버거] [서비스명 + 역할] [아바타]
 *
 * - 햄버거: Sheet 드로어 열기 → AdminSidebar의 NavItem 메뉴 재사용
 * - 아바타: AdminUserMenu (mobile-compact 모드, 아래쪽으로 popup)
 *
 * sticky top-0 z-40 — Sheet 자체는 z-50, 그 아래 위치.
 *
 * @see docs/02-design/features/admin-sidebar-layout.design.md §3.5
 */

import Link from 'next/link';
import { useState } from 'react';
import { ExternalLink, Menu, Shield } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, GROUP_ORDER, GROUP_LABEL } from '../_data/nav-items';
import { AdminGuideLink } from './admin-guide-link';
import { AdminHelpButton } from './admin-help-button';
import { AdminNavItem } from './admin-nav-item';
import { AdminUserMenu } from './admin-user-menu';

interface AdminMobileHeaderProps {
  userRole: 'manager' | 'admin';
  className?: string;
}

export function AdminMobileHeader({ userRole, className }: AdminMobileHeaderProps) {
  const [open, setOpen] = useState(false);
  const roleLabel = userRole === 'admin' ? '어드민' : '매니저';

  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950 lg:hidden',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="메뉴 열기"
              className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0">
            <div className="flex h-14 shrink-0 items-center border-b border-slate-100 px-4 dark:border-slate-800">
              <Shield
                className="h-4 w-4 text-brand-700 dark:text-brand-300"
                aria-hidden
              />
              <span className="ml-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
                {roleLabel}
              </span>
            </div>

            <div className="border-b border-slate-100 px-1.5 py-1.5 dark:border-slate-800">
              <Link
                href="/"
                target="_blank"
                rel="noopener"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                <span>바로가기</span>
              </Link>
            </div>

            <nav className="overflow-y-auto py-2">
              {GROUP_ORDER.map((group, gi) => {
                const items = NAV_ITEMS.filter((i) => i.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group} className={cn(gi > 0 && 'mt-3')}>
                    <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {GROUP_LABEL[group]}
                    </div>
                    <ul className="flex flex-col gap-0.5 px-1.5">
                      {items.map((item) => {
                        const locked = !item.roles.includes(userRole);
                        return (
                          <li key={item.href}>
                            <AdminNavItem
                              item={item}
                              locked={locked}
                              collapsed={false}
                              onNavigate={() => setOpen(false)}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>

        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          OA서포트
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          <Shield className="h-2.5 w-2.5" aria-hidden />
          {roleLabel}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <AdminGuideLink placement="mobile-compact" />
        <AdminHelpButton placement="mobile-compact" />
        <AdminUserMenu placement="mobile-compact" />
      </div>
    </header>
  );
}
