# Plan — 역할별 모드 UI 분리 (role-mode-ui)

> **Feature**: role-mode-ui — 어드민/매니저/호텔리어 3종 사용자별 시각적·구조적 모드 분리
> **Phase**: Plan
> **작성일**: 2026-05-28
> **작성자**: Claude (CTO 톤, 시니어 개발자 합의)
> **사전 진단 보고서**: 대화 #1 — "어드민/호텔리어 UX 분리 진단" (Action 1~7 도출)

---

## Executive Summary

| 항목 | 값 |
|:-|:-|
| **Feature** | role-mode-ui — 역할별 모드 UI 분리 |
| **시작일** | 2026-05-28 |
| **예상 완료** | 2026-06-04 (영업일 5일) |
| **총 공수** | P0 1.5일 + P1 1일 + P2 1.5일 + QA 1일 = 약 5일 |
| **변경 파일 추정** | 신규 3개 + 수정 약 10개 (50+ 컬러 사용 파일은 무수정) |
| **Match Rate 목표** | ≥ 90% |

### 가치 전달 (4관점)

| 관점 | 내용 |
|:-|:-|
| **Problem (문제)** | 어드민·매니저·호텔리어가 같은 헤더·GNB·챗봇 FAB를 공유하여 "현재 어떤 모드에서 일하는지" 시각적 단서가 부족하다. 매니저는 어드민 전용 메뉴 부재를 권한 부족인지 기능 미존재인지 구분 못 한다. UserNav 버그로 매니저가 "어드민 영역" 버튼 클릭 시 404가 뜬다. |
| **Solution (해법)** | ① `brand-*` CSS 변수를 `data-role` 속성으로 동적 분기(어드민=보라, 매니저=코발트, 호텔리어=진녹). ② 루트 레이아웃에서 호텔리어 UI(헤더·챗봇FAB·EmergencyBanner)를 무조건 노출하지 않고, 라우트 그룹별 레이아웃에서 명시 노출. ③ AdminNav에 "호텔리어 시점 보기" 토글 + 어드민 전용 메뉴를 매니저에게 🔒 표시. ④ UserNav 링크 버그 수정. |
| **Function UX Effect** | 사용자는 헤더 색·뱃지·메뉴 구성만으로 즉시 "지금 어떤 역할로 일하는 중인지" 인지. 매니저는 자신의 권한 한계를 시각적으로 인지(자물쇠 아이콘). 어드민·매니저는 발행 전 호텔리어 시점으로 콘텐츠를 미리 검수 가능. 매니저의 404 버그 제거. |
| **Core Value** | "**역할의 시각적 정체성** + **명확한 권한 경계** + **안전한 시점 전환**" — 단일 플랫폼에서 3종 사용자가 자기 역할 콘텍스트를 잃지 않고 일할 수 있게 한다. |

---

## 1. 배경 & 목적

### 1.1 배경

직전 대화에서 사용자(서비스 오너)가 "어드민 기준으로 호텔리어 프론트 기능과 어드민 기능의 구분이 잘 안 된다"고 진단을 요청했다. 20년차 UX/IA 컨설팅 관점 합의 진단 결과:

- **기술적 분리 8할 완성** (라우트 그룹·URL 컨벤션·콘텐츠 페이지 분리)
- **사용자 멘탈 모델 측면 분리 5할** (모드 전환 UX 없음, 시각적 콘텍스트 부족, 매니저/어드민 차이 비가시화)

### 1.2 목적

이 Plan은 진단 보고서의 7개 Action 중 **사용자가 체감하는 효과가 큰 상위 5개**(Action 1, 2, 3, 4, 5)를 묶어 단일 Phase로 구현한다. Action 6(`/profile/staff` 권한 명시)과 Action 7(이중 권한 체크 정리)은 별도 작업으로 분리.

### 1.3 추가 요청사항 (사용자 본 메시지에서)

| 역할 | 메인 컬러 | 비고 |
|:-|:-|:-|
| **어드민** | 보라색 (현재 `brand-*` 유지) | indigo/purple oklch hue 272-281 |
| **매니저** | 코발트 블루 (`#1D4ED8` Tailwind blue-700) | 신뢰·안정 톤 |
| **호텔리어** | 진녹색 (`#166534` Tailwind green-800) | as.oapms.com 톤 유사 (정확한 HEX는 사용자 확인 후 조정 가능) |

> ⚠️ **호텔리어 컬러 확정 필요**: as.oapms.com의 실제 HEX 코드를 사용자가 개발자도구로 확인해주시면 50~950 스케일을 정확히 재계산한다. 본 Plan은 잠정 `#166534`를 기준으로 작성.

### 1.4 사용자 요구 인용

> "기존 코드와 충돌, 중복, 오류 가능성 없게 철저히 리뷰하고 개발 진행"

