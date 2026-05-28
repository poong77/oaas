# Plan — 어드민/매니저 좌측 사이드바 레이아웃 (admin-sidebar-layout)

> **Feature**: admin-sidebar-layout — staff(어드민·매니저) 콘솔의 상단 탭 내비게이션을 좌측 사이드바로 전환
> **Phase**: Plan
> **작성일**: 2026-05-28
> **작성자**: Claude (풀스택 CTO·UX/UI 디자이너·CS 운영 책임자 3관점 합의)
> **선행 의존성**: role-mode-ui (Do 단계 완료, 2026-05-28)

---

## Executive Summary

| 항목 | 값 |
|:-|:-|
| **Feature** | admin-sidebar-layout — staff(어드민·매니저) 콘솔 좌측 사이드바 전환 |
| **표시 조건** | `viewMode='staff'` 에서만 사이드바 노출 (호텔리어 모드는 기존 상단 헤더 유지) |
| **저장 매체** | 쿠키 (`sidebarCollapsed`) — SSR 첫 렌더 깜빡임 0 |
| **사이드바 폭** | 펼침 240px / 접힘 56px (한글 메뉴명 + 자물쇠 아이콘 여유) |
| **단축키** | `[` (접기) · `]` (펼치기) — VSCode 패턴, 브라우저 충돌 회피 |
| **모바일 대응** | shadcn/ui Sheet 드로어 + 별도 `<AdminMobileHeader>` 햄버거 트리거 |
| **시작일** | 2026-05-29 |
| **예상 완료** | 2026-06-05 (영업일 5일) |
| **총 공수** | P0 1일 + P1 2일 + QA 1일 + 회귀 1일 = 약 5일 |
| **변경 파일 추정** | 신규 4개 + 수정 3개 + 삭제 1개 (AdminNav → 사이드바로 이전) |
| **Match Rate 목표** | ≥ 90% |

### 가치 전달 (4관점)

| 관점 | 내용 |
|:-|:-|
| **Problem (문제)** | 상단 탭 9개가 한 줄에 펼쳐져 메뉴 그룹 구분이 시각적으로 약하고, 본문 폭이 충분히 활용되지 못한다. CS 매니저는 티켓 큐에 80% 시간을 머무는데, 큐 상황(미처리 카운트·실시간 도착)이 메뉴 영역에 표시되지 못한다. 데스크탑 27인치에서 본문 max-width 1280px와 상단 메뉴 영역이 같은 행을 공유해 정보 밀도가 비효율적이다. |
| **Solution (해법)** | ① staff 콘텍스트에서 좌측 240px 사이드바 + 본문 grid 레이아웃. ② 쿠키 기반 collapsed 상태로 SSR 깜빡임 0. ③ AdminShell(RSC) + AdminSidebar(CSC) 분리로 메뉴 정의는 단일 데이터 소스. ④ 데스크탑 사이드바와 모바일 Sheet 드로어가 동일 NavItem 컴포넌트 공유. ⑤ 사이드바 footer에 AdminUserMenu·viewMode 토글 통합. ⑥ 미래의 티켓 카운트 배지·자리비움 토글을 위한 "확장 슬롯" 사전 마련. |
| **Function UX Effect** | 매니저는 사이드바를 펼친 상태로 티켓 큐에 머물며 다른 메뉴(아티클·FAQ)를 1클릭으로 잠깐 다녀온다. 27인치 모니터에서 본문 영역(1280px)은 그대로 유지되고 좌측에 240px 메뉴가 영구 노출. 모바일은 햄버거 → Sheet 풀-스크린 메뉴. 접힘 모드에서는 아이콘만 56px 폭으로 본문 압박 최소화. 학습 곡선 완화를 위해 첫 진입 1회 투어 + 2주 베타 노출. |
| **Core Value** | "**메뉴 영역의 영구 가시성** + **본문 폭 보존** + **확장 가능한 사이드바 슬롯**" — CS 매니저의 일과 흐름(티켓 큐 80% + 메뉴 잠깐 이동)에 맞춰 메뉴를 항상 보이게 하고, 향후 카운트 배지·자리비움 등 운영 KPI 신호를 자연스럽게 얹을 자리를 마련한다. |

---

## 1. 배경 & 목적

### 1.1 배경

직전 작업 role-mode-ui로 viewMode='staff'/'hotelier' 분기 + 3역할 컬러 토큰이 도입되었다. 그러나 staff(어드민·매니저) 콘솔의 메뉴 내비게이션은 여전히 상단 탭 9개 한 줄 구조로 남아있다.

