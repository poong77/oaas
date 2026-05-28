# Design — 역할별 모드 UI 분리 (role-mode-ui)

> **Feature**: role-mode-ui
> **Phase**: Design
> **Plan 문서**: [docs/01-plan/features/role-mode-ui.plan.md](../../01-plan/features/role-mode-ui.plan.md)
> **작성일**: 2026-05-28
> **블로커 해소 결정**: ✅ 미들웨어 미사용 (Plan §6 C4 리스크 자동 해소)

---

## Executive Summary

| 항목 | 값 |
|:-|:-|
| **Feature** | role-mode-ui — 역할별 모드 UI 분리 (Design 단계) |
| **핵심 설계 결정** | **미들웨어 미사용** — 모든 분기를 RSC layout에서 `cookies()` 직접 읽어 처리 |
| **신규 파일** | 7개 (RoleScope, ViewModeBanner, ViewModeToggle, AdminUserMenu, view-mode lib, use-view-mode hook, role 타입) |
| **수정 파일** | 7개 (globals.css, root layout, admin layout, user layout, header, admin-nav, user-nav) |
| **테스트 시나리오** | 18개 (기능 9 + 시각 6 + 회귀 3) |
| **롤백 전략** | data-role 속성·쿠키만 무효화하면 즉시 원복 (DB 변경 0건) |

### 가치 전달 (Design 단계 — 4관점)

| 관점 | 내용 |
|:-|:-|
| **Problem 해결 명세** | 사용자 멘탈 모델 분리·UserNav 버그·매니저 권한 한계 비가시화 3대 문제를 단일 PR로 통합 해결. 각 문제별 Acceptance Criteria 명시. |
| **Solution 기술 명세** | `<RoleScope>` 서버 컴포넌트 + `cookies()` 기반 분기 + CSS 변수 cascade + `data-role` 속성 매핑. 미들웨어 zero, NextAuth touch zero. |
| **Function UX Effect 검증 가능성** | 18개 테스트 시나리오로 3역할 × 라이트/다크 × 시점보기 ON/OFF = 12 조합 + 회귀 검사. |
| **Core Value 구현 안전성** | 기존 `brand-*` 50+ 파일 무수정, 권한 체크 로직 무수정, DB 무변경. 롤백 시 cookies clear + Provider 1개 토글로 끝. |

---

## 1. 변경 요약

| 파일 | 종류 | 변경 |
|:-|:-:|:-|
| `app/globals.css` | 수정 | 매니저(`:root[data-role=manager]`)·호텔리어(`:root[data-role=hotelier]`) 토큰 22줄 추가 + 다크 variant |
| `app/layout.tsx` | 수정 | RoleScope로 감싸기, EmergencyBanner·ChatbotFab을 RoleScope 자식 슬롯으로 이동 |
| `app/(admin)/admin/layout.tsx` | 수정 | `<div data-role={...}>` 부여 |
| `app/(user)/layout.tsx` | 수정 | `<div data-role={...}>` 부여 |
| `app/(admin)/admin/_components/admin-nav.tsx` | 수정 | 메뉴 그룹화, 자물쇠 아이콘, "내 프로필 →" 제거, AdminUserMenu 통합 |
| `app/(user)/_components/user-nav.tsx` | 수정 | line 44 매니저 링크 `/admin/users` → `/admin/tickets` 버그 수정 |
| `components/layout/header.tsx` | 수정 | viewMode props 받기, 호텔리어 시점 배지 노출, isStaff 분기 조정 |
| `components/layout/role-scope.tsx` | **신규** | `data-role` 결정 + 호텔리어 UI 조건부 렌더 (서버 컴포넌트) |
| `components/layout/view-mode-banner.tsx` | **신규** | 시점 보기 모드 상단 배너 (클라이언트 컴포넌트) |
| `components/layout/view-mode-toggle.tsx` | **신규** | 아바타 드롭다운 내부 시점 토글 (클라이언트 컴포넌트) |
| `app/(admin)/admin/_components/admin-user-menu.tsx` | **신규** | 어드민/매니저 아바타 드롭다운 (시점 토글 포함) |
| `lib/view-mode.ts` | **신규** | 쿠키 read/write/clear (서버), 정책 상수 |
| `lib/hooks/use-view-mode.ts` | **신규** | 클라이언트 hook (쿠키 read + router.refresh) |
| `lib/types/role-mode.ts` | **신규** | `RoleMode` 타입, `resolveRoleMode()` 함수 |

**무변경 파일**: middleware.ts (생성 안 함), lib/auth.ts, lib/auth.config.ts, lib/permissions.ts, 50+ brand-* 사용 파일.

---

## 2. 시스템 아키텍처

### 2.1 데이터 흐름 (서버 → 클라이언트)

```
┌─────────────────────────────────────────────────────────────────┐
│ Request → app/layout.tsx (RSC)                                  │
│   1. auth() 호출 → session.user.role 획득                       │
│   2. cookies().get('viewMode') 읽기                             │
│   3. resolveRoleMode(role, viewMode) → 'admin'|'manager'|'hotelier' │
│   4. <RoleScope mode={resolved}>                                │
│      ├─ <div data-role={resolved}>                              │
│      │   ├─ <Header showHotelierGnb={mode === 'hotelier'} />    │
│      │   ├─ <EmergencyBanner /> (mode === 'hotelier'일 때만)    │
│      │   ├─ <ViewModeBanner show={viewMode === 'hotelier'} />   │
│      │   ├─ {children}                                          │
│      │   └─ <ChatbotFab embedUrl={...} /> (mode === hotelier만) │
│      └─ </div>                                                  │
└─────────────────────────────────────────────────────────────────┘

[CSS Variable Cascade]
:root[data-role=admin]    { --color-brand-700: oklch(...purple) }
:root[data-role=manager]  { --color-brand-700: #1d4ed8 }
:root[data-role=hotelier] { --color-brand-700: #15803d }
↓
[기존 50+ 파일의 className은 무수정]
className="text-brand-700"  ← CSS 변수가 자동 적용된 색으로 렌더
```

### 2.2 상태 분기 매트릭스 (resolveRoleMode 결과)

| `user.role` | `viewMode` 쿠키 | 결과 `mode` | 호텔리어 UI 노출 |
|:-:|:-:|:-:|:-:|
| (비로그인) | - | `hotelier` | ✅ Yes |
| `hotelier` | - | `hotelier` | ✅ Yes |
| `hotelier` | `hotelier` | `hotelier` | ✅ Yes (호텔리어는 항상 자기 모드) |
| `manager` | (없음/기타) | `manager` | ❌ No |
| `manager` | `hotelier` | `hotelier` | ✅ Yes (시점 보기 ON) |
| `admin` | (없음/기타) | `admin` | ❌ No |
| `admin` | `hotelier` | `hotelier` | ✅ Yes (시점 보기 ON) |