→ 본 Plan의 **§6 기존 코드 충돌·중복·오류 리뷰** 섹션에 모든 위험을 사전 식별하고 완화책을 명시.

---

## 2. Goals & Non-Goals

### 2.1 Goals (이번 Phase에 반드시 달성)

1. **G1**. 역할별 시각적 정체성 부여: 헤더·내비·강조색이 역할에 따라 자동 전환된다.
2. **G2**. 호텔리어용 UI(GNB·챗봇 FAB·응급 배너)가 어드민 영역에서 노출되지 않는다.
3. **G3**. 매니저·어드민은 헤더 우측 아바타 드롭다운에서 "호텔리어 시점으로 보기" 모드를 켜고 끌 수 있다.
4. **G4**. 매니저는 어드민 전용 메뉴를 🔒 비활성 상태로 인지할 수 있다.
5. **G5**. UserNav의 매니저 링크 404 버그가 제거된다.
6. **G6**. 다크모드·라이트모드 × 3역할 = 6가지 조합 모두에서 시각 일관성·가독성 WCAG AA 충족.

### 2.2 Non-Goals (이번 Phase 범위 밖)

1. ❌ 기존 `brand-*` className 50+ 파일을 일괄 수정하지 않는다 (전략 A 채택 이유).
2. ❌ `/profile/staff` 권한 모호성은 본 작업에서 다루지 않는다 (별도 Phase).
3. ❌ 이중 권한 체크 리팩토링은 별도 Phase.
4. ❌ 컬러 외 폰트·간격·아이콘 시스템 변경 없음.
5. ❌ 호텔리어 영역의 IA(메뉴 구조) 자체는 그대로 유지 (시각적 분리만).

---

## 3. 사용자별 시나리오 (Before / After)

### 3.1 시나리오 A. 어드민이 로그인하여 티켓 큐를 본다

**Before**:
```
[헤더: 흰 배경, 보라색 로고]
홈 | 빠른해결 | 가이드 | 상태 | 문의접수 | 공지/업데이트  [티켓큐][어드민][프로필]
↓
[/admin/tickets 진입]
같은 헤더 + AdminNav (보라색 강조)
우하단: 호텔리어용 챗봇 FAB 떠 있음 ← 어드민 콘텍스트와 충돌
```

**After**:
```
[/admin 진입 시]
[헤더: 보라색 톤, 🛡 어드민 배지]
티켓큐 | 서비스상태 | 콘텐츠▼ | 조직▼ | 마스터▼     [👤 김어드민 ▼]
                                                       └ 호텔리어 시점으로 보기
챗봇 FAB 없음. EmergencyBanner 없음. 호텔리어 GNB 없음.
```

### 3.2 시나리오 B. 매니저가 사용자 관리 메뉴를 클릭한다

**Before**:
```
AdminNav: [티켓큐][서비스상태][아티클][공지][FAQ][체크리스트][마스터][내프로필]
사용자 메뉴 자체가 안 보임 → 매니저는 "권한 없음"인지 "기능 미존재"인지 모름
또한 /profile에서 "매니저 영역으로 →" 클릭 → /admin/users → notFound() ← 버그
```

**After**:
```
[헤더: 코발트 블루 톤, 🛡 매니저 배지]
티켓 운영▼ | 콘텐츠▼ | 조직&마스터 [🔒]   [👤 매니저 ▼]

[조직&마스터] 호버 시:
  ┌──────────────────────┐
  │ 사용자       🔒 어드민│ ← tooltip "어드민 권한 필요"
  │ 호텔         🔒 어드민│
  │ 마스터 데이터 ✓     │
  │ 시스템 설정   🔒 어드민│
  └──────────────────────┘

/profile에서 "매니저 영역으로 →" 클릭 → /admin/tickets (티켓 큐) ← 정상 동작
```

### 3.3 시나리오 C. 매니저가 발행 전 콘텐츠를 호텔리어 시점에서 검수한다

**Before**: 불가능. 본인 휴대폰으로 직접 켜야 함.

**After**:
```
[헤더 우측 아바타 ▼]
  ● 매니저 모드 (현재)
  ○ 호텔리어 시점으로 보기 ← 클릭
  ─────────────
  로그아웃

[클릭 후]
┌──────────────────────────────────────────────────────────────┐
│ ⚠️ 호텔리어 시점으로 보고 있습니다 — [매니저로 돌아가기]      │ ← persistent
└──────────────────────────────────────────────────────────────┘
[헤더: 진녹색 톤]
홈 | 빠른해결 | 가이드 | 상태 | 문의접수 | 공지/업데이트
※ 챗봇 FAB·EmergencyBanner 정상 표시 (호텔리어 시점이므로)
```

### 3.4 시나리오 D. 호텔리어가 로그인하여 평소처럼 사용한다

**Before**: 진녹색 정체성 없음, 보라색 톤.