사용자 요청 본문:
> "어드민, 매니저의 관리 메뉴 인터페이스가 현재는 상단 바에 메뉴가 있는데 이걸 좌측 사이드바로 옮기면 어떨까? 화면은 최대한 넓게 쓰도록 하고 사이드바 접기/열기 기능 있고."

### 1.2 3 관점 합의 결과

**풀스택 CTO 관점** — 쿠키 기반 collapsed 상태 + RSC AdminShell + CSC AdminSidebar 하이브리드. SSR 첫 렌더에 collapsed 적용 가능. `next-themes`식 inline script 불필요(쿠키로 100% 결정 가능). 본문 max-width는 1차 PR에서 유지(회귀 위험 완화). RoleScope는 mode 계산에만 집중, AdminShell이 viewMode를 prop으로 받아 사이드바 분기.

**UX/UI 디자이너 관점** — 폭 240/56, 활성 표시는 left border 3px + subtle bg(접힘 상태에서도 식별 가능). 접힘 hover flyout(딜레이 200ms, position:fixed overlay)으로 본문 레이아웃 흔들림 0. 단축키 `[` `]`. 사이드바 배경은 role 컬러와 무관한 중립색(neutral-900 / white) 고정 후 accent만 brand-* 적용. `transform: translateX` 금지(fixed 요소 z-index 깨짐).

**CS 운영 책임자 관점** — 매니저는 **늘 펼친 상태가 기본**(티켓 큐 80% + 메뉴 잠깐 이동). 사이드바 도입의 진짜 가치는 ① 미처리 티켓 카운트 배지 ② 본인 vs 전체 큐 분리 ③ 새 티켓 실시간 도착 표시. 그 위에 자리비움 토글(P1)·오늘 처리 카운터(P1). **자물쇠 메뉴 노출 유지**(매니저-어드민 소통 비용 절감). 출시 후 KPI: 첫 응답 시간 5~10% 단축 기대, 처리시간 일시 증가(학습 곡선).

### 1.3 본 Phase의 분리 결정

CS 책임자가 강조한 ① 티켓 카운트 배지 ② 자리비움 토글 ③ 새 티켓 알림 ④ 오늘 처리 카운터는 **본 Phase에 슬롯만 마련하고 실제 데이터 연동은 후속 Phase**로 분리한다. 이유:

- 본 Phase는 **레이아웃 전환**이 핵심. 데이터 연동은 SSE/polling 결정, 티켓 도메인 데이터 모델, 알림 정책(소리·desktop notification) 등 별도 의사결정 필요.
- 단일 PR이 비대해지면 회귀 위험·리뷰 부담 증가.
- 슬롯만 마련하면 후속 Phase는 사이드바 footer/메뉴 옆에 컴포넌트만 끼우면 됨.

---

## 2. Goals & Non-Goals

### 2.1 Goals (이번 Phase 필수 달성)

1. **G1**. viewMode='staff' 상태에서 좌측 240px 사이드바가 노출되고, viewMode='hotelier' 상태에서는 사이드바가 노출되지 않는다.
2. **G2**. 사이드바 접기/펼치기 토글이 작동하고, 쿠키로 상태가 유지되어 SSR 첫 렌더 깜빡임 0.
3. **G3**. 접힘 상태(56px)에서 아이콘 위 hover tooltip으로 메뉴명을 식별할 수 있다.
4. **G4**. 자물쇠 메뉴(매니저에게 admin-only)는 접힘 상태에서도 Lock 배지 오버레이로 식별 가능.
5. **G5**. 모바일(<lg) 화면에서는 사이드바가 Sheet 드로어로 전환되고, 상단 컴팩트 헤더에 햄버거 트리거가 위치한다.
6. **G6**. 단축키 `[` `]` 로 접기/펼치기 작동.
7. **G7**. AdminUserMenu가 사이드바 footer로 이전되고, "호텔리어 시점으로 보기" 토글이 드롭다운 마지막 항목에 포함된다.
8. **G8**. role-mode-ui의 viewMode 분기·자물쇠 표시·매니저 UserNav 버그 수정은 회귀 없이 유지된다.
9. **G9**. 본문 max-width(`max-w-7xl=1280px`)는 1차 PR에서 유지하여 `/admin/*` 페이지 회귀 위험 최소화.
10. **G10**. 향후 티켓 카운트 배지·자리비움 토글이 들어갈 "확장 슬롯"이 사이드바 footer/메뉴 옆에 명시적으로 마련된다.

### 2.2 Non-Goals (이번 Phase 범위 밖)