**핵심**: 호텔리어 UI(헤더 GNB·EmergencyBanner·ChatbotFab) 노출 여부는 `mode === 'hotelier'`로 단일 분기. `user.role`이 아니라 `mode` 기준.

**보안 원칙**: `viewMode`는 UI 표시만 영향. 서버 권한 체크(`requireRole`)는 항상 `user.role` 사용. 매니저가 `viewMode=hotelier`로 토글해도 `/admin/users`는 여전히 404.

---

## 3. 컴포넌트 명세

### 3.1 `<RoleScope>` (신규, 서버 컴포넌트)

**경로**: `components/layout/role-scope.tsx`

**책임**:
- 사용자 세션 + 쿠키 읽어 `mode` 결정
- `<div data-role={mode}>` 으로 자식을 감싸 CSS 변수 cascade 적용
- 호텔리어 UI(Header·EmergencyBanner·ChatbotFab) 조건부 렌더링
- 시점 보기 모드 시 ViewModeBanner 노출

**Props**:
```typescript
interface RoleScopeProps {
  children: React.ReactNode;
  /** 라우트 그룹별 강제 모드 — admin/user layout에서 사용 */
  forceMode?: RoleMode;
}
```

**구현**:
```typescript
// components/layout/role-scope.tsx
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { resolveRoleMode } from '@/lib/types/role-mode';
import { Header } from './header';
import { EmergencyBanner } from './emergency-banner';
import { ChatbotFab } from '@/components/chatbot/chatbot-fab';
import { ViewModeBanner } from './view-mode-banner';
import { getChatbotEmbedUrl } from '@/lib/services/chatbot-meta';
import { VIEW_MODE_COOKIE } from '@/lib/view-mode';

export async function RoleScope({ children, forceMode }: RoleScopeProps) {
  const session = await auth();
  const cookieStore = await cookies();
  const viewModeCookie = cookieStore.get(VIEW_MODE_COOKIE)?.value;
  const userRole = session?.user?.role ?? null;

  const mode = forceMode ?? resolveRoleMode(userRole, viewModeCookie);
  const showHotelierUi = mode === 'hotelier';
  const isViewMode =
    !!userRole &&
    userRole !== 'hotelier' &&
    viewModeCookie === 'hotelier';

  // hotelier UI에서만 챗봇 임베드 URL 필요 (RSC에서 server-only chain 유지)
  const chatbotEmbedUrl = showHotelierUi ? getChatbotEmbedUrl() : '';

  return (
    <div data-role={mode} className="contents">
      {/* viewMode 진입 시 상단 배너 (호텔리어 본인은 viewMode 아님) */}
      {isViewMode && <ViewModeBanner userRole={userRole} />}

      {showHotelierUi && <EmergencyBanner />}
      {showHotelierUi && <Header />}

      {children}

      {showHotelierUi && <ChatbotFab embedUrl={chatbotEmbedUrl} />}
    </div>
  );
}
```

**왜 `className="contents"`?**: `<div>`로 감쌌을 때 부모의 flex/grid 흐름을 깨지 않기 위함. `display: contents`는 박스를 생성하지 않고 자식만 렌더링.

**`forceMode` 사용 사례**:
- `/admin` 영역에서 매니저가 시점 보기 모드를 켜도 어드민 페이지를 보고 있는 동안엔 UI가 깨지면 안 됨. → `(admin) layout`에서 `forceMode={user.role}` 명시 (auto-resolve 무시).
- 동작: 매니저가 어드민 작업 중에는 시점 보기가 비활성처럼 동작 (호텔리어 영역 진입 시에만 효과 발현).

> 단, 본 Phase에서 `forceMode`는 사용하지 않고 일관되게 `resolveRoleMode`로만 동작시킨다 (단순성). 매니저가 시점 보기 켠 상태로 어드민 페이지 진입 시 → 호텔리어 톤으로 보이지만, AdminNav 자체가 어드민 페이지에 노출되어 있어 혼란 가능. 이 경우 ViewModeBanner의 "돌아가기" 버튼이 영구 노출되므로 사용자가 즉시 인지 가능. (테스트 시나리오 T-12로 검증)

---

### 3.2 `<ViewModeBanner>` (신규, 클라이언트 컴포넌트)

**경로**: `components/layout/view-mode-banner.tsx`

**책임**: 시점 보기 모드 진입 시 상단에 영구 노란 배너 노출 + "돌아가기" 버튼.

**Props**:
```typescript
interface ViewModeBannerProps {
  userRole: 'admin' | 'manager';
}
```

**구현 스케치**:
```typescript
'use client';

import { useViewMode } from '@/lib/hooks/use-view-mode';
import { Eye, X } from 'lucide-react';

export function ViewModeBanner({ userRole }: ViewModeBannerProps) {
  const { clearViewMode } = useViewMode();
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 w-full border-b border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-2 text-sm sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 shrink-0" />
          <span className="font-medium">
            호텔리어 시점으로 보고 있습니다 ({userRole === 'admin' ? '어드민' : '매니저'} 계정)
          </span>
        </div>
        <button
          type="button"
          onClick={clearViewMode}
          className="inline-flex items-center gap-1 rounded-md bg-amber-200 px-2.5 py-1 text-xs font-medium hover:bg-amber-300 dark:bg-amber-900 dark:hover:bg-amber-800"
        >
          <X className="h-3 w-3" />
          {userRole === 'admin' ? '어드민' : '매니저'} 모드로 돌아가기
        </button>
      </div>
    </div>
  );
}
```

**z-index 정책**: `z-50` — EmergencyBanner와 동일. 단, 시점 보기 모드에서 EmergencyBanner와 동시 노출되면 둘 다 보이게 정렬(ViewModeBanner가 먼저 렌더되어 위쪽).

**색상**: amber 계열 사용 — 의도적으로 brand-* 와 다른 톤. 시점 보기는 "임시 상태"임을 시각적으로 명확히 표시. 다크모드 별도 처리.

---

### 3.3 `<ViewModeToggle>` (신규, 클라이언트 컴포넌트)

**경로**: `components/layout/view-mode-toggle.tsx`

**책임**: 아바타 드롭다운 내부 메뉴 아이템. 시점 보기 ON/OFF 토글.

**Props**:
```typescript
interface ViewModeToggleProps {
  currentMode: 'admin' | 'manager';  // 사용자의 실제 role
  variant?: 'menu-item' | 'switch';  // 드롭다운/스위치 형태
}
```