**After**:
```
[헤더: 진녹색 톤, 별도 배지 없음]
홈 | 빠른해결 | 가이드 | 상태 | 문의접수 | 공지/업데이트  [🔍] [👤 호텔리어 ▼]

[👤 ▼]
  내 프로필
  직원 관리 (호텔 매핑된 경우)
  ─────────────
  로그아웃

※ "어드민 영역으로" 같은 메뉴 노출 안 됨 (호텔리어는 해당 사항 없음)
```

---

## 4. 컬러 시스템 설계

### 4.1 토큰 매트릭스 (50~950 스케일, light/dark 공통)

| 토큰 | 어드민 (현재 유지) | 매니저 (신규) | 호텔리어 (신규) |
|:-|:-|:-|:-|
| `--color-brand-50`  | `oklch(0.962 0.018 272.31)` (현재) | `#eff6ff` | `#f0fdf4` |
| `--color-brand-100` | `oklch(0.930 0.034 272.79)` (현재) | `#dbeafe` | `#dcfce7` |
| `--color-brand-200` | `oklch(0.870 0.065 274.04)` (현재) | `#bfdbfe` | `#bbf7d0` |
| `--color-brand-300` | `oklch(0.785 0.115 274.71)` (현재) | `#93c5fd` | `#86efac` |
| `--color-brand-400` | `oklch(0.673 0.182 276.94)` (현재) | `#60a5fa` | `#4ade80` |
| `--color-brand-500` | `oklch(0.585 0.233 277.12)` (현재) | `#3b82f6` | `#22c55e` |
| `--color-brand-600` | `oklch(0.511 0.262 276.97)` (현재) | `#2563eb` ← hover | `#16a34a` ← hover |
| `--color-brand-700` | `oklch(0.457 0.240 277.02)` (현재) | `#1d4ed8` ← **MAIN** | `#15803d` |
| `--color-brand-800` | `oklch(0.398 0.195 277.37)` (현재) | `#1e40af` | `#166534` ← **MAIN** |
| `--color-brand-900` | `oklch(0.359 0.144 278.70)` (현재) | `#1e3a8a` | `#14532d` |
| `--color-brand-950` | `oklch(0.257 0.092 281.29)` (현재) | `#172554` | `#052e16` |

**참고**: "MAIN"은 헤더 배경·주요 버튼 배경에 사용되는 핵심 톤. 매니저는 `brand-700`, 호텔리어는 `brand-800` 위치에 배치 (각 컬러 스케일의 시각적 무게 균형 고려).

### 4.2 적용 방식 — `data-role` 속성 기반 CSS 변수 분기 (전략 A)

```css
/* app/globals.css */
@theme {
  /* 기본값 = 어드민 보라 (현재 그대로) */
  --color-brand-50:  oklch(0.962 0.018 272.31);
  ...
  --color-brand-950: oklch(0.257 0.092 281.29);
}

/* 매니저 모드 */
:root[data-role="manager"] {
  --color-brand-50:  #eff6ff;
  ...
  --color-brand-950: #172554;
}

/* 호텔리어 모드 (실제 호텔리어 + 시점 보기) */
:root[data-role="hotelier"] {
  --color-brand-50:  #f0fdf4;
  ...
  --color-brand-950: #052e16;
}
```

**핵심 효과**:
- 기존 50+ 파일의 `text-brand-700`, `bg-brand-100` 등 className **0줄 수정**
- 다크모드는 기존 `dark:` variant 그대로 작동 (브라우저가 CSS 변수만 다르게 해석)
- 시각적 결과: 같은 `bg-brand-100 text-brand-700` 컴포넌트가 어드민 화면에선 보라, 매니저 화면에선 코발트, 호텔리어 화면에선 녹색으로 자동 표시.

### 4.3 `data-role` 속성 설정 위치

각 라우트 그룹의 layout에서 `<html>` 또는 root container에 `data-role` 부여:

| 경로 | `data-role` 값 | 비고 |
|:-|:-|:-|
| 루트 `app/layout.tsx` | (없음, 기본값 = 어드민 보라) | 비로그인·일반 호텔리어 경로는 §4.4 client component로 동적 설정 |
| `app/(admin)/admin/layout.tsx` | `"admin"` (어드민) 또는 `"manager"` (매니저) | `user.role`로 분기 |
| `app/(user)/layout.tsx` | `user.role`별 분기 | hotelier → hotelier, staff → 본인 역할 |

**서버 컴포넌트에서 `<html>` 속성을 직접 못 바꾸므로 (Next.js 15 RSC 제약)**:
- 옵션 1: `<body>` 또는 라우트 그룹 최상위 `<div>`에 `data-role` 부여 (CSS 변수는 어떤 노드든 작동)
- 옵션 2: `<RoleScope role={user.role}>` 클라이언트 컴포넌트로 `<html>` 속성을 useEffect로 동기화