1. ❌ 티켓 카운트 배지의 **실제 데이터 연동** (별도 Phase: sidebar-ticket-badge).
2. ❌ 자리비움/Online·Away 토글의 **상태 저장 및 다른 매니저 가시화** (별도 Phase).
3. ❌ 새 티켓 실시간 알림 (SSE/WebSocket·desktop notification·소리, 별도 Phase).
4. ❌ 오늘 처리 카운터(개인 KPI 위젯) — 별도 Phase.
5. ❌ 본문 max-width 정책 변경 — 페이지별 최적화는 2차 PR에서.
6. ❌ 호텔리어 콘솔의 좌측 사이드바 도입 — 호텔리어는 기존 상단 헤더 GNB 유지.
7. ❌ 메뉴 검색/즐겨찾기/북마크 등 고급 기능 — 향후 검토.

---

## 3. 사용자별 시나리오 (Before / After)

### 3.1 시나리오 A. 매니저가 출근하여 티켓 큐를 본다 (데스크탑 듀얼모니터)

**Before** (현재 상단 탭)
```
[헤더: brand 헤더]                                          [어드민/매니저 시점토글, 아바타]
─────────────────────────────────────────────────────────────────────────────────────
[🛡 매니저] 티켓 운영(2) | 콘텐츠(4) | 조직&마스터(3)                              [👤 ▼]
─────────────────────────────────────────────────────────────────────────────────────
        ↓ 본문 max-w-7xl (좌우 여백 큼)
        ┌────────────────────────────────────────────┐
        │ 티켓 큐 테이블                              │
        │                                            │
        └────────────────────────────────────────────┘
```
- 27인치 모니터에서 좌우 여백이 본문보다 크게 보임
- 미처리 티켓 수가 메뉴 어디에도 안 보임
- 새 티켓 도착 시 헤더에 표시 공간 없음

**After** (좌측 사이드바)
```
┌────┬──────────────────────────────────────────────────────────┐
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│240 │  본문 max-w-7xl                                          │
│    │  ┌────────────────────────────────────────────────────┐ │
│ 티켓│  │ 티켓 큐 테이블                                      │ │
│ 운영│  │                                                    │ │
│ ▸큐 │  │                                                    │ │
│ 상태│  │                                                    │ │
│ ─── │  │                                                    │ │
│ 콘텐│  │                                                    │ │
│ 츠 │  │                                                    │ │
│ ─── │  │                                                    │ │
│ 조직│  │                                                    │ │
│ ─── │  │                                                    │ │
│ [확장 슬롯: 카운트 배지·자리비움 P1] │
│ ─── │  │                                                    │ │
│ 👤  │  │                                                    │ │
│ ──> │  │                                                    │ │
└────┴──────────────────────────────────────────────────────────┘
```
- 메뉴 항상 보임, 클릭 거리 짧음
- 활성 메뉴는 left border 3px + subtle bg
- 27인치에서도 본문 1280px 유지, 좌측에 메뉴 240px

### 3.2 시나리오 B. 매니저가 상세 티켓을 작업하며 본문을 넓게 쓰고 싶다

**After**
- 사이드바 하단 토글 클릭 또는 `[` 키 → 56px 접힘
- 아이콘만 보이고 본문이 더 넓어짐 (1280px max는 유지)
- 활성 메뉴는 left border 3px로 여전히 식별
- 접힘 상태에서 hover → 200ms 후 flyout(메뉴명 + 그룹)
- 다시 `]` 키 또는 토글 → 240px 펼침

### 3.3 시나리오 C. 모바일(아이폰)로 매니저가 외부에서 티켓 확인

**After**
- 좌측 사이드바 미노출, 상단 컴팩트 헤더(`[햄버거] [로고] [역할 뱃지] [👤]`)
- 햄버거 클릭 → Sheet 드로어(좌측 280px)
- Sheet 최상단 viewMode 배너("호텔리어 시점으로 보기")
- 메뉴 항목 동일

### 3.4 시나리오 D. 어드민이 매니저 시점으로 보기 ON

**After**
- 어드민 콘솔에서 AdminUserMenu(사이드바 footer) → "호텔리어 시점으로 보기" 클릭
- viewMode 쿠키 변경 → router.refresh → 사이드바 unmount + 호텔리어 헤더 mount
- 노란 ViewModeBanner 노출 (role-mode-ui 기존 동작)
- 다시 "어드민 모드로 돌아가기" → 사이드바 재mount

---

## 4. 사이드바 구조 명세

### 4.1 폭·활성 표시·그룹

