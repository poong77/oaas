# Design — 어드민/매니저 좌측 사이드바 레이아웃 (admin-sidebar-layout)

> **Feature**: admin-sidebar-layout
> **Phase**: Design
> **Plan 문서**: [docs/01-plan/features/admin-sidebar-layout.plan.md](../../01-plan/features/admin-sidebar-layout.plan.md)
> **작성일**: 2026-05-28
> **사용자 확정 사항**: Q-7 온보딩 미포함 · Q-8 단일 PR 전면 전환 · Q-10 후속 순서 카운트→자리비움→알림→KPI

---

## Executive Summary

| 항목 | 값 |
|:-|:-|
| **Feature** | admin-sidebar-layout (Design 단계) |
| **핵심 설계 결정** | **AdminShell(RSC) + AdminSidebar(CSC) 하이브리드**, 쿠키 기반 collapsed 상태, CSS Grid 레이아웃 |
| **신규 파일** | 8개 (AdminShell, AdminSidebar, AdminSidebarToggle, AdminMobileHeader, AdminNavItem, sidebar-state lib, nav-items data, shadcn Sheet) |
| **수정 파일** | 3개 (admin layout, admin-user-menu, globals.css) |
| **삭제 파일** | 1개 (admin-nav.tsx — 사이드바로 책임 이전) |
| **테스트 시나리오** | 24개 (기능 9 + 시각 6 + 회귀 5 + 모바일 4) |
| **롤백 전략** | git revert 단일 PR + sidebarCollapsed 쿠키 강제 만료 |

### 가치 전달 (Design 단계 — 4관점)

| 관점 | 내용 |
|:-|:-|
| **Problem 해결 명세** | 상단 탭 한 줄 한계 → 좌측 항상 가시 메뉴 + 본문 폭 보존. 매니저 일과 흐름(티켓 큐 80% + 메뉴 잠깐) 최적화. 향후 카운트 배지·자리비움 슬롯 사전 마련. |
| **Solution 기술 명세** | RSC에서 쿠키 read → grid 컬럼 변수 결정 → SSR 깜빡임 0. CSC는 토글·hover flyout만 담당. NavItem 단일 컴포넌트가 데스크탑 사이드바·모바일 Sheet 공유. role-mode-ui 통합은 AdminShell이 viewMode prop만 받음. |
| **Function UX Effect 검증 가능성** | 24개 테스트 시나리오 — 데스크탑 펼침/접힘 × 라이트/다크, 모바일 Sheet 트리거 × viewMode 전환, 자물쇠 매니저, 단축키 키 충돌, 입력 필드 focus 시 무시. |
| **Core Value 구현 안전성** | 본문 max-w-7xl 유지 → `/admin/*` 전 페이지 무수정. AdminNav 삭제는 import 1곳(`layout.tsx`)만. role-mode-ui 회귀 0. flex 아닌 grid 사용으로 fixed 요소(modal/toast) z-index 충돌 0. |

---

## 1. 변경 요약

| 파일 | 종류 | 변경 |
|:-|:-:|:-|
| `app/(admin)/admin/layout.tsx` | 수정 | AdminNav 직접 마운트 제거 → AdminShell로 위임, cookies() 추가 read |
| `app/(admin)/admin/_components/admin-shell.tsx` | **신규** | RSC, grid 컨테이너, 쿠키 read, viewMode 분기 |
| `app/(admin)/admin/_components/admin-sidebar.tsx` | **신규** | CSC, 데스크탑 사이드바, NavItem 렌더 |
| `app/(admin)/admin/_components/admin-sidebar-toggle.tsx` | **신규** | CSC, 토글 버튼 + 단축키 핸들러 |
| `app/(admin)/admin/_components/admin-mobile-header.tsx` | **신규** | CSC, lg 미만, Sheet 트리거 |
| `app/(admin)/admin/_components/admin-nav-item.tsx` | **신규** | CSC, 단일 NavItem (펼침/접힘 모두 처리) |
| `app/(admin)/admin/_components/admin-user-menu.tsx` | 수정 | 펼침/접힘 모드 처리, 사이드바 footer 배치 대응 |
| `app/(admin)/admin/_components/admin-nav.tsx` | **삭제** | 책임 사이드바로 이전 |
| `app/(admin)/admin/_data/nav-items.ts` | **신규** | ALL_TABS 데이터 분리 |
| `lib/sidebar-state.ts` | **신규** | 쿠키 read/write 헬퍼 |
| `lib/hooks/use-sidebar-collapsed.ts` | **신규** | 클라이언트 hook (쿠키 read + router.refresh) |
| `components/ui/sheet.tsx` | **신규** | shadcn/ui sheet 컴포넌트 추가 (`npx shadcn add sheet`) |
| `app/globals.css` | 수정 | --sidebar-w CSS 변수, prefers-reduced-motion 처리 |

**무변경 파일**: RoleScope (mode 계산만), Header (호텔리어 전용), `/admin/*` 페이지 파일 전체, role-mode-ui 관련 파일 전체.

---

## 2. 시스템 아키텍처

### 2.1 데이터 흐름

```
[Request]
  ↓
app/layout.tsx (RSC)
  └─ <RoleScope>                          ← viewMode/mode 계산, hotelier UI 토글
       ├─ (hotelier 모드) Header, EmergencyBanner, ChatbotFab
       └─ <main>{children}</main>
            ↓
            app/(admin)/admin/layout.tsx (RSC, force-dynamic)
            ├─ requireRole(['manager', 'admin'])
            ├─ cookies().get('viewMode') + 'sidebarCollapsed'
            └─ <AdminShell
                 viewMode={resolveViewMode(...)}
                 collapsed={resolveCollapsed(...)}
                 userRole={user.role}
               >
                 ├─ (mobile, <lg) <AdminMobileHeader />        ← Sheet 트리거
                 ├─ (desktop, lg+, staff) <AdminSidebar />     ← grid 좌측 칸
                 │    ├─ <NavItem> × N
                 │    ├─ <AdminSidebarToggle />
                 │    └─ <AdminUserMenu mode="sidebar" />
                 └─ <main className="...">{children}</main>    ← grid 우측 칸
```

### 2.2 grid 컬럼 결정 매트릭스

| viewMode | breakpoint | collapsed | grid-template-columns | 사이드바 |
|:-:|:-:|:-:|:-|:-:|
| `staff` | `lg+` | false | `240px 1fr` | ✅ 펼침 |
| `staff` | `lg+` | true | `56px 1fr` | ✅ 접힘 |
| `staff` | `<lg` | * | `1fr` | ❌ (Sheet로) |
| `hotelier` | * | * | `1fr` | ❌ |