→ **옵션 1 채택**. 더 간단하고 SSR 일관성 보장. CSS 변수는 cascade 되므로 `<div>` 단위 적용도 동일 효과.

### 4.4 호텔리어 시점 보기 모드 (Action 5)

매니저·어드민이 "호텔리어 시점으로 보기"를 켜면:

1. 클라이언트에서 쿠키 `view-mode=hotelier` set (HttpOnly 아님, 1일 만료)
2. 미들웨어가 쿠키 감지 시 `request.headers.set('x-view-mode', 'hotelier')`
3. 루트 레이아웃이 헤더에서 `x-view-mode` 읽고:
   - `data-role="hotelier"` 부여
   - 호텔리어 헤더 + 챗봇 FAB + EmergencyBanner 노출
   - 상단에 영구 노란 배너 "⚠️ 호텔리어 시점으로 보고 있습니다 — [원래 역할로 돌아가기]"
4. "돌아가기" 클릭 → 쿠키 삭제 + `router.refresh()`

**보안 주의**: 시점 보기 모드라도 **서버 권한 체크는 그대로 user.role을 사용**한다. 즉, 매니저가 시점 보기 켜놓고 `/admin/users` 접근 시 매니저 권한 부족으로 차단된다 (시점 보기는 순수 UI 표시용).

---

## 5. 구현 전략 (전략 A 채택)

### 5.1 핵심 원칙

1. **기존 코드 무수정 원칙**: 50+ 파일의 `brand-*` className은 한 줄도 안 건드린다.
2. **점진적 적용**: 신규 토큰 추가 → `data-role` 부여 → 시각 확인 → 잘못된 화면만 수정.
3. **롤백 용이성**: `data-role` 속성 제거만으로 즉시 원복 가능 (CSS 변수가 기본값으로 fallback).

### 5.2 신규/수정 파일 (사전 식별)

#### 신규 파일 (3개)

| 파일 | 역할 |
|:-|:-|
| `components/layout/role-scope.tsx` | 루트 div에 `data-role` 부여 (클라이언트 컴포넌트, 시점 보기 쿠키 감지) |
| `components/layout/view-mode-banner.tsx` | 시점 보기 모드 시 상단 배너 |
| `lib/view-mode.ts` | 쿠키 read/write 유틸 + 미들웨어 헬퍼 |

#### 수정 파일 (약 10개)

| 파일 | 변경 |
|:-|:-|
| `app/globals.css` | 매니저/호텔리어 토큰 추가 (`:root[data-role=...]`) |
| `app/layout.tsx` | RoleScope 적용, Header/EmergencyBanner/ChatbotFab을 RoleScope 내부로 이동 + 호텔리어 시점일 때만 노출 |
| `app/(admin)/admin/layout.tsx` | `data-role` 부여, 호텔리어 UI 제거 |
| `app/(admin)/admin/_components/admin-nav.tsx` | "내 프로필 →" 분리 → 우측 아바타 메뉴, 자물쇠 아이콘, 호텔리어 시점 토글 |
| `app/(user)/_components/user-nav.tsx` | 매니저 링크 수정 (`/admin/tickets`), 디자인 정리 |
| `components/layout/header.tsx` | 시점 모드 감지 props, 호텔리어 배지 등 |
| `middleware.ts` (없으면 신규) | 시점 보기 쿠키 → `x-view-mode` 헤더 변환 |
| `app/(admin)/admin/_components/admin-user-menu.tsx` (신규) | 어드민/매니저 아바타 드롭다운 (시점 보기 토글 포함) |
| `app/(user)/_components/user-account-menu.tsx` (신규 or 통합) | 호텔리어 아바타 드롭다운 |
| `lib/hooks/use-view-mode.ts` (신규) | 클라이언트에서 시점 모드 읽기/토글 |

**참고**: `middleware.ts`는 기존 프로젝트에 없을 수 있음 — Design 단계에서 NextAuth 미들웨어와의 충돌 여부 확인 필수.

### 5.3 단계적 구현 순서

```
Step 1. 토큰 시스템 셋업 (P0)
  - globals.css 토큰 추가
  - <body data-role="..."> 임시 부여하고 각 모드 시각 확인

Step 2. UserNav 버그 수정 (P0)
  - line 44: /admin/users → /admin/tickets
  - signOut import 누락 (확인 후) 보강

Step 3. 루트 레이아웃 분리 (P0)
  - Header/EmergencyBanner/ChatbotFab을 RoleScope 분기 적용
  - /admin 진입 시 호텔리어 UI 비노출 확인

Step 4. AdminNav 재구조화 (P0~P1)
  - 메뉴 그룹화 (티켓운영/콘텐츠/조직&마스터)
  - "내 프로필" → 우측 아바타 드롭다운으로 이동
  - 매니저용 자물쇠 아이콘 추가

Step 5. 시점 보기 모드 (P2)
  - 쿠키 + 미들웨어 + ViewModeBanner
  - 어드민/매니저 아바타에서 토글

Step 6. 다크모드 × 3역할 시각 검수 (QA)
  - 6가지 조합 캡처 + WCAG AA 확인
```