| 항목 | 값 | 근거 |
|:-|:-|:-|
| 펼친 폭 | **240px** (`w-60`) | 한글 메뉴명 + 아이콘 + 자물쇠 아이콘 여유 |
| 접힌 폭 | **56px** (`w-14`) | 아이콘 40px + 좌우 패딩 8px |
| 활성 표시 | **left border 3px + subtle bg** (`bg-brand-100/40` 또는 다크 `bg-brand-900/30`) | 접힘 상태에서도 식별 가능 |
| 섹션 헤더 (펼침) | 대문자 + muted 컬러 (`text-xs uppercase tracking-wider text-slate-500`) | 그룹 식별 |
| 섹션 헤더 (접힘) | **완전 숨김**, 8px gap만 | 잘려 보이는 텍스트 방지 |
| 자물쇠 메뉴 (펼침) | 메뉴 우측 Lock 아이콘 + disabled | 기존 디자인 유지 |
| 자물쇠 메뉴 (접힘) | 아이콘 우하단 Lock 배지 오버레이 (10px, opacity 50%) | 접힘 상태에서도 disabled 의미 전달 |
| 사이드바 배경 | **role 컬러 무관 중립색** (라이트: `bg-white`, 다크: `bg-slate-950`) | 역할 컬러는 accent에만 제한 |

### 4.2 접기/펼치기 인터랙션

| 항목 | 값 |
|:-|:-|
| 토글 버튼 위치 | **사이드바 하단 고정** (footer AdminUserMenu 위) |
| 토글 아이콘 | `PanelLeftClose` (펼침 상태) / `PanelLeftOpen` (접힘 상태) — lucide |
| 단축키 | **`[`** (접기) / **`]`** (펼치기) — 입력 필드 focus 시 무시 |
| 접힘 hover flyout | **도입**. 딜레이 200ms, `position: fixed` overlay (본문 레이아웃 영향 0) |
| 트랜지션 | `transition-[width] duration-200 ease-in-out` |
| 텍스트 페이드 | 접힐 때 `opacity-0` 100ms → width 200ms 순서 stagger |
| prefers-reduced-motion | `motion-safe:transition-[width]` 로 모션 해제 시 즉시 전환 |

### 4.3 모바일 대응

| 항목 | 값 |
|:-|:-|
| 브레이크포인트 | `lg` (1024px). lg 미만에서 사이드바 → Sheet |
| Sheet 폭 | 280px |
| 컴팩트 헤더 | `[햄버거] [로고/서비스명] [역할 뱃지] [👤 아바타]` 4-item |
| 컴팩트 헤더 위치 | `sticky top-0 z-40` |
| Sheet 내부 viewMode 토글 | **최상단 배너형** 배치 |
| Sheet 닫힘 시 a11y | `aria-hidden="true"` + `inert` 속성 동시 적용 |

### 4.4 사용자 식별 영역 (사이드바 footer)

```
[펼침 상태]
  ─────────────────
  [<<] 사이드바 접기                  ← 토글
  ─────────────────
  [👤 김매니저] 매니저 ▼              ← AdminUserMenu (펼침)
  ─────────────────

[접힘 상태]
  ──
  [<<]                                ← 토글 (아이콘만)
  ──
  [👤]                                ← 아바타만 (클릭 시 absolute popup)
  ──
```

AdminUserMenu 드롭다운 내부:
```
김매니저
sijzoom@gmail.com
[매니저 뱃지]
─────────────
내 프로필 → /profile
─────────────
호텔리어 시점으로 보기                 ← ViewModeToggle
─────────────
로그아웃                                ← ConfirmDialog
```

### 4.5 확장 슬롯 (P0 슬롯만 마련, 데이터 연동은 P1)

| 슬롯 | 위치 | P1 도입 예정 |
|:-|:-|:-|
| **티켓 큐 옆 카운트 배지** | "티켓 큐" 메뉴 항목 우측 | 미처리 티켓 수 (빨간 숫자) |
| **본인/전체 큐 토글** | 티켓 운영 그룹 헤더 옆 | 본인 담당만 vs 전체 |
| **새 티켓 도착 알림** | 사이드바 상단 또는 큐 메뉴 우측 점 | SSE/polling 도착 즉시 표시 |
| **자리비움 토글** | footer 상단 (사용자 영역 위) | Online / Away 토글 |
| **오늘 처리 카운터** | footer 또는 사이드바 하단 | 개인 KPI 위젯 |

본 Phase는 슬롯의 위치만 코드 주석/placeholder로 마련하고 실제 컴포넌트는 후속 Phase에서 끼운다.

---

## 5. 기술 아키텍처

### 5.1 컴포넌트 분리