**구현 스케치**:
```typescript
'use client';

import { useViewMode } from '@/lib/hooks/use-view-mode';
import { Eye } from 'lucide-react';

export function ViewModeToggle({ currentMode, variant = 'menu-item' }: ViewModeToggleProps) {
  const { isViewMode, setHotelierView, clearViewMode } = useViewMode();

  if (isViewMode) {
    return (
      <button
        type="button"
        onClick={clearViewMode}
        className="..."
      >
        <Eye className="h-4 w-4" />
        {currentMode === 'admin' ? '어드민' : '매니저'} 모드로 돌아가기
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={setHotelierView}
      className="..."
    >
      <Eye className="h-4 w-4" />
      호텔리어 시점으로 보기
    </button>
  );
}
```

---

### 3.4 `<AdminUserMenu>` (신규, 클라이언트 컴포넌트)

**경로**: `app/(admin)/admin/_components/admin-user-menu.tsx`

**책임**: 어드민 영역의 우측 아바타 드롭다운. 프로필·시점토글·로그아웃 통합.

**구조**:
```
[👤 김매니저 ▼]   ← AdminNav 우측에 배치
  ├─ 매니저 정보 (이름·이메일·역할 배지)
  ├─ ─────
  ├─ 내 프로필 → /profile
  ├─ ─────
  ├─ <ViewModeToggle currentMode={role} />  ← 호텔리어 시점 보기
  ├─ ─────
  └─ 로그아웃 (ConfirmDialog)
```

**Headless UI 또는 Radix Popover 사용 여부**: 기존 프로젝트가 shadcn/ui 사용 중이므로 `<DropdownMenu>` 컴포넌트 (Radix 기반)가 이미 있을 가능성. 있으면 그대로 사용, 없으면 단순 토글 (useState + onClickOutside).

> Design 결정: 우선 단순 `useState + onClickOutside`로 구현. shadcn DropdownMenu 도입은 별도 작업 (본 PR 스코프 최소화).

---

### 3.5 `<Header>` 수정 (기존)

**경로**: `components/layout/header.tsx`

**기존 구조**:
- 호텔리어 GNB (NAV_ITEMS) — 모든 사용자에게 표시
- 데스크탑 + 모바일 메뉴
- isStaff(매니저/어드민)에게 "티켓큐", "어드민/매니저" 단축 버튼

**변경 사항**:
1. **호텔리어 GNB 노출은 `RoleScope`에서 결정** → Header 자체는 항상 호텔리어 콘텍스트 가정. `mode === 'hotelier'`일 때만 렌더링됨.
2. **isStaff 단축 버튼 유지** — 호텔리어 모드에서도 매니저/어드민은 어드민 영역 빠른 이동 필요. 단, **시점 보기 모드에서는 노출 안 함** (이미 시점 보기 배너에서 돌아가기 가능).

**변경 코드 발췌**:
```typescript
// 기존 (line 62)
const isStaff = user?.role === 'manager' || user?.role === 'admin';

// After
const { user, status } = useCurrentUser();
const { isViewMode } = useViewMode();
const isStaff = !isViewMode && (user?.role === 'manager' || user?.role === 'admin');
// 시점 보기 모드에서는 isStaff false — 호텔리어 시점 일관성 유지
```

**호텔리어 UX 영향**: 호텔리어 본인(`role === 'hotelier'`)은 isStaff=false 이미 처리됨. 변경 없음.

---

### 3.6 `<AdminNav>` 수정 (기존)

**경로**: `app/(admin)/admin/_components/admin-nav.tsx`

**기존 구조**:
- 한 줄에 10개 탭 가로 나열
- 매니저/어드민 배지
- "내 프로필 →" 끝에 추가
- 로그아웃 버튼 우측

**변경 사항**:
1. **메뉴 그룹화 (3그룹)**:
   - **티켓 운영**: 티켓 큐, 서비스 상태
   - **콘텐츠**: 아티클, 공지, FAQ, 체크리스트
   - **조직 & 마스터**: 사용자(admin), 호텔(admin), 마스터 데이터, 시스템 설정(admin)
2. **매니저용 자물쇠 메뉴**:
   - 사용자(🔒), 호텔(🔒), 시스템 설정(🔒) → `<button disabled>` + tooltip
   - **`<Link>` 사용 금지** (오류 가능성 E6 차단)
3. **"내 프로필 →" 제거** → `<AdminUserMenu>`로 통합
4. **로그아웃 버튼 제거** → `<AdminUserMenu>`로 통합

**변경 후 구조**:
```
┌─────────────────────────────────────────────────────────────────┐
│ [🛡 매니저] 티켓 운영 ▼ | 콘텐츠 ▼ | 조직&마스터 ▼     [👤 ▼] │
└─────────────────────────────────────────────────────────────────┘

[티켓 운영 ▼]      [콘텐츠 ▼]         [조직 & 마스터 ▼]
- 티켓 큐          - 아티클            - 사용자        🔒
- 서비스 상태      - 공지              - 호텔          🔒
                    - FAQ               - 마스터 데이터
                    - 체크리스트         - 시스템 설정    🔒
```

**구현 디테일**:
- 그룹 헤더는 hover/click으로 펼침 — 데스크탑은 hover, 모바일은 click
- 그룹 펼침 메뉴는 Popover (단순 div + onClickOutside)
- 자물쇠 메뉴는 클릭 시 toast 또는 inline tooltip "이 기능은 어드민 권한이 필요합니다"

**모바일 대응**: 좁은 화면(< 768px)에서는 그룹화 무시하고 한 줄 가로 스크롤로 노출. 자물쇠 메뉴는 모바일에서도 비활성.

---

### 3.7 `<UserNav>` 수정 (기존, 버그 픽스)

**경로**: `app/(user)/_components/user-nav.tsx`

**변경 핵심** (line 42-49):
```typescript
// Before (확정 버그)
{(role === 'admin' || role === 'manager') && (
  <Link
    href={role === 'admin' ? '/admin/users' : '/admin/users'}  // ← 둘 다 동일
    ...
  >
    {role === 'admin' ? '어드민' : '매니저'} 영역으로 →
  </Link>
)}

// After
{(role === 'admin' || role === 'manager') && (
  <Link
    href="/admin/tickets"  // 둘 다 티켓 큐로 (어드민·매니저 공통 진입점)
    className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
  >
    {role === 'admin' ? '어드민' : '매니저'} 영역으로 →
  </Link>
)}
```

**추가 변경**: 본 Phase에서 UserNav는 더 손대지 않음. AdminUserMenu와 같은 통합은 별도 작업.

---

## 4. 미들웨어 설계 — ❌ 미사용 결정

### 4.1 결정 배경

**Plan §6 C4**에서 NextAuth 미들웨어와의 충돌 위험 식별. 본 Design에서 다음 두 옵션을 검토:

