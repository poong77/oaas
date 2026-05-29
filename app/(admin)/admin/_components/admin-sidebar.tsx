'use client';

/**
 * AdminSidebar — 데스크탑(lg+) 좌측 사이드바.
 *
 * 구조 (top → bottom):
 *   1. 토글 버튼 (상단) — 접기/펼치기
 *   2. 역할 뱃지 (Shield + 어드민/매니저)
 *   3. 그룹 + 메뉴 (NAV_ITEMS, AdminNavItem 매핑)
 *   4. footer: AdminUserMenu
 *
 * 너비: 펼침 120px / 접힘 28px (사용자 요청 — 기존 240/56 절반).
 *
 * sticky top-0 + h-screen:
 *   - 본문 스크롤과 독립적으로 항상 보임
 *   - grid 자식 자격 유지 (fixed 아님)
 *
 * @see docs/02-design/features/admin-sidebar-layout.design.md §3.2
 */

import Link from 'next/link';
import { ExternalLink, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
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
      {/* 1. 토글 버튼 (상단) */}
      <div className="shrink-0 border-b border-slate-100 dark:border-slate-800">
        <AdminSidebarToggle collapsed={collapsed} />
      </div>

      {/* 2. 역할 뱃지 */}
      <div
        className={cn(
          'flex shrink-0 items-center border-b border-slate-100 dark:border-slate-800',
          collapsed ? 'h-10 justify-center px-1' : 'h-10 px-2.5',
        )}
      >
        <Shield
          className="h-4 w-4 shrink-0 text-brand-700 dark:text-brand-300"
          aria-hidden
        />
        {!collapsed && (
          <span className="ml-1.5 truncate text-xs font-semibold text-brand-700 dark:text-brand-300">
            {userRole === 'admin' ? '어드민' : '매니저'}
          </span>
        )}
      </div>

      {/* 2-b. 프론트(호텔리어 영역) 바로가기 */}
      <div className="shrink-0 border-b border-slate-100 px-1 py-1 dark:border-slate-800">
        <Link
          href="/"
          target="_blank"
          rel="noopener"
          title="support.oapms.com 바로가기"
          className={cn(
            'group flex items-center rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
            collapsed ? 'h-8 w-full justify-center' : 'h-8 px-2',
          )}
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {!collapsed && <span className="ml-1.5 truncate">바로가기</span>}
        </Link>
      </div>

      {/* 3. 그룹 + 메뉴 */}
      <nav className="flex-1 overflow-y-auto py-2">
        {/* TODO[sidebar-away-toggle]: 자리비움 토글, 메뉴 위 또는 footer 상단 */}
        {GROUP_ORDER.map((group, gi) => {
          const items = NAV_ITEMS.filter((i) => i.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className={cn(gi > 0 && 'mt-3')}>
              {!collapsed && (
                <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {GROUP_LABEL[group]}
                </div>
              )}
              <ul className="flex flex-col gap-0.5 px-1">
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

      {/* 4. footer: 사용자 메뉴 */}
      <div className="shrink-0 border-t border-slate-100 dark:border-slate-800">
        {/* TODO[sidebar-daily-kpi]: 오늘 처리한 티켓 카운터 (footer 영역) */}
        <AdminUserMenu placement={collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'} />
      </div>
    </aside>
  );
}