```
app/(admin)/admin/
├── layout.tsx                       [수정] grid 전환, AdminShell 사용
├── _components/
│   ├── admin-shell.tsx              [신규] RSC, cookie 읽기, grid 컨테이너
│   ├── admin-sidebar.tsx            [신규] CSC, collapsed UI, nav 렌더
│   ├── admin-sidebar-toggle.tsx     [신규] CSC, document.cookie + router.refresh
│   ├── admin-mobile-header.tsx      [신규] CSC, lg 미만에서만 노출, Sheet 트리거
│   ├── admin-user-menu.tsx          [수정] 사이드바 footer 위치로 이전, 접힘 모드 처리
│   └── admin-nav.tsx                [삭제] 사이드바로 책임 이전
└── _data/
    └── nav-items.ts                 [신규] ALL_TABS 데이터 분리
```

### 5.2 데이터 흐름

```
[Request]
  ↓
app/layout.tsx
  ├─ RoleScope (CSC, viewMode → mode 계산)
  │   └─ 호텔리어 UI 토글
  └─ {children}
       ↓
       app/(admin)/admin/layout.tsx (RSC, force-dynamic)
       ├─ requireRole(['manager', 'admin'])
       ├─ cookies().get('viewMode') + 'sidebarCollapsed'
       └─ <AdminShell collapsed={...} viewMode={...}>
            ├─ <AdminSidebar /> (viewMode==='staff' 일 때만)
            │   ├─ <NavItem> × N (nav-items.ts 데이터)
            │   ├─ <AdminSidebarToggle />
            │   └─ <AdminUserMenu />
            ├─ <AdminMobileHeader /> (lg 미만 sticky)
            └─ <main>{children}</main>
```

### 5.3 collapsed 상태 (쿠키)

| 속성 | 값 |
|:-|:-|
| 이름 | `sidebarCollapsed` |
| 값 | `1` (접힘) 또는 미설정 (펼침 기본) |
| Path | `/` |
| MaxAge | 1년 (31536000초) |
| HttpOnly | `false` (클라이언트 토글) |
| Secure | 프로덕션 `true` |
| SameSite | `Lax` |

**SSR 첫 렌더 깜빡임 방지**: layout.tsx에서 `cookies().get('sidebarCollapsed')` 읽어 AdminShell의 grid-cols 클래스 결정. 클라이언트는 토글 시 `document.cookie` 변경 + `router.refresh()` (role-mode-ui와 동일 패턴).

### 5.4 grid 레이아웃

```css
/* AdminShell (RSC) */
.admin-shell {
  display: grid;
  /* viewMode='staff' && lg+ */
  grid-template-columns: var(--sidebar-w, 240px) 1fr;
  /* viewMode='hotelier' or <lg */
  /* grid-template-columns: 1fr; */
}

/* CSS variable로 collapsed 토글 */
[data-sidebar-collapsed='true'] { --sidebar-w: 56px; }
[data-sidebar-collapsed='false'] { --sidebar-w: 240px; }
```

**왜 grid?** flex는 본문이 `min-w-0` 안 잡으면 overflow 폭주. grid `1fr`은 자동으로 본문 max-width 보존하면서 사이드바 폭 유연 조정.

### 5.5 RoleScope와의 통합

- **RoleScope의 책임**: viewMode 쿠키 + session으로 mode 계산, 호텔리어 UI(Header·EmergencyBanner·ChatbotFab) 노출 토글, ViewModeBanner 노출. **사이드바 미관여**.
- **AdminShell의 책임**: viewMode prop 받아 staff일 때만 사이드바 렌더. mode 자체는 RoleScope에서 결정한 data-role 속성을 그대로 cascade로 받음.
- **viewMode 전환 흐름**:
  1. 매니저가 "호텔리어 시점으로 보기" 클릭
  2. `document.cookie` 변경 + `router.refresh()`
  3. RoleScope re-render → `showHotelierUi=true`, 호텔리어 헤더 mount
  4. AdminShell re-render → `viewMode='hotelier'`, 사이드바 unmount, grid 1-col로 collapse
  5. 본문은 유지 (children 재렌더만)

---

## 6. 기존 코드 충돌·중복·오류 리뷰

### 6.1 충돌 (Conflict)

| ID | 설명 | 완화 |
|:-|:-|:-|
| **C1** | `app/(admin)/admin/layout.tsx`의 `max-w-7xl mx-auto` 컨테이너가 사이드바 grid와 충돌 | layout을 grid 전환, 본문 max-width는 `<main>` 내부에서 유지 |
| **C2** | RoleScope의 `<div className="contents">`는 grid 자식에서 풀어짐 | AdminShell이 RoleScope 외부가 아닌 children 측 grid 형성. RoleScope는 그대로 contents 유지 |
| **C3** | 기존 AdminNav의 `flex flex-wrap` 한 줄 패턴 → 사이드바 vertical로 변경 | AdminNav 삭제, NavItem 컴포넌트 신규 |
| **C4** | next-themes의 다크모드와 사이드바 배경 | 사이드바 배경은 `bg-white dark:bg-slate-950` 중립색 고정, brand-* 미사용 |

