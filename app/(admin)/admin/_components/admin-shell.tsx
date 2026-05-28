/**
 * AdminShell — 어드민/매니저 콘솔의 grid 컨테이너.
 *
 * 책임:
 *   1. 쿠키 read: sidebarCollapsed, viewMode
 *   2. viewMode 분기: staff일 때만 사이드바·모바일 헤더 마운트
 *   3. grid-template-columns 결정 (펼침 240px, 접힘 56px)
 *   4. max-w-7xl 컨테이너 흡수 (기존 layout.tsx 패턴 유지)
 *
 * RSC인 이유:
 *   - cookies()로 collapsed 상태를 read하여 SSR 첫 렌더에 반영
 *   - useState 없이 props drilling 1단계로 자식 컴포넌트에 전달
 *   - hydration mismatch 위험 0
 *
 * RoleScope와의 책임 경계:
 *   - RoleScope: viewMode/mode 계산 + 호텔리어 UI 토글 + ViewModeBanner
 *   - AdminShell: viewMode를 별도 read 후 사이드바 분기 + grid 형성
 *   (이중 read이지만 RSC chain이므로 비용 무시 가능)
 *
 * @see docs/02-design/features/admin-sidebar-layout.design.md §3.1
 */

import * as React from 'react';
import { cookies } from 'next/headers';
import { cn } from '@/lib/utils';
import { resolveCollapsed, SIDEBAR_COLLAPSED_COOKIE } from '@/lib/sidebar-state';
import type { UserRole } from '@/db/schema';
import { AdminSidebar } from './admin-sidebar';
import { AdminMobileHeader } from './admin-mobile-header';

interface AdminShellProps {
  children: React.ReactNode;
  userRole: UserRole;
}

export async function AdminShell({ children, userRole }: AdminShellProps) {
  const cookieStore = await cookies();
  const collapsedCookie = cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value;
  const collapsed = resolveCollapsed(collapsedCookie);

  // layout.tsx의 requireRole(['manager', 'admin'])이 hotelier 진입 차단.
  // 방어적으로 staff만 narrow (TypeScript 안전성).
  const showSidebar = userRole !== 'hotelier';
  const staffRole = userRole === 'hotelier' ? undefined : userRole;

  return (
    <div
      data-sidebar-collapsed={collapsed ? 'true' : 'false'}
      className={cn(
        'mx-auto w-full max-w-7xl',
        showSidebar && staffRole
          ? cn(
              'lg:grid lg:gap-0',
              collapsed ? 'lg:grid-cols-[28px_1fr]' : 'lg:grid-cols-[120px_1fr]',
              'transition-[grid-template-columns] duration-200 ease-in-out',
              'motion-reduce:transition-none',
            )
          : 'block',
      )}
    >
      {showSidebar && staffRole && (
        <>
          <AdminMobileHeader userRole={staffRole} />
          <AdminSidebar
            collapsed={collapsed}
            userRole={staffRole}
            className="hidden lg:flex"
          />
        </>
      )}
      <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}