---

## 6. 기존 코드 충돌·중복·오류 리뷰 ⭐

> 사용자 요구: "기존 코드와 충돌, 중복, 오류 가능성 없게 철저히 리뷰하고 개발 진행"
> → 사전 리뷰 결과를 모두 식별하고 완화책 명시.

### 6.1 충돌 가능성

| 항목 | 충돌 내용 | 완화 |
|:-|:-|:-|
| **C1. amber-* 컬러와 brand-* 의 시각 충돌** | 현재 헤더(line 109)·헤더 모바일(line 206)에서 어드민 강조용 amber 사용 중. 매니저 코발트와 amber는 그럭저럭, 호텔리어 녹색과 amber도 보색 가깝지만 사용 면적이 작아 OK. | amber-* 는 "긴급/주의" 의미로 유지. 헤더의 "티켓큐" amber 배지는 모든 역할에서 동일 유지 (의미 일관성). |
| **C2. brand-50/100과 호텔리어 50/100 시각 차이 부족** | 셋 다 매우 옅음. 다크모드에서 차이 거의 안 보일 위험. | Step 6 QA에서 다크모드 6조합 캡처 후 필요 시 보조 시각 단서(역할 배지, 아이콘) 강화. |
| **C3. `data-role` 속성이 cascade 되어 자식 컴포넌트에 영향** | 시점 보기 모드 진입 시 헤더와 본문이 모두 hotelier 톤이 되는 게 정상. 하지만 모달·토스트 등 portal로 body 외부에 렌더되는 컴포넌트가 영향 안 받을 수 있음. | `:root[data-role=...]` 가 아니라 `body[data-role=...]` 도 동시 적용. 또는 RoleScope에서 `useEffect`로 `document.documentElement.dataset.role` 동기화. |
| **C4. NextAuth 미들웨어와 신규 미들웨어 충돌** | 기존 NextAuth 세션 미들웨어가 있을 수 있음 (확인 필요). 새 미들웨어 추가 시 chain 처리 필요. | Design 단계에서 `middleware.ts` 존재 확인. 없으면 새로 생성, 있으면 NextAuth withAuth 패턴으로 chain. |

### 6.2 중복 가능성

| 항목 | 중복 내용 | 완화 |
|:-|:-|:-|
| **D1. 로그아웃 버튼이 Header/AdminNav/UserNav 3곳에 동일 구현** | 동일 confirm 다이얼로그 + signOut 패턴 코드 3번 반복. 본 작업에서 아바타 드롭다운으로 통합하면 더 중복될 수 있음. | `components/auth/logout-button.tsx` 공용 컴포넌트 추출 (또는 Plan 범위 밖으로 분리). 본 작업은 신규 아바타 드롭다운만 만들고, 기존 3곳은 그대로 유지하여 회귀 위험 차단. |
| **D2. "내 프로필 →" 링크가 AdminNav line 120-125와 헤더 line 125-133에 중복** | 헤더 우측에 이미 "내 프로필" 노출되는데 AdminNav 안에도 또 있음. | AdminNav에서 "내 프로필 →" 링크 제거 → 우측 아바타 드롭다운으로 통합. 단, 헤더가 어드민 영역에서 새 디자인으로 교체되므로 둘 다 한 번에 정리. |
| **D3. UserNav의 "매니저/어드민 영역으로 →" 링크가 헤더의 동일 기능과 중복** | 헤더에서 이미 isStaff일 때 "어드민" 버튼 노출(line 115-122). UserNav에서 또 함. | UserNav의 해당 링크를 아바타 드롭다운으로 통합 (또는 본 작업 범위에서는 버그 수정만 하고 통합은 추후). |

### 6.3 오류 가능성