### 6.2 중복 (Duplication)

| ID | 설명 | 완화 |
|:-|:-|:-|
| **D1** | AdminUserMenu가 현재 AdminNav 우측에 있고, 신규 사이드바 footer로 이전 → 두 곳 동시 마운트 방지 | AdminNav 삭제와 사이드바 도입을 같은 commit에서 처리 |
| **D2** | 모바일 헤더와 호텔리어 모드 Header가 동시 노출될 위험 | viewMode 분기로 정확히 1개만 렌더 (staff && lg- = AdminMobileHeader / hotelier = Header) |
| **D3** | 데스크탑 AdminSidebar와 모바일 Sheet가 NavItem 정의 중복 | NavItem 컴포넌트 1개 + 데이터 nav-items.ts 1개. Sheet는 NavItem 재사용 |

### 6.3 오류 가능성 (Error)

| ID | 설명 | 완화 |
|:-|:-|:-|
| **E1** | `document.cookie`에서 `sidebarCollapsed` 못 읽거나 위조 | resolveCollapsed 함수에서 strict 검사, 미지값은 false |
| **E2** | SSR/CSR hydration mismatch | useState 미사용. layout.tsx의 cookies()로만 결정 → 서버=클라이언트 동일 |
| **E3** | 모바일 Sheet 닫힘 시 fixed 사이드바가 모바일에 잔존 | `lg:block hidden` 등 미디어 쿼리 명시. Sheet는 별개 컴포넌트 |
| **E4** | 단축키 `[` `]` 가 입력 필드에서 작동 | `e.target.tagName === 'INPUT' \|\| 'TEXTAREA'` 시 무시. textarea·contenteditable 모두 |
| **E5** | 27인치에서 본문 max-w-7xl 유지로 우측 여백 과다 | 1차 PR은 의도. 2차 PR에서 페이지별 폭 조정 |
| **E6** | 사이드바 unmount → 본문 grid 1-col 전환 시 자녀 컴포넌트 unmount/remount | grid CSS는 transition 없이 즉시 적용. children은 키 유지로 remount 회피 |
| **E7** | flyout이 다른 fixed 요소(toast·modal) z-index와 충돌 | flyout `z-30`, Sheet `z-40`, modal `z-50` 명시 |

### 6.4 회귀 (Regression)

| ID | 설명 | 완화 |
|:-|:-|:-|
| **R1** | `/admin/tickets`·`/admin/articles` 등 본문이 max-w-7xl 가정으로 디자인됨 | 1차 PR에서 max-w-7xl 유지로 페이지 무수정 |
| **R2** | role-mode-ui의 자물쇠 매니저 표시가 사이드바로 옮겨가며 디자인 변경 | 디자인 변경 의도(접힘 상태 Lock 배지). 시각 회귀 테스트로 확인 |
| **R3** | role-mode-ui의 viewMode 토글 위치 변경(헤더 → 사이드바 footer) | AdminUserMenu 이전. 헤더의 toggle 제거와 사이드바 footer 추가 동시 |
| **R4** | 호텔리어 콘솔 회귀 — 사이드바 노출 안 됨 검증 | viewMode='hotelier'에서 사이드바 DOM 자체 없음을 Playwright 시나리오 추가 |
| **R5** | 다크모드 + 다크 사이드바 배경 + brand accent 가독성 | V-04·V-06 시각 시나리오로 검증 |

---

## 7. 미해결 의사결정 (사용자 확정 필요)