→ 단일 분기는 Tailwind 미디어 쿼리로 처리. JS 미디어 쿼리 hook 불필요.

```html
<!-- AdminShell -->
<div
  className={cn(
    'admin-shell',
    /* staff 모드만 grid */
    viewMode === 'staff' && 'lg:grid lg:gap-0',
    /* collapsed 상태별 컬럼 */
    viewMode === 'staff' && (collapsed
      ? 'lg:grid-cols-[56px_1fr]'
      : 'lg:grid-cols-[240px_1fr]'),
    'transition-[grid-template-columns] duration-200 ease-in-out motion-reduce:transition-none',
  )}
  data-sidebar-collapsed={collapsed ? 'true' : 'false'}
>
  {viewMode === 'staff' && <AdminSidebar collapsed={collapsed} ... />}
  {viewMode === 'staff' && <AdminMobileHeader className="lg:hidden" />}
  <main className="min-w-0">{children}</main>
</div>
```

**`min-w-0`** : grid 컬럼 1fr 자식이 overflow 폭주 방지. flex 아닌 grid에서도 필요.

### 2.3 RoleScope와의 책임 경계

| 책임 | 담당 |
|:-|:-|
| viewMode 쿠키 read + mode 계산 | RoleScope (기존 유지) |
| hotelier UI 노출 (Header·ChatbotFab) | RoleScope (기존 유지) |
| ViewModeBanner 노출 | RoleScope (기존 유지) |
| sidebarCollapsed 쿠키 read | **AdminShell (신규)** |
| viewMode='staff' 분기로 사이드바 노출 | **AdminShell (신규)** |
| grid 컨테이너 형성 | **AdminShell (신규)** |
| 접기/펼치기 토글 | **AdminSidebarToggle (신규)** |

**중복 회피**: AdminShell은 viewMode를 **다시 계산하지 않고** RoleScope가 결정한 data-role 속성을 cascade로 받음. AdminShell의 분기는 `resolveViewMode(userRole, viewModeCookie)` 별도 lib 함수로 단순 read.

---

## 3. 컴포넌트 명세

### 3.1 `<AdminShell>` (신규, 서버 컴포넌트)

**경로**: `app/(admin)/admin/_components/admin-shell.tsx`

**책임**:
- 쿠키(`sidebarCollapsed`, `viewMode`) read
- grid 컨테이너 형성, 컬럼 폭 결정
- viewMode='staff'일 때 사이드바·모바일 헤더 마운트
- children을 `<main>`으로 감쌈

**Props**:
```typescript
interface AdminShellProps {
  children: React.ReactNode;
  userRole: 'manager' | 'admin';
}
```

**구현**:
```typescript
// app/(admin)/admin/_components/admin-shell.tsx
import { cookies } from 'next/headers';
import { resolveViewMode } from '@/lib/types/role-mode';
import { resolveCollapsed, SIDEBAR_COLLAPSED_COOKIE } from '@/lib/sidebar-state';
import { VIEW_MODE_COOKIE } from '@/lib/view-mode';
import { AdminSidebar } from './admin-sidebar';
import { AdminMobileHeader } from './admin-mobile-header';
import { cn } from '@/lib/utils';

interface AdminShellProps {
  children: React.ReactNode;
  userRole: 'manager' | 'admin';
}

export async function AdminShell({ children, userRole }: AdminShellProps) {
  const cookieStore = await cookies();
  const viewModeCookie = cookieStore.get(VIEW_MODE_COOKIE)?.value;
  const collapsedCookie = cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value;

  const viewMode = resolveViewMode(userRole, viewModeCookie); // 'staff' | 'hotelier'
  const collapsed = resolveCollapsed(collapsedCookie);         // boolean

  const showSidebar = viewMode === 'staff';

  return (
    <div
      data-sidebar-collapsed={collapsed ? 'true' : 'false'}
      className={cn(
        'mx-auto w-full max-w-7xl',
        showSidebar
          ? cn(
              'lg:grid lg:gap-0',
              collapsed
                ? 'lg:grid-cols-[56px_1fr]'
                : 'lg:grid-cols-[240px_1fr]',
              'transition-[grid-template-columns] duration-200 ease-in-out motion-reduce:transition-none',
            )
          : 'block',
      )}
    >
      {showSidebar && <AdminMobileHeader userRole={userRole} />}
      {showSidebar && (
        <AdminSidebar
          collapsed={collapsed}
          userRole={userRole}
          className="hidden lg:flex"
        />
      )}
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
```

**왜 max-w-7xl을 AdminShell에서 잡나?**: 기존 `layout.tsx`가 `mx-auto max-w-7xl` 컨테이너였음. 사이드바 도입 후에도 동일한 본문 폭을 유지(Plan Q-2 확정)하기 위해 grid 컨테이너가 max-w-7xl을 흡수.

> 단, 사이드바가 max-w-7xl 영역의 좌측에 위치하므로 **본문 영역은 max-w-7xl - 사이드바 폭**으로 약간 줄어듦. 예: 펼침 시 본문 약 1040px(1280-240). 1차 PR의 의도된 trade-off, Q-2 확정.

### 3.2 `<AdminSidebar>` (신규, 클라이언트 컴포넌트)

**경로**: `app/(admin)/admin/_components/admin-sidebar.tsx`

**책임**:
- 데스크탑(lg+) 좌측 사이드바 렌더
- NAV_ITEMS 데이터 → NavItem 매핑
- 그룹 헤더(펼침 시 노출), 자물쇠 처리
- footer에 토글 + AdminUserMenu 배치

**Props**:
```typescript
interface AdminSidebarProps {
  collapsed: boolean;
  userRole: 'manager' | 'admin';
  className?: string;
}
```

**구현 스케치**:
```typescript
'use client';

import { NAV_ITEMS, GROUP_ORDER, GROUP_LABEL } from '../_data/nav-items';
import { AdminNavItem } from './admin-nav-item';
import { AdminSidebarToggle } from './admin-sidebar-toggle';
import { AdminUserMenu } from './admin-user-menu';
import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AdminSidebar({ collapsed, userRole, className }: AdminSidebarProps) {
  return (
    <aside
      className={cn(
        'sticky top-0 z-30 h-screen flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950',
        className,
      )}
      aria-label="관리자 내비게이션"
    >
      {/* 1. 헤더: 역할 뱃지 (펼침에서만) */}
      <div className="flex h-14 items-center border-b border-slate-100 px-3 dark:border-slate-800">
        <Shield className="h-4 w-4 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden />
        {!collapsed && (
          <span className="ml-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
            {userRole === 'admin' ? '어드민' : '매니저'}
          </span>
        )}
      </div>

      {/* 2. 그룹 + 메뉴 */}
      <nav className="flex-1 overflow-y-auto py-2">
        {GROUP_ORDER.map((group, gi) => {
          const items = NAV_ITEMS.filter((i) => i.group === group);
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
                      <AdminNavItem item={item} locked={locked} collapsed={collapsed} />
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {/* 확장 슬롯: 카운트 배지·자리비움 (P1 후속 Phase) */}
        {/* TODO[sidebar-ticket-badge]: 티켓 큐 메뉴 옆 카운트 배지 */}
        {/* TODO[sidebar-away-toggle]: 자리비움 토글, footer 상단 위치 */}
      </nav>

      {/* 3. footer: 토글 + 사용자 메뉴 */}
      <div className="border-t border-slate-100 dark:border-slate-800">
        <AdminSidebarToggle collapsed={collapsed} />
        <div className="border-t border-slate-100 dark:border-slate-800">
          <AdminUserMenu collapsed={collapsed} />
        </div>
      </div>
    </aside>
  );
}
```