| 항목 | 오류 내용 | 완화 |
|:-|:-|:-|
| **E1. UserNav line 44 매니저 → /admin/users → notFound() 발생 (확정 버그)** | `requireRole(['admin'])` 실패로 매니저가 404 보게 됨. | **즉시 수정 (P0)**. `/admin/tickets`로 변경. |
| **E2. `data-role` SSR/CSR 미스매치 시 hydration 경고** | 서버에서 `data-role="admin"` 렌더 → 클라이언트에서 시점 보기 쿠키 감지 후 `"hotelier"` 변경 시 hydration mismatch. | 서버에서 쿠키 읽어 SSR 결과에 이미 반영하거나, RoleScope를 `suppressHydrationWarning`로 처리. 옵션 1 우선. |
| **E3. ChatbotFab의 embedUrl 환경변수 미설정 시 빈 iframe** | 호텔리어 시점 모드로 진입 시 챗봇 FAB 노출되는데, `getChatbotEmbedUrl()`가 undefined 반환할 수 있음. | 기존 동작과 동일. 본 작업에서 새로 만들지 않음. 회귀 없음 확인만. |
| **E4. 다크모드 + 호텔리어 + 작은 텍스트 가독성** | green-300/400 등 옅은 톤이 다크모드에서 명도 부족할 수 있음. WCAG AA 기준 4.5:1 미달 위험. | QA에서 모든 조합 캡처 + Lighthouse 컨트라스트 검사. 미달 시 dark variant 별도 정의. |
| **E5. 시점 보기 쿠키가 다른 탭/세션과 공유** | 매니저가 시점 보기 켜고 다른 탭 열면 어드민 작업 탭도 호텔리어 톤으로 보임. | 쿠키 대신 sessionStorage 또는 URL 파라미터 사용 검토. Design 단계에서 결정. (현재안: 쿠키 — 하지만 명확히 토글 가능한 UI 제공) |
| **E6. AdminNav 매니저 자물쇠 메뉴 클릭 시 404** | 자물쇠 아이콘 메뉴를 실수로 클릭 가능하게 두면 매니저가 404 봄. | 자물쇠 메뉴는 `<button disabled>` 또는 onClick 막힘 + tooltip만. Link 컴포넌트 사용 금지. |
| **E7. Server Component에서 쿠키 read는 dynamic 강제** | 미들웨어 또는 layout에서 cookies() 읽으면 force-dynamic. 캐싱 안됨. | 영향 페이지 (admin, user 그룹)는 이미 `dynamic = 'force-dynamic'` 적용중. 호텔리어 공개 페이지는 영향 없음 (시점 보기 진입은 인증 필요). |

### 6.4 회귀 위험 (Regression)

| 항목 | 위험 | 완화 |
|:-|:-|:-|
| **R1. 50+ 파일이 brand-* 사용 — 토큰 변경 시 한 곳이라도 누락 시 시각 깨짐** | 매니저·호텔리어 토큰 50~950 11단계 × 각 1줄 = 11줄 정도 추가, 실수 가능성. | 토큰 추가 후 즉시 visual regression 시각 검수 (각 역할 페이지 캡처). Tailwind는 className 컴파일 시점 결정이므로 빌드 에러 안 남. |
| **R2. 헤더 분리 시 비로그인 페이지(`/login`, `/`)의 헤더 노출 정책** | `app/layout.tsx`의 Header를 RoleScope 안으로 옮기면 비로그인 페이지에서 헤더가 안 보일 위험. | 비로그인 = 호텔리어 톤 default + Header 노출 (현재 동작 유지). RoleScope 기본값을 적절히 설정. |
| **R3. 모바일에서 헤더 동작** | 현재 mobileOpen state, 메뉴 토글 등이 잘 동작하므로 신규 컴포넌트로 인한 회귀 가능. | 헤더 구조 변경 최소화. 신규 props만 추가하고 기존 markup 유지. |
| **R4. next-themes 다크모드 토글 영향** | `<html>` 클래스가 next-themes에 의해 관리되는데, RoleScope가 같은 노드 건드리면 충돌. | RoleScope는 `<body>` 또는 그 하위에만 적용. `<html>`은 next-themes 전용. |

---

## 7. 작업 범위 (Scope)

### 7.1 In Scope (P0)

- ✅ **A. globals.css 토큰 추가** (매니저/호텔리어 50~950)
- ✅ **B. UserNav 매니저 링크 버그 수정**
- ✅ **C. 라우트 그룹 layout에 `data-role` 부여**
- ✅ **D. 루트 layout의 호텔리어 UI를 어드민 영역에서 비노출**
- ✅ **E. 어드민/매니저 헤더 분리 (최소 — 호텔리어 GNB 안 보이게)**

### 7.2 In Scope (P1)

- ✅ **F. AdminNav 메뉴 그룹화** (티켓운영 / 콘텐츠 / 조직&마스터)
- ✅ **G. 매니저용 어드민 전용 메뉴 자물쇠 표시**
- ✅ **H. AdminNav "내 프로필 →" 우측 아바타 드롭다운으로 이동**

### 7.3 In Scope (P2)

- ✅ **I. 호텔리어 시점 보기 모드** (쿠키 + 미들웨어 + 배너 + 토글)
- ✅ **J. 어드민/매니저/호텔리어 아바타 드롭다운**

### 7.4 Out of Scope (별도 Phase)

- ❌ `/profile/staff` 권한 호텔리어 전용 명시
- ❌ 이중 권한 체크 리팩토링
- ❌ 직원 관리를 프로필 하위에서 분리 (IA 개편)
- ❌ as.oapms.com 정확한 HEX 재확인 (사용자 확인 후 토큰만 조정)

---

## 8. Phase 계획