| 옵션 | 장점 | 단점 |
|:-|:-|:-|
| **A. middleware 사용** | 라우트 진입 전 처리, 헤더 주입 가능 | `lib/auth.config.ts` chain 필요, edge runtime 제약, 빌드 복잡도 ↑ |
| **B. middleware 미사용** ✅ | NextAuth 무수정, edge runtime 제약 없음, 빌드 단순 | layout에서 `cookies()` 강제 dynamic — 단, 영향 layout 모두 이미 force-dynamic |

→ **B 채택**. 본 프로젝트는 `app/(admin)/admin/layout.tsx`, `app/(user)/layout.tsx` 모두 `export const dynamic = 'force-dynamic'` 이미 적용. 루트 `app/layout.tsx`는 EmergencyBanner가 DB 쿼리하므로 어차피 dynamic. 결국 미들웨어 도입 없이 cookies() 직접 read로 충분.

### 4.2 동작 흐름 (미들웨어 없음)

```
[Request] → app/layout.tsx
            ├─ RoleScope (RSC)
            │   ├─ auth() ← session 조회 (NextAuth jwt 디코딩, edge-safe)
            │   ├─ cookies().get('viewMode') ← Next.js dynamic API
            │   └─ resolveRoleMode(role, viewMode) → mode
            └─ <div data-role={mode}>{children}</div>
```

**성능 영향**:
- 기존: auth() + EmergencyBanner DB 쿼리 (dynamic)
- 변경 후: + cookies().get() 1회 (in-memory, 무시할 수준)

**캐싱**:
- 영향 페이지는 이미 dynamic. 추가 캐싱 손실 없음.
- 공개 페이지(예: `/faq`, `/help`)도 RoleScope의 영향으로 dynamic 강제될 수 있음 — 본 Phase의 trade-off.
  - 완화: RoleScope를 더 작은 단위로 분리하여 `/faq` 등이 ISR/SSG 가능하게 할 수 있지만, 본 Phase 범위 밖. 차후 최적화.

---

## 5. 쿠키 스펙

### 5.1 `viewMode` 쿠키

| 속성 | 값 | 비고 |
|:-|:-|:-|
| **이름** | `viewMode` | 단순한 이름 (다른 쿠키와 충돌 없음 확인됨) |
| **값** | `hotelier` (또는 미설정) | 'admin'/'manager'는 미사용. 시점 보기 OFF는 쿠키 삭제 |
| **Domain** | (생략) | 현재 도메인 (support.oapms.com) |
| **Path** | `/` | 전역 |
| **MaxAge** | 4시간 (14400초) | 업무 세션 길이 가정. 너무 길면 다음 날 켜놓고 출근한 사용자 혼란 |
| **HttpOnly** | `false` | 클라이언트에서 토글해야 하므로 false |
| **Secure** | `true` (프로덕션) / `false` (dev) | NODE_ENV로 분기 |
| **SameSite** | `Lax` | CSRF 방지 + 일반 네비게이션 허용 |
| **암호화/서명** | 없음 | UI 표시용. 위조해도 보안 영향 없음 (서버 권한은 `user.role` 기준) |

### 5.2 쿠키 라이브러리 (`lib/view-mode.ts`)

```typescript
// lib/view-mode.ts
import { cookies } from 'next/headers';

export const VIEW_MODE_COOKIE = 'viewMode';
export const VIEW_MODE_MAX_AGE = 60 * 60 * 4; // 4시간

export type ViewMode = 'hotelier' | null;

/** 서버에서 viewMode 읽기 */
export async function getViewMode(): Promise<ViewMode> {
  const cookieStore = await cookies();
  const value = cookieStore.get(VIEW_MODE_COOKIE)?.value;
  return value === 'hotelier' ? 'hotelier' : null;
}

/** 서버 액션 — viewMode 설정 */
export async function setViewMode(value: ViewMode): Promise<void> {
  const cookieStore = await cookies();
  if (value === null) {
    cookieStore.delete(VIEW_MODE_COOKIE);
  } else {
    cookieStore.set(VIEW_MODE_COOKIE, value, {
      path: '/',
      maxAge: VIEW_MODE_MAX_AGE,
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  }
}
```

### 5.3 클라이언트 hook (`lib/hooks/use-view-mode.ts`)

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { VIEW_MODE_COOKIE, VIEW_MODE_MAX_AGE } from '@/lib/view-mode';