| ID | 질문 | 기본 선택 | 사용자 확정 필요? |
|:-:|:-|:-|:-:|
| **Q-1** | collapsed 저장 매체: 쿠키 vs localStorage | **쿠키** (CTO 권장 — SSR 깜빡임 0) | ❌ 자동 확정 |
| **Q-2** | 본문 max-width: 1차 PR에서 max-w-7xl 유지 vs 즉시 변경 | **유지** (CTO 권장 — 회귀 위험 완화) | ❌ 자동 확정 |
| **Q-3** | 사이드바 펼침/접힘 폭: 240/56 vs 다른 값 | **240 / 56** (디자이너 권장) | ❌ 자동 확정 |
| **Q-4** | 사이드바 배경: role 컬러 사용 vs 중립색 고정 | **중립색 고정** (디자이너 + CS 권장 — 메뉴 가독성 우선) | ❌ 자동 확정 |
| **Q-5** | 자물쇠 메뉴: 매니저에게 노출 유지 vs 숨김 | **노출 유지** (CS 운영자 권장 — 소통 비용 절감) | ❌ 자동 확정 |
| **Q-6** | 단축키: `[` `]` vs `Ctrl+B` | **`[` `]`** (디자이너 권장 — 브라우저 충돌 회피) | ❌ 자동 확정 |
| **Q-7** | 첫 진입 투어/온보딩 노출 여부 | **본 Phase 미포함**, 2주 베타 후 결정 | ✅ **확정 (2026-05-28)** |
| **Q-8** | feature flag로 점진 출시 vs 전면 전환 | **전면 전환** (단일 PR, 롤백은 git revert) | ✅ **확정 (2026-05-28)** |
| **Q-9** | 모바일 Sheet 트리거 위치: 별도 sticky 헤더 신설 vs 기존 글로벌 헤더 활용 | **별도 sticky 헤더** (CTO 권장 — 사이드바 닫힘 시 트리거 가시성) | ❌ 자동 확정 |
| **Q-10** | 후속 Phase 우선순위 | **카운트 배지 → 자리비움 → 알림 → KPI 위젯** | ✅ **확정 (2026-05-28)** |

---

## 8. 구현 commit 분리 (실제 PR 작업 단위)

각 commit은 빌드 통과 + 작동 가능.

| Commit | 내용 | 영향 범위 |
|:-:|:-|:-|
| 1 | `chore(admin): ALL_TABS를 _data/nav-items.ts로 추출` | AdminNav 내부 import만 변경. 동작 무변경 |
| 2 | `feat(admin): AdminShell RSC + sidebarCollapsed 쿠키 읽기` | 사이드바 미렌더, 껍데기만. grid layout 도입 |
| 3 | `feat(admin): AdminSidebar CSC + NavItem + 자물쇠 + 토글` | 데스크탑 lg+ 사이드바 동작. AdminNav 병행 |
| 4 | `feat(admin): AdminUserMenu 사이드바 footer 이전 + viewMode 토글 통합` | 헤더 우측 메뉴 제거, footer로 이동 |
| 5 | `feat(admin): AdminMobileHeader + shadcn/ui Sheet 드로어` | 모바일(<lg) Sheet 동작 |
| 6 | `refactor(admin): layout.tsx AdminShell 적용 + AdminNav 삭제` | 사이드바 정식 활성화. 상단 탭 제거 |
| 7 | `feat(admin): 단축키 [/] + 접힘 hover flyout` | 키보드/마우스 인터랙션 완성 |
| 8 | `feat(admin): 확장 슬롯 placeholder 주석 + 후속 Phase TODO` | 카운트 배지/자리비움 슬롯 위치 명시 |
| 9 | `test(e2e): 사이드바 9개 시나리오 + 회귀 시나리오 5개` | Playwright 추가 |
| 10 | `docs: 개발 일지 + 시각 회귀 캡처` | docs/dev-logs/2026-06-XX.html |

### 8.1 빌드 가능성 검증

각 commit 종료 시점에:
- `npm run build` 통과
- `npm run lint` warning 추가 0
- 기존 Playwright 9개 시나리오(role-mode-ui) 통과

### 8.2 롤백 전략

- **Commit 6 이전**: 즉시 revert. 사이드바 미활성, 상단 탭 그대로
- **Commit 6 이후**: 단일 revert로 상단 탭 복귀
- **배포 후 롤백**: `sidebarCollapsed` 쿠키 만료 + AdminShell의 staff 분기를 false로 강제 (1-line patch)

---

## 9. 테스트 시나리오 (Design Phase에서 구체화)

본 Plan은 시나리오 수만 명시. 상세는 Design 단계에서.

| 카테고리 | 시나리오 수 | 개요 |
|:-|:-:|:-|
| 기능 | 9 | 사이드바 노출/미노출, 접기/펼치기, 단축키, 자물쇠, viewMode 전환, footer 메뉴 |
| 시각 | 6 | admin × 라이트/다크, manager × 라이트/다크, 접힘 × 라이트/다크 |
| 회귀 | 5 | hotelier 사이드바 미노출, 모바일 Sheet, role-mode-ui 자물쇠, ViewModeBanner, 다크모드 토글 |
| 모바일 | 4 | Sheet 열기/닫기, 햄버거 트리거, viewMode 배너 위치, lg 경계 |
| **합계** | **24** | |

---

## 10. 후속 Phase (사용자 확정 순서)

CS 운영 책임자가 강조한 P0/P1 항목을 본 Phase 후속으로 정리. **사용자 확정 우선순위 (Q-10, 2026-05-28)**:

