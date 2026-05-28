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
import { VIEW_MODE_COOKIE } from '@/lib/view-mode';
import type { UserRole } from '@/db/schema';
import { AdminSidebar } from './admin-sidebar';
import { AdminMobileHeader } from './admin-mobile-header';

interface AdminShellProps {
  children: React.ReactNode;
  userRole: UserRole;
}

/**
 * 사이드바 노출 여부 결정.
 * - userRole=hotelier or viewMode=hotelier → 사이드바 미노출 (호텔리어 UI)
 * - manager/admin 본인 모드 → 사이드바 노출
 */
function shouldShowSidebar(userRole: UserRole, viewModeCookie: string | undefined): boolean {
  if (userRole === 'hotelier') return false;
  if (viewModeCookie === 'hotelier') return false; // 시점 보기 ON
  return true;
}

export async function AdminShell({ children, userRole }: AdminShellProps) {
  const cookieStore = await cookies();
  const viewModeCookie = cookieStore.get(VIEW_MODE_COOKIE)?.value;
  const collapsedCookie = cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value;

  const collapsed = resolveCollapsed(collapsedCookie);
  const showSidebar = shouldShowSidebar(userRole, viewModeCookie);

  // 매니저/어드민이 아닌 경우(=호텔리어 본인) — AdminShell이 호출될 가능성은 없음
  // (layout.tsx의 requireRole이 차단). 방어적으로 staff만 narrow.
  const staffRole = userRole === 'hotelier' ? undefined : userRole;

  return (
    <div
      data-sidebar-collapsed={collapsed ? 'true' : 'false'}
      className={cn(
        'mx-auto w-full max-w-7xl',
        showSidebar && staffRole
          ? cn(
              'lg:grid lg:gap-0',
              collapsed ? 'lg:grid-cols-[56px_1fr]' : 'lg:grid-cols-[240px_1fr]',
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