**왜 `sticky top-0 h-screen`?**: 사이드바는 본문 스크롤과 독립적으로 항상 보여야 함. `fixed` 대신 `sticky`로 grid 자식 자격 유지 → 본문이 사이드바 폭만큼 자연스럽게 정렬.

**왜 `z-30`?**: Sheet `z-40`, modal/dialog `z-50`보다 낮게. 사이드바 위에 modal이 항상 위치.

### 3.3 `<AdminNavItem>` (신규, 클라이언트 컴포넌트)

**경로**: `app/(admin)/admin/_components/admin-nav-item.tsx`

**책임**:
- 단일 메뉴 항목 렌더 (펼침 + 접힘 + Sheet 내부 공유)
- 활성 상태(left border + bg) 처리
- 자물쇠 비활성 처리
- 접힘 시 hover tooltip (또는 flyout)

**Props**:
```typescript
import type { NavItem } from '../_data/nav-items';

interface AdminNavItemProps {
  item: NavItem;
  locked: boolean;
  collapsed: boolean;
  /** Sheet 내부 사용 시 close handler */
  onNavigate?: () => void;
}
```

**구현 스케치**:
```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AdminNavItem({ item, locked, collapsed, onNavigate }: AdminNavItemProps) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(item.href + '/');
  const Icon = item.icon;

  // 공통 className
  const itemClasses = cn(
    'group relative flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
    // 활성 상태: left border 3px + bg
    active && !locked && [
      'bg-brand-100/60 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
      'before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r-full before:bg-brand-600 dark:before:bg-brand-400',
    ],
    !active && !locked && 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
    locked && 'cursor-not-allowed text-slate-400 dark:text-slate-500',
    collapsed && 'justify-center',
  );

  // 접힘 상태 + 자물쇠: 아이콘에 Lock 배지 오버레이
  const IconWithLockOverlay = (
    <div className="relative shrink-0">
      <Icon className="h-4 w-4" aria-hidden />
      {locked && collapsed && (
        <Lock
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-slate-400 opacity-70 dark:text-slate-500"
          aria-hidden
        />
      )}
    </div>
  );

  if (locked) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        title={`${item.label} — 어드민 권한 필요`}
        className={itemClasses}
      >
        {IconWithLockOverlay}
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            <Lock className="h-3 w-3 shrink-0" aria-hidden />
          </>
        )}
        {/* 접힘 상태 hover tooltip */}
        {collapsed && (
          <span
            role="tooltip"
            className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-md group-hover:block dark:bg-slate-100 dark:text-slate-900"
          >
            {item.label} (어드민 권한 필요)
          </span>
        )}
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={itemClasses}
    >
      {IconWithLockOverlay}
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {/* 접힘 상태 hover tooltip */}
      {collapsed && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-md group-hover:block dark:bg-slate-100 dark:text-slate-900"
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}
```

**왜 tooltip을 group-hover로 처리?**: shadcn Tooltip은 portal 사용 → z-index 추가 관리 필요. 사이드바 내부 absolute tooltip이 단순. flyout은 후속 개선.

**왜 left border를 `::before` pseudo-element로?**: `border-l-[3px]`을 직접 부여하면 inactive 상태에서도 3px 영역이 차지되어 텍스트 정렬이 흔들림. `::before`로 위치 absolute 부여하면 inactive 상태는 깔끔.

### 3.4 `<AdminSidebarToggle>` (신규, 클라이언트 컴포넌트)

**경로**: `app/(admin)/admin/_components/admin-sidebar-toggle.tsx`

**책임**:
- 접기/펼치기 토글 버튼
- 단축키 `[` `]` 핸들러 (입력 필드 focus 시 무시)
- 쿠키 변경 + router.refresh

**Props**:
```typescript
interface AdminSidebarToggleProps {
  collapsed: boolean;
}
```