| 순서 | Phase | 내용 | 의존성 |
|:-:|:-|:-|:-|
| **1** | **sidebar-ticket-badge** | 티켓 큐 메뉴 옆 미처리 카운트 배지 (빨간 숫자) + 본인/전체 토글 | 본 Phase 슬롯 |
| **2** | **sidebar-away-toggle** | 자리비움 Online/Away 토글 + 다른 매니저 가시화 | 사용자 status DB 컬럼 |
| **3** | **sidebar-realtime-alert** | 새 티켓 도착 SSE/polling + 사이드바 점/배지 + desktop notification | 티켓 도메인 API |
| **4** | **sidebar-daily-kpi** | 오늘 처리한 티켓 카운터 (개인 KPI 위젯) | activity_logs 집계 |
| 5 | **sidebar-onboarding** | 첫 진입 투어 + "기존 게 더 좋았다" 피드백 수집 폼 | 본 Phase 출시 후 2주 베타 결과 |
| 6 | **admin-content-width** | `/admin/*` 페이지별 본문 max-width 최적화 | 본 Phase 안정화 후 |

> **Q-7 확정 (2026-05-28)**: 온보딩은 본 Phase 미포함. 2주 베타 후 사용자 반응 분석하여 5번 Phase에서 별도 설계.
> **Q-8 확정 (2026-05-28)**: 전면 전환 단일 PR. 롤백은 git revert.

---

## 11. KPI / 성공 지표

### 11.1 측정 항목 (출시 후 4주)

| KPI | 목표 | 측정 방법 |
|:-|:-|:-|
| 매니저 첫 응답 시간(FRT) | 5~10% 단축 | 티켓 생성 → 첫 매니저 응답 평균 시간 |
| 매니저 일일 처리 티켓 수 | 소폭 상승 | activity_logs 집계 |
| 사이드바 접힘률 | < 30% | sidebarCollapsed 쿠키 분석 (30% 초과 시 메뉴 설계 재검토) |
| 매니저 NPS / 내부 설문 | "기존보다 빠르다" 60%+ | 출시 4주 후 설문 |
| 매니저 학습 곡선 (AHT 일시 증가) | 2주 내 원복 | 평균 처리 시간 모니터링 |

### 11.2 실패 신호 (롤백 검토)

- 사이드바 접힘률 70% 초과 → 메뉴 폭/구조 재설계 필요
- 출시 1주 차 매니저 처리량 20% 이상 감소 → 학습 곡선 외 다른 원인 의심
- 모바일 사용자 이탈률 증가 → Sheet UX 재검토

---

## 12. 다음 단계

1. **본 Plan 사용자 승인** → 미해결 의사결정 Q-7·Q-8·Q-10 확정
2. **`/pdca design admin-sidebar-layout`** — 상세 컴포넌트 명세 + 24개 테스트 시나리오 작성
3. **`/pdca do admin-sidebar-layout`** — Commit 1~10 순차 구현
4. **`/pdca analyze admin-sidebar-layout`** — Gap 분석
5. **`/pdca report admin-sidebar-layout`** — 완료 보고서

---

## 부록 A. 디렉토리 트리 (변경 후)

```
app/(admin)/admin/
├── layout.tsx                          [수정] grid + AdminShell
├── _components/
│   ├── admin-shell.tsx                 [신규] RSC
│   ├── admin-sidebar.tsx               [신규] CSC
│   ├── admin-sidebar-toggle.tsx        [신규] CSC
│   ├── admin-mobile-header.tsx         [신규] CSC + Sheet
│   ├── admin-nav-item.tsx              [신규] CSC, NavItem 단일 컴포넌트
│   ├── admin-user-menu.tsx             [수정] footer로 이전, 접힘 모드 처리
│   └── admin-nav.tsx                   [삭제] 사이드바로 이전
└── _data/
    └── nav-items.ts                    [신규] ALL_TABS 데이터
components/ui/
└── sheet.tsx                           [신규/확인] shadcn/ui add sheet 필요 시
lib/
└── sidebar-state.ts                    [신규] 쿠키 read/write 헬퍼
```

## 부록 B. 참조

- 선행 Plan: `docs/01-plan/features/role-mode-ui.plan.md`
- 선행 Design: `docs/02-design/features/role-mode-ui.design.md`
- shadcn/ui Sheet: https://ui.shadcn.com/docs/components/sheet
- Tailwind CSS Grid: https://tailwindcss.com/docs/grid-template-columns
- VSCode 사이드바 단축키 패턴: `Ctrl+B` (변형: `[` `]`)
- Zendesk·Freshdesk 사이드바 패턴: 슬림 아이콘 + hover 라벨, 카운트 배지 상시