export function useViewMode() {
  const router = useRouter();

  // 쿠키 직접 read (SSR-CSR 일관성: 서버에서 이미 RoleScope가 분기됨)
  const cookieValue = typeof document !== 'undefined'
    ? document.cookie
        .split('; ')
        .find((row) => row.startsWith(VIEW_MODE_COOKIE + '='))
        ?.split('=')[1]
    : undefined;

  const isViewMode = cookieValue === 'hotelier';

  const setHotelierView = useCallback(() => {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${VIEW_MODE_COOKIE}=hotelier; path=/; max-age=${VIEW_MODE_MAX_AGE}; samesite=lax${secure}`;
    router.refresh(); // RSC 재실행으로 RoleScope 결과 갱신
  }, [router]);

  const clearViewMode = useCallback(() => {
    document.cookie = `${VIEW_MODE_COOKIE}=; path=/; max-age=0; samesite=lax`;
    router.refresh();
  }, [router]);

  return { isViewMode, setHotelierView, clearViewMode };
}
```

**왜 server action이 아니라 document.cookie 직접 조작?**:
- 단순성·즉시성 — server action 호출 → 응답 대기 → revalidate 사이에 시각적 지연
- 위조 위험 없음 — UI 표시용이므로
- 단, SSR 시점 일관성을 위해 `router.refresh()` 호출

**대안**: server action으로 갈 경우 `'use server'` action에서 `setViewMode()` 호출 + `revalidatePath('/')`. 더 안전하지만 약간 더 느림.

### 5.4 호텔리어 본인은 쿠키 무시

```typescript
// lib/types/role-mode.ts
export type RoleMode = 'admin' | 'manager' | 'hotelier';

export function resolveRoleMode(
  userRole: UserRole | null,
  viewModeCookie: string | undefined,
): RoleMode {
  // 비로그인 → hotelier (기본 톤)
  if (!userRole) return 'hotelier';

  // 호텔리어는 viewMode 쿠키 무시 (본인은 항상 호텔리어 모드)
  if (userRole === 'hotelier') return 'hotelier';

  // manager/admin은 viewMode가 'hotelier'면 시점 보기 활성
  if (viewModeCookie === 'hotelier') return 'hotelier';

  return userRole; // 'manager' or 'admin'
}
```

---

## 6. CSS 토큰 시스템

### 6.1 토큰 매트릭스 (Tailwind 4 `@theme`)

```css
/* app/globals.css */
@import 'tailwindcss';
@plugin "tailwindcss-animate";

@custom-variant dark (&:where(.dark, .dark *));

/* ─────────────────────────────────────────────────────────────
   기본값 = 어드민 보라 (현재 토큰 유지)
   ───────────────────────────────────────────────────────────── */
@theme {
  --color-brand-50:  oklch(0.962 0.018 272.31);
  --color-brand-100: oklch(0.930 0.034 272.79);
  --color-brand-200: oklch(0.870 0.065 274.04);
  --color-brand-300: oklch(0.785 0.115 274.71);
  --color-brand-400: oklch(0.673 0.182 276.94);
  --color-brand-500: oklch(0.585 0.233 277.12);
  --color-brand-600: oklch(0.511 0.262 276.97);
  --color-brand-700: oklch(0.457 0.240 277.02);
  --color-brand-800: oklch(0.398 0.195 277.37);
  --color-brand-900: oklch(0.359 0.144 278.70);
  --color-brand-950: oklch(0.257 0.092 281.29);
}

/* ─────────────────────────────────────────────────────────────
   매니저 코발트 (Tailwind blue 팔레트)
   ───────────────────────────────────────────────────────────── */
[data-role='manager'] {
  --color-brand-50:  #eff6ff;
  --color-brand-100: #dbeafe;
  --color-brand-200: #bfdbfe;
  --color-brand-300: #93c5fd;
  --color-brand-400: #60a5fa;
  --color-brand-500: #3b82f6;
  --color-brand-600: #2563eb;
  --color-brand-700: #1d4ed8;
  --color-brand-800: #1e40af;
  --color-brand-900: #1e3a8a;
  --color-brand-950: #172554;
}

/* ─────────────────────────────────────────────────────────────
   호텔리어 진녹색 (Tailwind green 팔레트)
   ───────────────────────────────────────────────────────────── */
[data-role='hotelier'] {
  --color-brand-50:  #f0fdf4;
  --color-brand-100: #dcfce7;
  --color-brand-200: #bbf7d0;
  --color-brand-300: #86efac;
  --color-brand-400: #4ade80;
  --color-brand-500: #22c55e;
  --color-brand-600: #16a34a;
  --color-brand-700: #15803d;
  --color-brand-800: #166534;
  --color-brand-900: #14532d;
  --color-brand-950: #052e16;
}

@layer base {
  html,
  body {
    @apply bg-white text-slate-900;
  }
  html.dark,
  html.dark body {
    @apply bg-slate-950 text-slate-100;
  }
}
```

### 6.2 Selector 우선순위 검증

**Tailwind 4의 `@theme` 디렉티브가 생성하는 CSS**: `:root { --color-brand-*: ... }`
**오버라이드 셀렉터**: `[data-role='manager'] { --color-brand-*: ... }`

| Selector | Specificity | 우선순위 |
|:-|:-:|:-:|
| `:root` | (0,0,0,1) | 낮음 |
| `[data-role='manager']` | (0,0,1,0) | 높음 ✓ |

→ `data-role` 속성이 있는 노드 하위는 매니저/호텔리어 토큰이 적용됨. 정상 cascade.

### 6.3 CSS 변수 vs Tailwind className 호환성

기존 코드 예시:
```tsx
<button className="bg-brand-600 hover:bg-brand-500 text-white">
```

Tailwind 4의 컴파일 결과(개념):
```css
.bg-brand-600 { background-color: var(--color-brand-600); }
.hover\:bg-brand-500:hover { background-color: var(--color-brand-500); }
```

→ `var(--color-brand-600)`이 `data-role` 노드에서 새 값으로 해석. 컴포넌트 코드 무수정 ✓.

### 6.4 다크모드 검증 (Plan E4 리스크)

라이트 모드는 위 토큰 그대로. **다크모드도 동일 토큰 사용** — Tailwind의 `dark:` variant는 className 분기일 뿐, CSS 변수 자체를 바꾸지 않음.

예시:
```tsx
className="bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
```

- 라이트: `bg-brand-100` 사용 → `var(--color-brand-100)` 해석
- 다크: `bg-brand-900/40` 사용 → `var(--color-brand-900)` 해석 (alpha 40%)

**검증 필요한 시나리오** (QA Phase에서):
- 호텔리어 + 다크: `--color-brand-900: #14532d` × 40% alpha → 다크 배경 위 컨트라스트
- 매니저 + 다크: `--color-brand-900: #1e3a8a` × 40% alpha → 컨트라스트
- 어드민 + 다크: 현재 그대로

→ Tailwind green-900/40 = `rgb(20 83 45 / 0.4)`. 다크 슬레이트 배경(`bg-slate-950 = #020617`) 위 텍스트 `text-green-300 = #86efac` 콘트라스트 비 약 10:1 (충분).

→ Tailwind blue-900/40 = `rgb(30 58 138 / 0.4)`. 텍스트 `text-blue-300 = #93c5fd` 콘트라스트 비 약 9:1 (충분).

→ Phase 5 QA에서 자동화 검사 (Lighthouse 또는 axe-core).

---

## 7. 데이터 흐름 (시퀀스 다이어그램)

### 7.1 시나리오 — 매니저가 시점 보기 ON 클릭

```
사용자             브라우저              ViewModeToggle         AdminUserMenu     서버 (RSC)        next/navigation
  │                   │                       │                       │                 │                  │
  │  [👤 매니저 ▼ 클릭] │                       │                       │                 │                  │
  │  ─────────────────>│                       │                       │                 │                  │
  │                   │  [드롭다운 펼침]        │                       │                 │                  │
  │  [호텔리어 시점으로 보기 클릭]                  │                       │                 │                  │
  │  ──────────────────────────────────────────>│                       │                 │                  │
  │                   │                       │  setHotelierView()    │                 │                  │
  │                   │  document.cookie =     │                       │                 │                  │
  │                   │  'viewMode=hotelier'   │                       │                 │                  │
  │                   │<──────────────────────│                       │                 │                  │
  │                   │  router.refresh()      │                       │                 │                  │
  │                   │─────────────────────────────────────────────────────────────────────────────────>│
  │                   │                       │                       │                 │                  │
  │                   │                       │                       │       [RSC re-execute]            │
  │                   │                       │                       │       auth() → role=manager      │
  │                   │                       │                       │       cookies → viewMode=hotelier│
  │                   │                       │                       │       resolveRoleMode → 'hotelier'│
  │                   │  새 HTML stream        │                       │                 │                  │
  │                   │<───────────────────────────────────────────────────────────────────────────────────│
  │  [호텔리어 톤으로 화면 갱신 + 노란 배너 노출]                                                         │
  │<──────────────────│                       │                       │                 │                  │
  │                                                                                                       │
```

### 7.2 시나리오 — 매니저가 시점 보기 ON 상태에서 /admin/users 직접 접근

```
사용자             브라우저              서버 layout            permissions
  │                   │                       │                       │
  │  [/admin/users 입력]│                       │                       │
  │  ─────────────────>│                       │                       │
  │                   │  GET /admin/users      │                       │
  │                   │──────────────────────>│                       │
  │                   │                       │  (admin) layout       │
  │                   │                       │  requireRole(['manager','admin'])
  │                   │                       │  → manager 통과       │
  │                   │                       │                       │
  │                   │                       │  page.tsx             │
  │                   │                       │  requireRole(['admin'])
  │                   │                       │──────────────────────>│
  │                   │                       │  manager 불일치 → notFound()
  │                   │                       │<──────────────────────│
  │                   │  404 페이지            │                       │
  │<──────────────────│                       │                       │
  │  [404 — 시점 보기 ON 무관, 매니저 권한 부족]                          │
```

**핵심**: 시점 보기 ON 상태로도 권한 체크는 `user.role` 기준. UI만 호텔리어 톤.

---

## 8. 상태 관리

### 8.1 SSR 일관성 (Hydration mismatch 방지)

| 상태 | 서버에서 결정 | 클라이언트에서 결정 |
|:-|:-:|:-:|
| `data-role` 속성 | ✓ RoleScope (cookies + session) | ✗ (서버 결과 그대로) |
| RoleScope 자식 렌더링 | ✓ | ✗ |
| `isStaff` (Header) | ✗ | ✓ (useCurrentUser + useViewMode) |
| 아바타 드롭다운 open | ✗ | ✓ (useState) |
| ViewModeBanner 노출 | ✓ (props로 전달) | ✗ |

**Hydration mismatch 위험**: 서버에서 `viewMode=hotelier` 쿠키 읽음 → RoleScope `mode='hotelier'` → 호텔리어 UI 렌더. 클라이언트도 동일한 쿠키 읽음 → 일치.

**위험 시나리오**:
- 쿠키가 expire 직전 → 서버 read 시 valid, 클라이언트 read 시 expired → mismatch.
- 완화: `useViewMode`는 hydration 후 useEffect로 쿠키 재확인. 첫 렌더는 server result 사용.

### 8.2 useViewMode 훅의 hydration-safe 패턴

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { VIEW_MODE_COOKIE, VIEW_MODE_MAX_AGE } from '@/lib/view-mode';

export function useViewMode() {
  const router = useRouter();
  const [isViewMode, setIsViewMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const cookieValue = document.cookie
      .split('; ')
      .find((row) => row.startsWith(VIEW_MODE_COOKIE + '='))
      ?.split('=')[1];
    setIsViewMode(cookieValue === 'hotelier');
  }, []);

  const setHotelierView = useCallback(() => {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${VIEW_MODE_COOKIE}=hotelier; path=/; max-age=${VIEW_MODE_MAX_AGE}; samesite=lax${secure}`;
    setIsViewMode(true);
    router.refresh();
  }, [router]);

  const clearViewMode = useCallback(() => {
    document.cookie = `${VIEW_MODE_COOKIE}=; path=/; max-age=0; samesite=lax`;
    setIsViewMode(false);
    router.refresh();
  }, [router]);

  return { isViewMode: mounted ? isViewMode : false, setHotelierView, clearViewMode };
}
```

**`mounted` 패턴**: 첫 렌더는 항상 `false` 반환 → 서버 결과(RoleScope에서 결정된 컴포넌트 트리)와 일치. 마운트 후 실제 값 반영.

---

## 9. API/서버 액션

본 Phase에서 신규 서버 액션 없음. 쿠키 토글은 클라이언트에서 `document.cookie` 직접 조작 + `router.refresh()`로 처리.

향후 서버 액션 도입 시 (선택):
```typescript
// app/actions/view-mode-actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { setViewMode } from '@/lib/view-mode';
import { getCurrentUser } from '@/lib/permissions';

export async function toggleHotelierViewAction(enable: boolean) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  if (user.role === 'hotelier') return; // 호텔리어는 항상 자기 모드, 무시
  await setViewMode(enable ? 'hotelier' : null);
  revalidatePath('/', 'layout');
}
```

**현 Phase는 클라이언트 쿠키 조작 채택 이유**: 즉시성 + 단순성.

---

## 10. 에러 처리 & 엣지 케이스

| 케이스 | 동작 | 처리 |
|:-|:-|:-|
| viewMode 쿠키 값이 'admin' 등 의도치 않은 값 | resolveRoleMode가 'hotelier'만 검사하므로 무시 → user.role 사용 | ✅ 안전 |
| 호텔리어가 viewMode 쿠키 직접 set (devtools) | resolveRoleMode가 hotelier role은 쿠키 무시 → 항상 hotelier | ✅ 안전 |
| 비로그인 사용자에 viewMode 쿠키 잔존 | userRole=null이므로 resolveRoleMode → 'hotelier' (쿠키 무관) | ✅ 안전 |
| ViewModeBanner 클릭 후 router.refresh 실패 | 쿠키만 변경되고 UI 갱신 안 됨 | 페이지 새로고침 fallback. 단, 통상 fail 안 함. |
| 다중 탭 동기화 | 한 탭에서 켜면 다른 탭은 navigate/refresh 전까지 반영 안 됨 | 본 Phase 미해결. 차후 storage event listener 도입 가능 |
| Server Component에서 cookies() 호출이 dynamic 강제 | 영향 페이지 이미 dynamic | ✅ 영향 없음 |
| `data-role` 속성이 `<html>` 다크모드 클래스와 충돌 | next-themes는 `<html class="dark">`, 본 Design은 div 단위 `data-role`. 노드 다름. | ✅ 충돌 없음 |
| ChatbotFab의 기존 `/admin/*` 제외 로직과 RoleScope의 노출 제어 중복 | RoleScope에서 mode!==hotelier면 아예 렌더 안 함 → ChatbotFab의 내부 체크는 안전한 fallback | ✅ 안전 (이중 방어) |
| EmergencyBanner의 DB 쿼리가 어드민 영역에서도 발생하는 비효율 | RoleScope에서 mode!==hotelier면 렌더 안 함 → DB 쿼리 자체 발생 안 함 | ✅ 성능 개선 부수 효과 |

---

## 11. 접근성 (a11y)

### 11.1 ARIA & 시멘틱

| 요소 | 속성 | 비고 |
|:-|:-|:-|
| ViewModeBanner | `role="status"` `aria-live="polite"` | 알림 영역 |
| "돌아가기" 버튼 | `aria-label="..."` (시각 텍스트와 일치) | 명확성 |
| 자물쇠 메뉴 | `disabled`, `aria-disabled="true"`, `title="..."` | 접근성 + 호버 tooltip |
| AdminUserMenu trigger | `aria-haspopup="menu"`, `aria-expanded={open}` | 드롭다운 |
| AdminNav 그룹 | `aria-label="티켓 운영"` 등 | 그룹 식별 |

### 11.2 키보드 네비

- 아바타 드롭다운 — `Tab` 진입 → `Enter`/`Space` 열기 → 화살표 이동 → `Esc` 닫기
- 자물쇠 메뉴는 `Tab` 순서에서 제외 (`tabIndex={-1}`) 또는 disabled
- ViewModeBanner의 "돌아가기"는 `Tab`으로 접근 가능

### 11.3 색맹 보완

- 역할 표시는 컬러 외에도 **배지(🛡 어드민/매니저)** + **아이콘** 동시 사용
- 자물쇠는 `🔒` 아이콘으로 권한 부족 표시 (색만으로 표현하지 않음)
- ViewModeBanner는 색 + 텍스트 + 아이콘 3중 표현

---

## 12. 테스트 시나리오

### 12.1 기능 시나리오 (9건)

| ID | 시나리오 | 기대 결과 |
|:-:|:-|:-|
| T-01 | 비로그인 사용자가 / 진입 | 호텔리어 톤(녹색), 헤더·챗봇 FAB 정상 노출 |
| T-02 | hotelier 로그인 후 / 진입 | 호텔리어 톤, 헤더·챗봇 FAB 정상 노출 |
| T-03 | manager 로그인 후 / 진입 | 매니저 톤(코발트), 헤더에 "티켓큐"·"매니저" 단축 버튼 노출 |
| T-04 | manager 로그인 후 /admin/tickets 진입 | 매니저 톤, 호텔리어 헤더·챗봇 FAB·EmergencyBanner 비노출, AdminNav 노출 |
| T-05 | admin 로그인 후 /admin/users 진입 | 어드민 톤(보라), 정상 페이지 |
| T-06 | manager 로그인 후 /admin/users 직접 입력 | 404 (권한 부족) |
| T-07 | manager 로그인 후 /profile에서 "매니저 영역으로 →" 클릭 | /admin/tickets로 정상 이동 (404 발생 안 함) |
| T-08 | manager 로그인 후 AdminUserMenu → "호텔리어 시점으로 보기" 클릭 | 호텔리어 톤으로 즉시 전환, 노란 배너 노출, 헤더·챗봇 FAB 노출 |
| T-09 | T-08 상태에서 "매니저 모드로 돌아가기" 클릭 | 매니저 톤으로 복귀, 배너 사라짐 |

### 12.2 시각 시나리오 (6건)

| ID | 시나리오 | 확인 항목 |
|:-:|:-|:-|
| V-01 | admin × 라이트 | 기존 보라색 톤 그대로 (회귀 없음) |
| V-02 | admin × 다크 | 기존 보라색 다크 톤 그대로 |
| V-03 | manager × 라이트 | 코발트 블루, brand-100 옅은 파랑 배경 정상 |
| V-04 | manager × 다크 | 코발트 블루 다크 톤, WCAG AA 4.5:1 충족 |
| V-05 | hotelier × 라이트 | 진녹색, brand-100 옅은 녹색 배경 정상 |
| V-06 | hotelier × 다크 | 진녹색 다크 톤, WCAG AA 4.5:1 충족 |

### 12.3 회귀 시나리오 (3건)

| ID | 시나리오 | 확인 |
|:-:|:-|:-|
| R-01 | 기존 50+ brand-* 파일 시각 정상 | /tickets, /admin/tickets, /faq, /help, /status, /notices 등 각 1개씩 캡처 비교 |
| R-02 | 모바일(< 768px) 헤더·메뉴 정상 | iPhone 12 viewport에서 햄버거 메뉴 정상 토글 |
| R-03 | 다크모드 토글 정상 동작 | 라이트 ↔ 다크 전환 시 모든 컴포넌트 정상 렌더 |

---

## 13. 구현 순서 (실제 PR 작업 단위)

### 13.1 Commit 단위 분리

> 각 commit은 빌드 통과 + 작동 가능 상태.

| Commit | 내용 | 영향 |
|:-:|:-|:-|
| 1 | `lib/types/role-mode.ts` + `lib/view-mode.ts` + `lib/hooks/use-view-mode.ts` 신규 | 코드 추가만, 사용처 0 |
| 2 | `app/globals.css` 토큰 추가 | data-role 없으면 동작 안 함 (no-op) |
| 3 | `app/(user)/_components/user-nav.tsx` line 44 버그 수정 | 매니저 404 즉시 해소 |
| 4 | `components/layout/role-scope.tsx` 신규 + `app/layout.tsx` 적용 | 호텔리어 UI 분리 + 토큰 활성화 |
| 5 | `(admin) layout` `data-role` 부여 + `(user) layout` `data-role` 부여 | 역할별 톤 적용 |
| 6 | `components/layout/view-mode-banner.tsx` + `view-mode-toggle.tsx` 신규 | 컴포넌트만 (사용처 0) |
| 7 | `app/(admin)/admin/_components/admin-user-menu.tsx` 신규 + AdminNav 통합 | 아바타 드롭다운 + 시점 토글 활성화 |
| 8 | AdminNav 메뉴 그룹화 + 자물쇠 | 메뉴 구조 개편 (시각 변경 큼) |
| 9 | Header `isStaff` viewMode 분기 | 시점 보기 일관성 |
| 10 | QA 시나리오 18건 확인 + HTML 일지 작성 | 최종 검수 |

### 13.2 빌드 가능성 검증

각 commit 종료 시점에:
- `npm run build` 통과
- `npm run typecheck` (또는 build 내장 typecheck) 통과
- `npm run lint` warning 추가 0

### 13.3 롤백 전략

- **Commit 4 이전**: 즉시 revert. 시각 변경 0.
- **Commit 4~8**: revert 가능. 단일 PR 내라면 reset 가능.
- **Commit 9 이후 (배포 후)**: viewMode 쿠키 강제 만료 + RoleScope 비활성화 flag(`?disable-role-scope=1`) 도입 검토. 본 Phase에선 미구현, 차후 운영 룰북에 명시.

---

## 14. Plan 리스크 재검토 결과

Plan §6의 리스크가 Design 결정으로 어떻게 해소됐는지 확인.

| Plan 리스크 ID | Design 해소 |
|:-|:-|
| **C1. amber-* 시각 충돌** | ViewModeBanner에 amber 의도 사용 (시점 보기 = 임시 상태 의미). 기존 amber(티켓 큐 강조)는 호텔리어 모드에선 안 보임 (Header 자체 노출 안 됨). 모드별 amber 사용처가 자연스럽게 분리됨. ✅ |
| **C2. brand-50/100 다크 차이 부족** | V-04, V-06 시나리오로 검증. 부족 시 후속 토큰 조정. ✅ |
| **C3. data-role cascade portal 미적용** | `<div data-role>` 외에 `<body>` 또는 `<html>`도 동시 적용 검토 — 단, 본 Phase에서는 portal 사용 컴포넌트(ConfirmDialog 등)가 brand-* 사용 시에만 문제. 사전 grep으로 확인 후 필요 시 보강. 현재 grep 결과 ConfirmDialog가 brand-* 미사용 → 영향 없음. ✅ |
| **C4. NextAuth 미들웨어 충돌** | **미들웨어 사용 안 함 결정**으로 자동 해소. ✅✅ |
| **D1~D3. 중복** | AdminUserMenu 통합으로 D2 해소. D1·D3은 별도 Phase. ✅ (부분) |
| **E1. UserNav 404 버그** | Commit 3에서 즉시 수정. ✅ |
| **E2. SSR/CSR hydration** | useViewMode의 `mounted` 패턴으로 해소. ✅ |
| **E3. ChatbotFab embedUrl 미설정** | 기존 fallback 로직 그대로. RoleScope는 mode!==hotelier면 ChatbotFab 자체를 렌더 안 함. ✅ |
| **E4. 다크모드 가독성** | V-04/V-06 + Lighthouse 자동 검사. ✅ |
| **E5. 시점 보기 쿠키 다중 탭** | 본 Phase 미해결, 운영 룰북에 명시. (스코프 외) |
| **E6. 자물쇠 메뉴 클릭 404** | `<button disabled>` + aria-disabled로 강제 차단. Link 사용 금지 명시. ✅ |
| **E7. cookies() 강제 dynamic** | 영향 layout 이미 dynamic. 추가 비용 무시할 수준. ✅ |
| **R1. 50+ 파일 회귀** | 토큰만 추가 (`@theme` 영역 무수정 + 새 셀렉터 추가), 기존 brand-* className 0줄 수정. R-01 시나리오로 검증. ✅ |
| **R2. 비로그인 페이지 헤더 정책** | resolveRoleMode가 userRole=null → 'hotelier' 반환 → 헤더·챗봇 FAB 정상 노출. ✅ |
| **R3. 모바일 메뉴 회귀** | Header markup 무변경 (props만 추가). R-02 시나리오로 검증. ✅ |
| **R4. next-themes 충돌** | next-themes는 `<html class="dark">`, 본 Design은 `<div data-role>`. 노드 다름, 충돌 0. ✅ |

**결론**: 16개 리스크 중 14개 즉시 해소, 2개(E5 다중 탭, D1·D3 일부 중복)는 의도적으로 차후 Phase로 분리.

---

## 15. 미해결 의사결정 (Open Questions)

| ID | 질문 | 기본 선택 | 변경 시 영향 |
|:-:|:-|:-|:-|
| Q-1 | viewMode를 쿠키 vs sessionStorage? | 쿠키 (서버에서 읽기 위함) | sessionStorage면 SSR 불가 → 첫 렌더 깜빡임 |
| Q-2 | AdminUserMenu에 shadcn DropdownMenu 도입? | 단순 useState (스코프 축소) | shadcn 사용 시 접근성·UX 자동 보장. 별도 PR로 분리 가능 |
| Q-3 | as.oapms.com 정확한 HEX 재확인? | Plan의 잠정 `#166534` 유지 | 사용자가 dev tools로 확인 후 토큰 11개만 교체 |
| Q-4 | 매니저 시점 보기 중 /admin/* 진입 시 톤? | 자동 분기 (호텔리어 톤) — 사용자가 ViewModeBanner로 인지 | forceMode 도입 시 어드민 영역은 항상 매니저 톤 유지 (혼란 감소) |
| Q-5 | 서버 액션 vs document.cookie? | document.cookie (즉시성) | 서버 액션으로 변경 시 보안·검증 강화 |

---

## 16. 다음 단계

1. **본 Design 사용자 승인** → 미해결 의사결정 Q-1~Q-5 확정
2. **`/pdca do role-mode-ui`** — Phase 1부터 순차 구현
   - Commit 1~3 (P0): 0.5일 — 토큰 라이브러리 + 버그 수정
   - Commit 4~5 (P0): 0.5일 — RoleScope 적용
   - Commit 6~9 (P1~P2): 2일 — 시점 보기 + AdminNav 재구조화
   - Commit 10 (QA): 1일 — 시나리오 18건 + HTML 일지
3. **`/pdca analyze role-mode-ui`** — Gap 분석
4. **`/pdca report role-mode-ui`** — 완료 보고서

---

## 부록 A. 디렉토리 트리 (변경 후)

```
app/
├── globals.css                              [수정]
├── layout.tsx                                [수정]
├── (admin)/
│   └── admin/
│       ├── layout.tsx                        [수정]
│       └── _components/
│           ├── admin-nav.tsx                 [수정]
│           └── admin-user-menu.tsx           [신규]
├── (user)/
│   ├── layout.tsx                            [수정]
│   └── _components/
│       └── user-nav.tsx                      [수정]
components/
├── layout/
│   ├── header.tsx                            [수정]
│   ├── role-scope.tsx                        [신규]
│   ├── view-mode-banner.tsx                  [신규]
│   ├── view-mode-toggle.tsx                  [신규]
│   ├── emergency-banner.tsx                  [무변경]
│   └── ...
├── chatbot/
│   └── chatbot-fab.tsx                       [무변경]
lib/
├── view-mode.ts                              [신규]
├── types/
│   └── role-mode.ts                          [신규]
├── hooks/
│   ├── use-current-user.ts                   [무변경]
│   └── use-view-mode.ts                      [신규]
├── auth.ts                                   [무변경]
├── auth.config.ts                            [무변경]
└── permissions.ts                            [무변경]
```

## 부록 B. 참조

- Plan 문서: `docs/01-plan/features/role-mode-ui.plan.md`
- Tailwind CSS 4 `@theme` directive: https://tailwindcss.com/docs/v4-beta#using-the-theme-directive
- Next.js 15 `cookies()`: https://nextjs.org/docs/app/api-reference/functions/cookies
- WCAG 2.2 AA: 색 대비 4.5:1
- 직전 진단 보고서 (대화 #1): Action 1~7 매트릭스