### Phase 0. 사전 준비 (0.5일)
- [ ] 미들웨어 존재 여부·NextAuth 통합 패턴 확인
- [ ] 다크모드 토큰 6조합 시각 시뮬레이션 (Figma 또는 HTML 프로토타입)
- [ ] as.oapms.com HEX 재확인 (사용자 요청 시)

### Phase 1. 토큰 + 버그 수정 (0.5일) — P0
- [ ] `globals.css` 매니저/호텔리어 토큰 추가
- [ ] `UserNav` line 44 버그 수정 + 디자인 정리
- [ ] (admin) layout `data-role` 부여
- [ ] (user) layout `data-role` 부여
- [ ] 시각 검수: 어드민·매니저·호텔리어 각 페이지 캡처

### Phase 2. 헤더·레이아웃 분리 (1일) — P0
- [ ] `RoleScope` 컴포넌트 신규 (`data-role` + Header/Banner/FAB 조건부 렌더)
- [ ] `app/layout.tsx` 리팩토링 (호텔리어 UI를 RoleScope 안으로)
- [ ] (admin) 진입 시 호텔리어 GNB·챗봇 FAB·EmergencyBanner 비노출 확인
- [ ] 비로그인 페이지(/login, /) 헤더 정상 동작 확인 (회귀 검사)

### Phase 3. AdminNav 재구조화 + 자물쇠 (1일) — P1
- [ ] AdminNav 메뉴 그룹화 (3그룹)
- [ ] 매니저용 자물쇠 메뉴 (disabled + tooltip)
- [ ] "내 프로필 →" 제거 → 우측 아바타 드롭다운 (`admin-user-menu.tsx`)
- [ ] 어드민/매니저 배지를 헤더 좌측 또는 아바타 옆에 명확히

### Phase 4. 시점 보기 모드 (1.5일) — P2
- [ ] `lib/view-mode.ts` 쿠키 read/write
- [ ] `middleware.ts` 신규 (또는 NextAuth withAuth 확장)
- [ ] `ViewModeBanner` 컴포넌트
- [ ] 아바타 드롭다운에 토글 추가
- [ ] 매니저·어드민 모두 토글 가능

### Phase 5. QA + 다크모드 검수 (1일) — All
- [ ] 6조합 (3역할 × light/dark) 시각 캡처
- [ ] WCAG AA 컨트라스트 검사 (Lighthouse)
- [ ] 매니저 자물쇠 메뉴 클릭 시 404 안 발생 확인
- [ ] 호텔리어 시점 보기 ON/OFF 토글 정상 동작
- [ ] /tickets, /admin/tickets, /profile, /faq 각 페이지 회귀 검사
- [ ] HTML 개발 일지 작성 (docs/dev-logs/YYYY-MM-DD.html)

---

## 9. 리스크 & 완화 전략

| 리스크 | 영향 | 발생 가능성 | 완화 |
|:-|:-|:-|:-|
| as.oapms.com 실제 컬러가 `#166534`와 다름 | 중 | 중 | Phase 0에서 사용자 재확인. 토큰만 교체 (코드 변경 0건). |
| 토큰 변경 후 시각 깨진 컴포넌트 발견 | 중 | 중 | Phase 1 끝나면 즉시 시각 검수. 깨진 곳은 개별 처리. |
| 매니저/어드민 사용 중인 사용자 혼란 | 중 | 낮 | 변경 사항 in-app 공지(notice). 첫 진입 시 "변경됐어요" 토스트. |
| 시점 보기 쿠키가 보안 이슈로 오인 | 낮 | 낮 | 서버 권한 체크는 항상 user.role 사용 명시. 코드 주석. |
| 다크모드 호텔리어 가독성 미달 | 중 | 중 | QA에서 모든 조합 검수. green-300/400 다크모드 변형 필요 시 별도 토큰. |
| 미들웨어 도입으로 인한 캐싱 손실 | 낮 | 낮 | (admin), (user) 그룹은 이미 force-dynamic. 영향 미미. |
| 회귀 — 기존 50+ 파일 일부에서 시각 깨짐 | 높 | 낮 | 토큰만 바꾸고 className은 안 건드림. 다만 시각 검수 필수. |

---

## 10. 검증 기준 (Check Phase 통과 조건)

### 10.1 기능 검증

- [ ] 어드민 로그인 → 어드민 영역 → 보라색 톤
- [ ] 매니저 로그인 → 어드민 영역 → 코발트 톤
- [ ] 호텔리어 로그인 → 모든 페이지 진녹색 톤
- [ ] /admin 진입 시 호텔리어 GNB·챗봇 FAB·EmergencyBanner 비노출
- [ ] 호텔리어 로그인 → /admin URL 직접 입력 시 404
- [ ] 매니저 로그인 → /profile에서 "어드민/매니저 영역으로 →" 클릭 시 /admin/tickets로 정상 이동 (404 X)
- [ ] 매니저 → AdminNav 자물쇠 메뉴는 클릭 안 됨 + tooltip 표시
- [ ] 매니저·어드민 → 아바타 드롭다운 → "호텔리어 시점으로 보기" 토글 → 호텔리어 톤으로 즉시 전환
- [ ] 시점 보기 ON 상태에서 상단 배너 노출 + "돌아가기" 클릭 시 원래 모드로 복귀

