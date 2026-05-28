'use client';

/**
 * AdminSidebar — 데스크탑(lg+) 좌측 사이드바.
 *
 * 구조 (top → bottom):
 *   1. 헤더: 역할 뱃지 (펼침에서만 라벨 노출)
 *   2. 그룹 + 메뉴 (NAV_ITEMS, AdminNavItem 매핑)
 *   3. 확장 슬롯 (P1 후속 Phase TODO 주석만)
 *   4. footer: 토글 + AdminUserMenu
 *
 * sticky top-0 + h-screen:
 *   - 본문 스크롤과 독립적으로 항상 보임
 *   - grid 자식 자격 유지 (fixed 아님)
 *
 * @see docs/02-design/features/admin-sidebar-layout.design.md §3.2
 */

import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/db/schema';
import { NAV_ITEMS, GROUP_ORDER, GROUP_LABEL } from '../_data/nav-items';
import { AdminNavItem } from './admin-nav-item';
import { AdminSidebarToggle } from './admin-sidebar-toggle';
import { AdminUserMenu } from './admin-user-menu';

interface AdminSidebarProps {
  collapsed: boolean;
  userRole: 'manager' | 'admin';
  className?: string;
}

export function AdminSidebar({ collapsed, userRole, className }: AdminSidebarProps) {
  return (
    <aside
      className={cn(
        'sticky top-0 z-30 flex h-screen flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950',
        className,
      )}
      aria-label="관리자 내비게이션"
    >
      {/* 1. 헤더: 역할 뱃지 */}
      <div className="flex h-14 shrink-0 items-center border-b border-slate-100 px-3 dark:border-slate-800">
        <Shield
          className="h-4 w-4 shrink-0 text-brand-700 dark:text-brand-300"
          aria-hidden
        />
        {!collapsed && (
          <span className="ml-2 truncate text-sm font-semibold text-brand-700 dark:text-brand-300">
            {userRole === 'admin' ? '어드민' : '매니저'}
          </span>
        )}
      </div>

      {/* 2. 그룹 + 메뉴 */}
      <nav className="flex-1 overflow-y-auto py-2">
        {/* TODO[sidebar-away-toggle]: 자리비움 토글, 메뉴 위 또는 footer 상단 */}
        {GROUP_ORDER.map((group, gi) => {
          const items = NAV_ITEMS.filter((i) => i.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className={cn(gi > 0 && 'mt-3')}>
              {!collapsed && (
                <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {GROUP_LABEL[group]}
                </div>
              )}
              <ul className="flex flex-col gap-0.5 px-1.5">
                {items.map((item) => {
                  const locked = !item.roles.includes(userRole);
                  return (
                    <li key={item.href}>
                      {/* TODO[sidebar-ticket-badge]: item.href === '/admin/tickets'일 때 우측 카운트 배지 슬롯 */}
                      <AdminNavItem item={item} locked={locked} collapsed={collapsed} />
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* 3. footer: 토글 + 사용자 메뉴 */}
      <div className="shrink-0 border-t border-slate-100 dark:border-slate-800">
        <AdminSidebarToggle collapsed={collapsed} />
        <div className="border-t border-slate-100 dark:border-slate-800">
          {/* TODO[sidebar-daily-kpi]: 오늘 처리한 티켓 카운터 (footer 영역) */}
          <AdminUserMenu placement={collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'} />
        </div>
      </div>
    </aside>
  );
}