**구현 스케치**:
```typescript
'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { SIDEBAR_COLLAPSED_COOKIE, SIDEBAR_COLLAPSED_MAX_AGE } from '@/lib/sidebar-state';

function isEditableElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export function AdminSidebarToggle({ collapsed }: AdminSidebarToggleProps) {
  const router = useRouter();

  const setCollapsed = useCallback(
    (next: boolean) => {
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      if (next) {
        document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=1; path=/; max-age=${SIDEBAR_COLLAPSED_MAX_AGE}; samesite=lax${secure}`;
      } else {
        document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=; path=/; max-age=0; samesite=lax`;
      }
      router.refresh();
    },
    [router],
  );

  const toggle = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed]);

  // 단축키 [ ] (입력 필드 focus 시 무시)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditableElement(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '[') {
        e.preventDefault();
        setCollapsed(true);
      } else if (e.key === ']') {
        e.preventDefault();
        setCollapsed(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCollapsed]);

  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={collapsed ? '사이드바 펼치기 (])' : '사이드바 접기 ([)'}
      title={collapsed ? '사이드바 펼치기 (])' : '사이드바 접기 ([)'}
      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed && <span>사이드바 접기</span>}
    </button>
  );
}
```

**왜 `e.preventDefault()`?**: 일부 단축키 매핑 브라우저 확장 대비 차단.

**왜 모디파이어 키(Ctrl/Cmd/Alt) check?**: `Cmd+[` 는 일부 브라우저에서 뒤로가기. 충돌 방지.

### 3.5 `<AdminMobileHeader>` (신규, 클라이언트 컴포넌트)

**경로**: `app/(admin)/admin/_components/admin-mobile-header.tsx`

**책임**:
- 모바일(<lg)에서만 노출 (`className="lg:hidden"`)
- 햄버거 → Sheet 드로어 트리거
- Sheet 내부는 AdminSidebar의 NavItem 재사용
- viewMode 토글 배너 + 역할 뱃지 + 아바타

**구현 스케치**:
```typescript
'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Shield } from 'lucide-react';
import { NAV_ITEMS, GROUP_ORDER, GROUP_LABEL } from '../_data/nav-items';
import { AdminNavItem } from './admin-nav-item';
import { AdminUserMenu } from './admin-user-menu';
import { ViewModeToggle } from '@/components/layout/view-mode-toggle';

export function AdminMobileHeader({ userRole }: { userRole: 'manager' | 'admin' }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950 lg:hidden">
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
          <div className="flex h-14 items-center border-b border-slate-100 px-4 dark:border-slate-800">
            <Shield className="h-4 w-4 text-brand-700 dark:text-brand-300" aria-hidden />
            <span className="ml-2 text-sm font-semibold">
              {userRole === 'admin' ? '어드민' : '매니저'}
            </span>
          </div>

          {/* viewMode 토글 배너 (모바일 전용 진입점) */}
          <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <ViewModeToggle currentRole={userRole} onAfterToggle={() => setOpen(false)} />
          </div>

          <nav className="overflow-y-auto py-2">
            {GROUP_ORDER.map((group, gi) => {
              const items = NAV_ITEMS.filter((i) => i.group === group);
              return (
                <div key={group} className={gi > 0 ? 'mt-3' : ''}>
                  <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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

      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">통합 AS</span>
      </div>

      {/* 모바일 헤더 우측: 컴팩트 아바타 */}
      <AdminUserMenu collapsed compact />
    </header>
  );
}
```

**왜 `z-40`?**: Sheet 자체가 `z-50`(shadcn 기본). 모바일 헤더는 그 아래.

**Sheet 내부에서도 AdminUserMenu가 필요한가?**: 모바일 헤더 우측에 아바타가 별도로 있으므로 Sheet 내부에는 viewMode 토글만 노출. 로그아웃은 헤더 우측 아바타 드롭다운에서.

### 3.6 `<AdminUserMenu>` 수정 (기존 → 펼침/접힘/모바일 3가지 모드 대응)

**경로**: `app/(admin)/admin/_components/admin-user-menu.tsx`

**변경 사항**:

**Props**:
```typescript
interface AdminUserMenuProps {
  /** 사이드바 접힘 상태 (true면 아바타만 표시) */
  collapsed?: boolean;
  /** 모바일 헤더용 컴팩트 모드 */
  compact?: boolean;
}
```

**3가지 표시 모드**:

| 모드 | 트리거 표시 | 위치 |
|:-|:-|:-|
| **펼침** (`collapsed=false`) | 아바타 + 이름 + ▼ | 사이드바 footer 하단 |
| **접힘** (`collapsed=true`) | 아바타만 (40×40px) | 사이드바 footer 하단 |
| **컴팩트** (`compact=true`) | 아바타만 (32×32px) | 모바일 헤더 우측 |

**드롭다운 popup 위치**:
- 펼침: `absolute bottom-full mb-2 left-0` (위쪽으로 펼침)
- 접힘: `absolute bottom-0 left-full ml-2` (오른쪽으로 펼침)
- 컴팩트: `absolute right-0 top-full mt-2` (아래쪽으로 펼침, 기존 동작)

**구현 핵심 변경**:
```typescript
// 기존: 오른쪽에 right-0 top-full
// 변경: collapsed에 따라 position 분기

const popupPositionClass = cn(
  'absolute z-50 w-64 origin-top-right rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900',
  compact && 'right-0 top-full mt-2',                  // 모바일 헤더 우측
  !compact && !collapsed && 'left-0 bottom-full mb-2', // 사이드바 footer 펼침
  !compact && collapsed && 'left-full bottom-0 ml-2',  // 사이드바 footer 접힘
);
```

**트리거 버튼**:
```typescript
{compact || collapsed ? (
  <button
    type="button"
    onClick={() => setOpen((v) => !v)}
    aria-label="계정 메뉴"
    className={cn(
      'inline-flex items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
      compact ? 'h-8 w-8' : 'h-10 w-10',
    )}
  >
    <User className="h-4 w-4" aria-hidden />
  </button>
) : (
  // 기존 펼침 트리거 (이름 + ▼)
  <button ... />
)}
```

### 3.7 `lib/sidebar-state.ts` (신규)

**경로**: `lib/sidebar-state.ts`

```typescript
export const SIDEBAR_COLLAPSED_COOKIE = 'sidebarCollapsed';
export const SIDEBAR_COLLAPSED_MAX_AGE = 60 * 60 * 24 * 365; // 1년

/** 쿠키 값 → boolean 변환 (strict). */
export function resolveCollapsed(cookieValue: string | undefined): boolean {
  return cookieValue === '1';
}
```

**왜 `value === '1'` strict?**: 잘못된 값(undefined, "true", "0")이 들어와도 안전하게 false로 폴백.

### 3.8 `lib/hooks/use-sidebar-collapsed.ts` (신규)

> 본 Phase에서는 AdminSidebarToggle 내부에서 직접 cookie + router.refresh 처리. 별도 hook은 향후 다른 컴포넌트(예: 키 이벤트 외부)에서 collapsed 상태가 필요할 때 추가. **현재 Phase에서는 skip**, AdminSidebarToggle에 인라인.

→ **본 신규 파일은 보류**. 변경 요약에서 제거 (위 표 갱신 필요).

### 3.9 `_data/nav-items.ts` (신규)

**경로**: `app/(admin)/admin/_data/nav-items.ts`

```typescript
import {
  Activity, Building2, Database, FileText, HelpCircle,
  Inbox, ListChecks, Megaphone, Users,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/db/schema';

export type TabGroup = 'tickets' | 'content' | 'org';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 진입 가능 역할. 매니저가 진입 못 하면 자물쇠 표시. */
  roles: UserRole[];
  group: TabGroup;
}

export const NAV_ITEMS: NavItem[] = [
  // 티켓 운영
  { href: '/admin/tickets', label: '티켓 큐', icon: Inbox, roles: ['manager', 'admin'], group: 'tickets' },
  { href: '/admin/service-status', label: '서비스 상태', icon: Activity, roles: ['manager', 'admin'], group: 'tickets' },
  // 콘텐츠
  { href: '/admin/articles', label: '아티클', icon: FileText, roles: ['manager', 'admin'], group: 'content' },
  { href: '/admin/notices', label: '공지 관리', icon: Megaphone, roles: ['manager', 'admin'], group: 'content' },
  { href: '/admin/faqs', label: 'FAQ', icon: HelpCircle, roles: ['manager', 'admin'], group: 'content' },
  { href: '/admin/checklists', label: '체크리스트', icon: ListChecks, roles: ['manager', 'admin'], group: 'content' },
  // 조직 & 마스터
  { href: '/admin/users', label: '사용자', icon: Users, roles: ['admin'], group: 'org' },
  { href: '/admin/hotels', label: '호텔', icon: Building2, roles: ['admin'], group: 'org' },
  { href: '/admin/master', label: '마스터 데이터', icon: Database, roles: ['manager', 'admin'], group: 'org' },
];

export const GROUP_ORDER: TabGroup[] = ['tickets', 'content', 'org'];

export const GROUP_LABEL: Record<TabGroup, string> = {
  tickets: '티켓 운영',
  content: '콘텐츠',
  org: '조직 & 마스터',
};
```

### 3.10 `app/(admin)/admin/layout.tsx` 수정

**기존**:
```typescript
export default async function AdminLayout({ children }) {
  const user = await requireRole(['manager', 'admin']);
  const cookieStore = await cookies();
  const viewModeCookie = cookieStore.get(VIEW_MODE_COOKIE)?.value;
  const adminMode = resolveRoleMode(user.role, viewModeCookie);

  return (
    <div data-role={adminMode} className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <AdminNav role={user.role} />
      {children}
    </div>
  );
}
```

**변경**:
```typescript
import { AdminShell } from './_components/admin-shell';

export default async function AdminLayout({ children }) {
  const user = await requireRole(['manager', 'admin']);
  const cookieStore = await cookies();
  const viewModeCookie = cookieStore.get(VIEW_MODE_COOKIE)?.value;
  const adminMode = resolveRoleMode(user.role, viewModeCookie);

  return (
    <div data-role={adminMode} className="min-h-[calc(100vh-0px)]">
      <AdminShell userRole={user.role}>{children}</AdminShell>
    </div>
  );
}
```

**핵심 변경**:
- AdminNav 직접 import 제거
- `mx-auto max-w-7xl` 컨테이너를 AdminShell이 흡수 (grid 컨테이너로)
- `data-role`은 유지 (CSS 변수 cascade 동일 동작)
- `padding` 은 AdminShell의 `<main>`에서 처리

### 3.11 `globals.css` 추가

```css
/* 사이드바 트랜지션 reduced motion */
@media (prefers-reduced-motion: reduce) {
  .admin-shell {
    transition: none !important;
  }
}
```

> 위 클래스는 Tailwind `motion-reduce:transition-none`으로 처리 가능하므로 별도 CSS 추가는 **불필요**. globals.css 변경 0건으로 줄임.

---

## 4. 쿠키 스펙

### 4.1 `sidebarCollapsed` 쿠키

| 속성 | 값 | 비고 |
|:-|:-|:-|
| **이름** | `sidebarCollapsed` | 단일 쿠키, 다른 쿠키와 충돌 없음 |
| **값** | `1` (접힘) 또는 미설정 (펼침 기본) | strict 비교 |
| **Domain** | (생략) | 현재 도메인 |
| **Path** | `/` | 전역 |
| **MaxAge** | 1년 (31536000초) | 사용자 UI 선호도 |
| **HttpOnly** | `false` | 클라이언트 토글 |
| **Secure** | `true` (프로덕션) / `false` (dev) | NODE_ENV로 분기 |
| **SameSite** | `Lax` | CSRF 방지 + 일반 네비게이션 허용 |

### 4.2 viewMode 쿠키와의 독립

- `sidebarCollapsed`와 `viewMode`는 **완전 독립**.
- 매니저가 viewMode='hotelier' 켜도 sidebarCollapsed는 유지 (다시 staff로 돌아오면 그대로 적용).
- 호텔리어 본인이 로그인해도 sidebarCollapsed 쿠키는 잔존 (호텔리어 모드에서 효과 없음).

---

## 5. 데이터 흐름 (시퀀스 다이어그램)

### 5.1 시나리오 — 매니저가 토글 또는 `[` 키로 사이드바 접기

```
사용자          브라우저            AdminSidebarToggle     서버 (RSC)
  │                │                       │                     │
  │ ([ 키 또는 토글 클릭]                      │                     │
  │ ─────────────>│                       │                     │
  │                │  setCollapsed(true)    │                     │
  │                │ ─────────────────────>│                     │
  │                │                       │ document.cookie 변경 │
  │                │                       │ sidebarCollapsed=1   │
  │                │                       │                     │
  │                │ router.refresh()       │                     │
  │                │ ──────────────────────────────────────────>│
  │                │                       │     [RSC re-execute]
  │                │                       │     cookies() → '1'
  │                │                       │     resolveCollapsed → true
  │                │                       │     grid-cols 56px_1fr
  │                │ 새 HTML stream         │                     │
  │                │<──────────────────────────────────────────│
  │ [사이드바 56px로 transition]                                 │
  │<───────────────│                       │                     │
```

**transition 동작**: grid-template-columns가 변경되는 동안 200ms 동안 transition. CSS-only 처리.

### 5.2 시나리오 — 호텔리어 시점 보기 ON

```
사용자       AdminUserMenu      ViewModeToggle      서버 (RSC)
  │              │                   │                    │
  │ [아바타 클릭] │                   │                    │
  │ ──────────>│                   │                    │
  │              │ [드롭다운 열림]      │                    │
  │ [시점보기 클릭] │                   │                    │
  │ ─────────────>│                   │                    │
  │              │                   │ setHotelierView()   │
  │              │  viewMode=hotelier 쿠키 set            │
  │              │  router.refresh()                       │
  │              │ ──────────────────────────────────────>│
  │              │                   │  RoleScope: showHotelierUi=true
  │              │                   │  AdminShell: viewMode='hotelier'
  │              │                   │  → 사이드바 unmount, grid 1-col
  │              │                   │  Header(호텔리어) mount
  │ [화면 전환: 호텔리어 헤더 + 사이드바 사라짐]                │
  │<─────────────────────────────────────────────────────│
```

### 5.3 시나리오 — 모바일 햄버거 → Sheet 메뉴 클릭

```
사용자      AdminMobileHeader        Sheet           NavItem (li)
  │              │                     │                  │
  │ [햄버거 클릭]│                     │                  │
  │ ──────────>│                     │                  │
  │              │ setOpen(true)        │                  │
  │              │ ──────────────────>│                  │
  │              │                     │ [Sheet 열림, 좌측 280px]
  │ [메뉴 항목 클릭]                    │                  │
  │ ────────────────────────────────────────────────────>│
  │              │                     │                  │ Link onNavigate()
  │              │                     │                  │ → setOpen(false)
  │              │                     │ [Sheet 닫힘]      │
  │              │                     │                  │ → 페이지 이동
  │<─────────────────────────────────────────────────────│
```

---

## 6. 상태 관리

### 6.1 SSR/CSR 일관성

| 상태 | 서버에서 결정 | 클라이언트에서 결정 |
|:-|:-:|:-:|
| `sidebarCollapsed` (쿠키) | ✅ cookies() | ❌ (서버 결과 그대로) |
| grid-cols 클래스 | ✅ AdminShell | ❌ |
| 사이드바 마운트 여부 | ✅ AdminShell | ❌ |
| Sheet open 상태 | ❌ | ✅ useState |
| AdminUserMenu open | ❌ | ✅ useState |
| 활성 메뉴 (usePathname) | ❌ | ✅ usePathname |

**Hydration mismatch 위험 0**: 모든 SSR 결정은 쿠키 기반. useState 첫 값은 항상 `false` 안정값.

### 6.2 router.refresh 영향 범위

- AdminShell이 force-dynamic이므로 refresh 시 layout 전체 재실행
- RoleScope도 재실행 (NextAuth 캐시는 그대로, EmergencyBanner는 hotelier 모드일 때만)
- 본문(`<main>{children}`)도 재실행 → 단, 페이지의 데이터 fetch는 force-dynamic page에서만 추가 발생
- **성능 영향**: 토글 1회당 RSC 재실행. force-dynamic의 일반 페이지 진입과 동등한 비용

---

## 7. 에러 처리 & 엣지 케이스

| 케이스 | 동작 | 처리 |
|:-|:-|:-|
| sidebarCollapsed에 의도치 않은 값 ("true", "yes") | resolveCollapsed가 strict로 '1'만 검사 → false | ✅ 안전 |
| 단축키 `[` `]` 가 입력 필드 focus 중 발생 | isEditableElement 체크로 무시 | ✅ 안전 |
| Cmd+[ (브라우저 뒤로가기) 누르면 토글 안 됨 | metaKey check로 무시 | ✅ 의도된 동작 |
| 모바일에서 Sheet 열린 채 화면 회전 | Sheet의 onOpenChange로 적절히 처리 | ✅ shadcn 기본 동작 |
| 모바일에서 viewMode 변경 후 Sheet 닫힘 안 됨 | onAfterToggle 콜백으로 setOpen(false) | ✅ 명시적 처리 |
| 데스크탑 → 모바일 리사이즈 시 사이드바 잔존 | `lg:flex hidden` 미디어 쿼리로 자동 숨김 | ✅ CSS-only |
| 모바일 → 데스크탑 리사이즈 시 Sheet 잔존 | Sheet 컴포넌트는 `lg:hidden`된 부모 아래 → 자동 숨김 | ✅ CSS-only |
| 사이드바 footer 펼침 메뉴가 화면 하단 침범 | popup 위치를 `bottom-full mb-2`로 위쪽 펼침 | ✅ 명시적 처리 |
| 접힘 상태 아바타 클릭 시 popup이 화면 우측 잘림 | `left-full ml-2`로 오른쪽 펼침, 사이드바 옆으로 노출 | ✅ 명시적 처리 |
| RoleScope의 `className="contents"`가 grid 자식 인식 불가 | AdminShell이 grid 컨테이너, RoleScope는 max-w-7xl 컨테이너 외부 | ✅ 구조 정리 |
| max-w-7xl 안에서 사이드바가 차지 → 본문 폭 감소 | 1차 PR의 의도, Q-2 확정 | ✅ Q-2 결정 |
| 사이드바 hover flyout이 본문 위 덮음 | 본 Phase 미구현 (group-hover tooltip만), 후속 PR에서 검토 | ✅ 의도 |

---

## 8. 접근성 (a11y)

### 8.1 ARIA & 시멘틱

| 요소 | 속성 | 비고 |
|:-|:-|:-|
| `<aside>` 사이드바 | `aria-label="관리자 내비게이션"` | landmark |
| `<nav>` 메뉴 영역 | (aside 안에서 자동 nav landmark) | |
| `aria-current="page"` | 활성 NavItem | 스크린리더 위치 안내 |
| `aria-label="사이드바 접기 ([)"` | 토글 버튼 | 단축키 안내 포함 |
| `aria-disabled="true"` | 자물쇠 메뉴 | disabled 의미 명시 |
| `aria-haspopup="menu"` `aria-expanded` | AdminUserMenu 트리거 | 드롭다운 |
| `aria-hidden="true"` + `inert` | 닫힌 모바일 Sheet | 포커스 차단 |
| `role="tooltip"` | 접힘 메뉴 hover label | |

### 8.2 키보드 네비게이션

- **사이드바 펼침 상태**: Tab → 그룹 헤더 skip(div, focusable 아님) → 각 NavItem 순차
- **사이드바 접힘 상태**: Tab → NavItem(아이콘만) 순차 → tooltip은 마우스 hover 전용 (포커스 시에도 보여야 a11y 완성, focus-visible:block 추가 권장)
- **토글 단축키**: `[` `]` 전역 (입력 필드 제외)
- **모바일 Sheet**: Tab 진입 시 Sheet 내부로 focus trap (shadcn 기본)
- **Esc**: 모바일 Sheet 닫기, AdminUserMenu popup 닫기 (기존)

### 8.3 모션 감소 (prefers-reduced-motion)

- AdminShell의 grid transition: `motion-reduce:transition-none`
- AdminUserMenu 회전 아이콘: `motion-reduce:transition-none`
- Sheet 슬라이드: shadcn 기본이 motion-reduce 지원

### 8.4 색맹 보완

- 활성 표시는 **컬러 + left border 3px + background** 3중
- 자물쇠는 컬러가 아닌 **Lock 아이콘 + disabled**
- 토글 버튼은 **아이콘이 명시적으로 다름** (PanelLeftClose ↔ PanelLeftOpen)

---

## 9. 테스트 시나리오

### 9.1 기능 시나리오 (9건)

| ID | 시나리오 | 기대 결과 |
|:-:|:-|:-|
| F-01 | 매니저 로그인 후 `/admin/tickets` 진입 (lg+ 데스크탑) | 좌측 240px 사이드바 노출, 티켓 큐 메뉴 활성(left border + bg), 본문 max-w-7xl 안에서 좌측 메뉴+우측 본문 grid 정렬 |
| F-02 | 토글 버튼 클릭 (펼침 → 접힘) | 200ms transition으로 240px → 56px, 텍스트 fade-out, 활성 메뉴 left border 유지 |
| F-03 | 토글 버튼 클릭 (접힘 → 펼침) | 56px → 240px, 텍스트 fade-in, 그룹 헤더 다시 노출 |
| F-04 | `[` 키 누름 (접기) | F-02와 동일 |
| F-05 | `]` 키 누름 (펼치기) | F-03과 동일 |
| F-06 | 입력 필드 focus 상태에서 `[` 키 누름 | 사이드바 변경 없음, 입력 필드에 `[` 문자 입력됨 |
| F-07 | 매니저가 자물쇠 메뉴(사용자) 클릭 | 클릭 무반응 (button disabled), 404 발생 안 함, 마우스 hover tooltip "어드민 권한 필요" |
| F-08 | 접힘 상태에서 아이콘 hover | 200ms 후 우측 tooltip 노출 (메뉴명) |
| F-09 | AdminUserMenu 아바타 클릭 (펼침 상태) | 사이드바 footer에서 위쪽으로 popup 펼침, 프로필/시점토글/로그아웃 노출 |

### 9.2 시각 시나리오 (6건)

| ID | 시나리오 | 확인 항목 |
|:-:|:-|:-|
| V-01 | admin × 라이트 × 펼침 | 보라 톤 활성 표시 + 사이드바 배경 white 중립 |
| V-02 | admin × 다크 × 펼침 | 다크 보라 톤 + 사이드바 배경 slate-950 |
| V-03 | manager × 라이트 × 펼침 | 코발트 톤 활성 표시 + 자물쇠 메뉴 회색 |
| V-04 | manager × 다크 × 접힘 | 다크 코발트 + 자물쇠 아이콘 오버레이 식별 가능 |
| V-05 | admin × 라이트 × 접힘 | 56px 폭, 아이콘만 노출, 활성 메뉴 left border 식별 |
| V-06 | 다크 × 접힘 hover | tooltip 다크모드 색상 (slate-100 bg, slate-900 text) |

### 9.3 회귀 시나리오 (5건)

| ID | 시나리오 | 확인 |
|:-:|:-|:-|
| R-01 | 호텔리어 로그인 후 `/` 진입 | 사이드바 DOM 자체 없음, 기존 Header GNB 정상 |
| R-02 | 매니저가 호텔리어 시점 보기 ON | 사이드바 unmount, 호텔리어 Header mount, ViewModeBanner 노출 (role-mode-ui 회귀 없음) |
| R-03 | 매니저가 `/admin/users` 직접 입력 | 404 (권한 부족, 기존 동작) |
| R-04 | 매니저가 UserNav "매니저 영역으로" 클릭 | `/admin/tickets` 이동, 404 발생 안 함 (role-mode-ui 버그 픽스 유지) |
| R-05 | `/admin/tickets` `/admin/articles` `/admin/master` 페이지 시각 회귀 | 본문 폭 약 1040px(사이드바 240px 차감), 페이지 자체 깨짐 없음 |

### 9.4 모바일 시나리오 (4건)

| ID | 시나리오 | 확인 |
|:-:|:-|:-|
| M-01 | 모바일(<lg) 매니저가 `/admin/tickets` 진입 | 상단 컴팩트 헤더(햄버거+로고+아바타) 노출, 사이드바 DOM 없음 |
| M-02 | 햄버거 클릭 → Sheet 열림 | 좌측 280px Sheet, viewMode 토글 + 그룹 메뉴 노출 |
| M-03 | Sheet 안에서 메뉴 클릭 | Sheet 자동 닫힘 + 페이지 이동 |
| M-04 | 데스크탑(lg+) → 모바일(<lg) 브라우저 리사이즈 | 사이드바 자동 숨김(`lg:flex hidden`), 모바일 헤더 자동 노출(`lg:hidden`) |

### 9.5 자동화 도구

- **기능 9건 + 모바일 4건 = Playwright E2E**
- **시각 6건 = Playwright screenshot diff** (기존 role-mode-ui 패턴)
- **회귀 5건 = Playwright + 수동 검증** (R-05는 페이지별 캡처 비교)
- **a11y 자동 = axe-core / pa11y**

---

## 10. 구현 순서 (Commit 단위)

| Commit | 내용 | 빌드 통과? | 사용자 영향 |
|:-:|:-|:-:|:-|
| 1 | `chore(admin): ALL_TABS를 _data/nav-items.ts로 추출` | ✅ | 0 (리팩토링) |
| 2 | `feat(admin): lib/sidebar-state.ts + shadcn Sheet 컴포넌트 추가` | ✅ | 0 (사용처 없음) |
| 3 | `feat(admin): AdminShell RSC + grid + 쿠키 read (사이드바 컴포넌트 빈 mount)` | ✅ | 본문 폭 약간 감소 (max-w-7xl 안 grid 시작) |
| 4 | `feat(admin): AdminSidebar + AdminNavItem (펼침 모드만, 토글 없음)` | ✅ | 데스크탑 사이드바 노출, 토글 불가 |
| 5 | `feat(admin): AdminSidebarToggle + 쿠키 토글 + 단축키` | ✅ | 토글·단축키 동작 |
| 6 | `feat(admin): AdminUserMenu 사이드바 footer 모드 추가 + AdminNav 우측 메뉴 제거` | ✅ | 사용자 메뉴 위치 이전 |
| 7 | `feat(admin): AdminMobileHeader + Sheet 드로어` | ✅ | 모바일 Sheet 동작 |
| 8 | `refactor(admin): AdminNav 삭제 + layout.tsx AdminShell 적용 완료` | ✅ | 상단 탭 완전 제거 (전면 전환) |
| 9 | `feat(admin): 접힘 상태 hover tooltip + 자물쇠 Lock 오버레이` | ✅ | 접힘 UX 완성 |
| 10 | `feat(admin): 확장 슬롯 TODO 주석 (카운트 배지·자리비움 위치 명시)` | ✅ | 0 (주석만) |
| 11 | `test(e2e): admin-sidebar-layout 24개 시나리오` | ✅ | 0 |
| 12 | `docs: 개발 일지 + 시각 회귀 캡처` | ✅ | 0 |

**Commit 8이 분기점**: 그 이전엔 사이드바와 상단 탭 병행 노출(중복) 가능. **Commit 8 이전 빌드는 사이드바를 hidden lg:flex로 막아두고 막상 전환은 8에서**. 또는 Commit 4부터 AdminNav를 layout.tsx에서 제거 → Commit 4 이후 즉시 사이드바 단독 노출(권장).

> 권장 변경: Commit 4에서 AdminNav를 layout.tsx 임포트만 제거하되 파일은 남김. Commit 8에서 파일 삭제. 빌드 가능성·롤백 용이성 모두 확보.

### 10.1 롤백 전략

- **Commit 3 이전**: 즉시 revert. 사용자 영향 0
- **Commit 4~7**: 단일 PR revert로 상단 탭 복귀 (AdminNav 파일이 남아있으면 단순 import 복원)
- **Commit 8 이후**: AdminNav 파일 삭제 → 단순 revert로는 AdminNav 복귀 불가. **단일 PR 전체 revert** 필요
- **배포 후 hot-fix**: `sidebarCollapsed` 쿠키 영향 차단은 사용자별로 토글로 충분. 사이드바 자체 끄려면 AdminShell에서 `showSidebar = false` 강제 1줄 patch

---

## 11. Plan 리스크 재검토

Plan §6의 리스크가 Design에서 어떻게 해소됐는지.

| Plan ID | Design 해소 |
|:-|:-|
| **C1** layout max-w-7xl 충돌 | AdminShell이 max-w-7xl 컨테이너 흡수 + grid로 전환. ✅ |
| **C2** RoleScope contents grid 자식 풀림 | RoleScope는 max-w-7xl 외부. AdminShell이 grid 형성. ✅ |
| **C3** AdminNav flex 한 줄 | AdminNav 삭제, AdminSidebar vertical 구조 신규. ✅ |
| **C4** next-themes 다크모드 사이드바 충돌 | 사이드바 배경 brand-* 미사용, neutral 고정. ✅ |
| **D1** AdminUserMenu 두 곳 마운트 | Commit 6에서 동시 처리. ✅ |
| **D2** 모바일 헤더 + 호텔리어 Header 동시 | viewMode 분기로 정확히 1개. AdminMobileHeader `lg:hidden`, RoleScope가 호텔리어 Header 토글. ✅ |
| **D3** 데스크탑/모바일 NavItem 중복 | AdminNavItem 1개 + nav-items.ts 1개. Sheet 재사용. ✅ |
| **E1** sidebarCollapsed 위조 | resolveCollapsed strict '1' 검사. ✅ |
| **E2** SSR/CSR hydration | useState 미사용. cookies()로만. ✅ |
| **E3** 모바일 Sheet 사이드바 잔존 | `lg:flex hidden` CSS-only. ✅ |
| **E4** 단축키 입력 필드 충돌 | isEditableElement check. ✅ |
| **E5** max-w-7xl 우측 여백 | Q-2 확정으로 의도. 후속 admin-content-width Phase. ✅ |
| **E6** 사이드바 unmount 자녀 remount | grid CSS만 변경, children key 유지. ✅ |
| **E7** flyout z-index 충돌 | 본 Phase는 group-hover tooltip만. flyout 후속. z-30/40/50 명시. ✅ |
| **R1** /admin/* 페이지 본문 폭 회귀 | max-w-7xl 유지로 페이지 무수정. R-05 시나리오로 검증. ✅ |
| **R2** role-mode-ui 자물쇠 회귀 | Lock 아이콘 배지 오버레이로 의도 변경. V-04 시나리오. ✅ |
| **R3** viewMode 토글 위치 변경 | Commit 6에서 동시 이전. ✅ |
| **R4** 호텔리어 회귀 | R-01 시나리오. viewMode='hotelier'면 사이드바 DOM 없음. ✅ |
| **R5** 다크모드 가독성 | V-02·V-04·V-06 시나리오. ✅ |

**결론**: 19개 리스크 전부 Design 결정으로 해소. 잔존 리스크 없음.

---

## 12. 미해결 의사결정 (Open Questions)

| ID | 질문 | 기본 선택 | 변경 시 영향 |
|:-:|:-|:-|:-|
| Q-D1 | 접힘 hover flyout 도입 시점 | 본 Phase 미도입 (group-hover tooltip만) | 도입 시 z-index 관리 추가 + flyout 컴포넌트 |
| Q-D2 | shadcn Tooltip 도입 여부 | 본 Phase 미사용 (단순 absolute) | 도입 시 portal·focus 관리 자동 |
| Q-D3 | 단축키 가시화 (사이드바에 `[ ]` 안내 표시) | 본 Phase 미포함 | 추가 시 footer에 키 안내 1줄 추가 |
| Q-D4 | 사이드바 폭 사용자 정의 (drag-resize) | 미지원 | 큰 작업, 별도 Phase |
| Q-D5 | 활성 메뉴 자동 스크롤 (접힘 상태에서 활성 메뉴가 viewport 밖일 때) | 본 Phase 미고려 (메뉴 9개라 항상 보임) | 메뉴 증가 시 자동 scrollIntoView 필요 |

---

## 13. 다음 단계

1. **본 Design 사용자 승인** → Q-D1~Q-D5 확정 (또는 후속 Phase 위임)
2. **`/pdca do admin-sidebar-layout`** — Commit 1~12 순차 구현
   - Commit 1~3 (P0 기반): 0.5일
   - Commit 4~6 (P0 코어): 1.5일
   - Commit 7 (모바일): 0.5일
   - Commit 8~10 (전환 + UX 완성): 0.5일
   - Commit 11~12 (QA·문서): 1일
3. **`/pdca analyze admin-sidebar-layout`** — Gap 분석 + 24개 시나리오 매핑
4. **`/pdca report admin-sidebar-layout`** — 완료 보고서

---

## 부록 A. 디렉토리 트리 (변경 후)

```
app/(admin)/admin/
├── layout.tsx                          [수정] AdminShell 적용, padding/grid 위임
├── _components/
│   ├── admin-shell.tsx                 [신규] RSC, grid, 쿠키 read
│   ├── admin-sidebar.tsx               [신규] CSC, 데스크탑 aside
│   ├── admin-sidebar-toggle.tsx        [신규] CSC, 토글·단축키
│   ├── admin-mobile-header.tsx         [신규] CSC, Sheet 트리거
│   ├── admin-nav-item.tsx              [신규] CSC, NavItem 단일 (3 모드 공유)
│   ├── admin-user-menu.tsx             [수정] collapsed/compact props, popup 위치 분기
│   └── admin-nav.tsx                   [삭제] 사이드바로 책임 이전
└── _data/
    └── nav-items.ts                    [신규] NAV_ITEMS, GROUP_ORDER, GROUP_LABEL

components/ui/
└── sheet.tsx                           [신규] shadcn add sheet

lib/
└── sidebar-state.ts                    [신규] 쿠키 헬퍼

(globals.css 무변경 — Tailwind motion-reduce: 유틸로 충분)
```

## 부록 B. 참조

- Plan: `docs/01-plan/features/admin-sidebar-layout.plan.md`
- 선행 Design: `docs/02-design/features/role-mode-ui.design.md`
- shadcn Sheet: https://ui.shadcn.com/docs/components/sheet
- Tailwind grid-template-columns: https://tailwindcss.com/docs/grid-template-columns#arbitrary-values
- VSCode 사이드바 단축키 패턴 (Toggle Primary Side Bar = `Cmd/Ctrl+B`, 단 본 프로젝트는 `[`/`]` 채택)
- Radix UI Dialog (Sheet 내부): focus trap, scroll lock 자동 처리