### 10.2 시각·접근성 검증

- [ ] 6조합 (3역할 × light/dark) 모두 시각 일관성 확인
- [ ] 모든 텍스트·버튼 WCAG AA 컨트라스트 4.5:1 충족
- [ ] 모바일(< 768px) 헤더 동작 정상
- [ ] 색맹 시뮬레이션 (deuteranopia, protanopia)에서도 역할 구분 가능 (배지·아이콘 보조)

### 10.3 회귀 검증

- [ ] 기존 50+ brand-* 사용 파일 시각 정상 (스팟체크 10개)
- [ ] /login, /, /faq, /help, /status, /notices, /tickets, /tickets/new, /troubleshoot 페이지 정상
- [ ] /admin/tickets, /admin/articles, /admin/faqs, /admin/users 정상
- [ ] 다크모드 토글 정상 동작
- [ ] 모바일 메뉴 햄버거 정상 동작

### 10.4 코드 품질 검증

- [ ] `npm run build` 성공
- [ ] TypeScript 에러 0
- [ ] ESLint warning 추가 0
- [ ] 신규 컴포넌트에 적절한 prop 타입 정의
- [ ] middleware 도입 시 NextAuth와 충돌 없음

---

## 부록 A. 변경 파일 매트릭스

### A.1 신규 파일

| 경로 | 라인 추정 | 역할 |
|:-|:-:|:-|
| `components/layout/role-scope.tsx` | ~80 | data-role 속성 + 호텔리어 UI 조건부 노출 |
| `components/layout/view-mode-banner.tsx` | ~40 | 시점 보기 모드 배너 |
| `lib/view-mode.ts` | ~50 | 쿠키 read/write/clear |
| `lib/hooks/use-view-mode.ts` | ~30 | 클라이언트 훅 |
| `middleware.ts` | ~30 | 쿠키 → 헤더 변환 (NextAuth 통합 시 더 길어질 수 있음) |
| `app/(admin)/admin/_components/admin-user-menu.tsx` | ~100 | 어드민/매니저 아바타 드롭다운 |
| `app/(user)/_components/user-account-menu.tsx` | ~80 | 호텔리어 아바타 드롭다운 (선택 — UserNav 통합 가능) |

### A.2 수정 파일

| 경로 | 변경 요약 |
|:-|:-|
| `app/globals.css` | 매니저/호텔리어 토큰 22줄 추가 |
| `app/layout.tsx` | RoleScope 적용, 호텔리어 UI 조건부 노출 |
| `app/(admin)/admin/layout.tsx` | `data-role` 부여 |
| `app/(user)/layout.tsx` | `data-role` 부여 |
| `app/(admin)/admin/_components/admin-nav.tsx` | 메뉴 그룹화, 자물쇠, "내 프로필 →" 제거 |
| `app/(user)/_components/user-nav.tsx` | line 44 버그 수정, 디자인 정리 |
| `components/layout/header.tsx` | 시점 모드 감지 props, 호텔리어 배지 |

### A.3 비-수정 파일 (검증만)

50+ 파일이 `brand-*`를 사용하지만 본 작업에서 **0줄 수정**. 토큰 변경으로 자동 반영. 단, 시각 검수는 필수.

---

## 부록 B. 다음 단계

1. **본 Plan 사용자 승인**
2. **`/pdca design role-mode-ui`** — Design 문서 작성 (컴포넌트 다이어그램, 미들웨어 chain, 쿠키 스펙 등 상세화)
3. **`/pdca do role-mode-ui`** — Phase 1부터 순차 구현
4. **Phase 1 완료 시 상세 보고 → 사용자 승인 → Phase 2 진행** (CLAUDE.md "Phase 진행 보고" 룰 준수)
5. **`/pdca analyze role-mode-ui`** — Gap 분석
6. **`/pdca report role-mode-ui`** — 완료 보고서 + HTML 개발 일지

---

## 부록 C. 참조

- 직전 진단 보고서 (대화 #1): Action 1~7 매트릭스
- 프로젝트 CLAUDE.md: 역할 3종 정의, 핵심 행동 규칙
- docs/IMPLEMENTATION_PLAN.md: 권한 매트릭스 (line 170-190)
- docs/dev-rules.md: 디자인 시스템 규칙
- Tailwind CSS 4 `@theme` 디렉티브 공식 문서
- WCAG 2.2 AA 색 대비 기준
