# Phase 2 — 랜딩 페이지 Design

> 작성일: 2026-05-28
> 범위: Phase 2 (LP-01 통합 홈 · LP-02 GNB · LP-03 서비스 상태 · LP-05 모바일 반응형 · NT-03 긴급 배너)
> 참조: `docs/IMPLEMENTATION_PLAN.md` §1 (기능 LP/NT), §7 (스키마)

---

## 1. 결정 사항 요약

| 결정 | 선택 | 이유 |
|:-|:-|:-|
| 홈 페이지 구조 | **9 섹션 컴포넌트 분할** | 각 섹션을 별도 컴포넌트로 분리해 Phase 3+에서 데이터 교체 용이 |
| 검색 인풋 위치 | **홈 Hero + 헤더(md 이상)** | 모바일은 Hero에 집중, 데스크탑은 GNB에서 접근 가능 |
| 인기검색어 | **하드코딩 5개** | `popular_keywords` 테이블은 Phase 5 이후. Phase 2에서는 자리만 |
| 카테고리 6개 | **`categories where type='product'` 조회** | 시드된 데이터 그대로 사용. graceful: DB 미연결 시 하드코딩 fallback |
| 자주찾는작업 | **하드코딩 5개 (한 줄 상수)** | `quick_actions` 테이블 미구현. Phase 9에서 마스터 추가 |
| 역할별 시작하기 | **하드코딩 5개 + placeholder 라우트** | `role_starters` 테이블 미구현. `/role/[key]` 자리만 |
| 서비스 상태 | **신규 `service_status` 테이블** | `LP-03` 스펙대로 enum 4종 · 최신 1건 조회 패턴 |
| 긴급 배너 (NT-03) | **헤더 위 sticky 빨강 배너** | `incident` 상태일 때만 RSC가 layout에서 자동 노출 |
| 검색 결과 페이지 | **placeholder만 (Phase 3 실 구현)** | `/search?q=...` 라우트 자리잡기 + 카테고리 카드 noise 방지 |
| placeholder 페이지 디자인 | **EmptyState + PageHeader + 안내 카드** | "날것의 페이지 금지" — 헤딩/안내/다음 Phase 명시 |
| 다크모드 | 기존 next-themes 기반 | Phase 0 셋업 그대로 |

---

## 2. DB 스키마 (신규: `service_status`)

### 2.1 ERD (Phase 2 추가분)

```
service_status (append-but-soft-deletable)
  - status enum('normal' | 'degraded' | 'incident' | 'maintenance')
  - message text
  - started_at / ended_at
  - created_by → users.id (nullable)
```

### 2.2 컬럼 명세

| 컬럼 | 타입 | 제약 | 비고 |
|:-|:-|:-|:-|
| id | uuid | PK, `gen_random_uuid()` | 공통 |
| status | `service_status_enum` | not null | normal/degraded/incident/maintenance |
| message | text | nullable | incident/degraded일 때 사용자에게 노출 |
| started_at | timestamptz | not null, default now() | 상태 시작 시각 |
| ended_at | timestamptz | nullable | 다음 상태로 전환 시 채워짐 |
| created_by | uuid | FK → users.id, on delete set null | 매니저/어드민 식별 |
| created_at, updated_at, is_active | 공통 | | |

### 2.3 운영 패턴

- **상태 변경 = 새 row insert**
- 직전 row는 `is_active=false`, `ended_at=now()`로 마감
- 공개 조회: `select * from service_status where is_active=true order by started_at desc limit 1`
- 이력 조회: `select * from service_status order by started_at desc limit 20`
- 시드 1건: `status='normal'`, `message='모든 서비스 정상'`, `started_at=now()`

### 2.4 pgEnum 추가 위치

`db/schema/_shared.ts`에 다음 추가:

```ts
export const serviceStatusEnum = pgEnum('service_status', [
  'normal',
  'degraded',
  'incident',
  'maintenance',
]);
```

---

## 3. 페이지 구조

### 3.1 `/` (LP-01 통합 홈) — 9 섹션 모바일 우선

```
┌────────────────────────────────────────┐
│  Header (긴급 배너 incident일 때 위)   │
├────────────────────────────────────────┤
│  ① Hero + 통합 검색창                  │
│     "어떤 도움이 필요하세요?"           │
│     (엔터 → /search?q=...)              │
├────────────────────────────────────────┤
│  ② 인기검색어 칩 (5개 하드코딩)         │
├────────────────────────────────────────┤
│  ③ 카테고리 그리드 (6개)                │
│     PMS / CMS / Keyless /              │
│     키오스크 / 웹서비스 / 설정          │
│     (모바일 2열, sm: 3열, lg: 6열)      │
├────────────────────────────────────────┤
│  ④ 자주찾는작업 (5개 하드코딩)          │
├────────────────────────────────────────┤
│  ⑤ 역할별 시작하기 (5개)                │
│     프론트 / 예약·판매 / 하우스키핑 /   │
│     관리자 / 신규오픈                   │
├────────────────────────────────────────┤
│  ⑥ 서비스 상태 위젯 (LP-03)             │
│     normal → 녹색 / degraded → 황색 /   │
│     incident → 빨강                     │
├────────────────────────────────────────┤
│  ⑦ 최근 업데이트 (placeholder)          │
│     EmptyState — Phase 7 안내          │
├────────────────────────────────────────┤
│  ⑧ CTA 3개                              │
│     일반접수 / 오류접수 / 내 문의        │
├────────────────────────────────────────┤
│  ⑨ 푸터                                 │
│     긴급 전화문의 카드 + 약관 + © OA    │
└────────────────────────────────────────┘
```

### 3.2 컴포넌트 분할

```
app/page.tsx               — RSC (DB에서 categories, service_status 조회)
  ├─ <HomeHero />          — 검색 입력 + 인기검색어 (client, useRouter)
  ├─ <CategoryGrid />      — 6 categories (server, props로 받음)
  ├─ <QuickActions />      — 하드코딩 액션 (server)
  ├─ <RoleStarters />      — 5 역할 (server)
  ├─ <ServiceStatusWidget /> — DB 조회 결과 (server, props)
  ├─ <RecentUpdates />     — EmptyState (server)
  ├─ <HomeCTA />           — 3개 CTA (server)
  └─ <HomeFooter />        — 푸터 (server)
```

### 3.3 `/admin/service-status` (매니저+어드민)

- `app/(admin)/admin/service-status/page.tsx` (server)
- 현재 상태 카드 + 이력 테이블 + 상태 변경 폼
- 권한: `requireRole(['manager', 'admin'])` — 어드민 layout에서 기본은 admin이므로 별도 가드 추가
- Server Action: `updateServiceStatus({ status, message })`
- `activity_logs` 기록 (`service_status.update`)

### 3.4 `/status` (공개 서비스 상태)

- 현재 상태 카드 + 최근 30일 이력 테이블
- DB 미연결 시 graceful (normal 가정)

### 3.5 placeholder 페이지

| 라우트 | 내용 |
|:-|:-|
| `/help` | "Phase 3에서 제품별 가이드 핸드북 추가 예정" + 6개 product 카드 |
| `/help/[product]` | "Phase 3에서 핸드북 추가 예정" + 안내 |
| `/notices` | "Phase 7에서 공지/업데이트 시스템 추가 예정" + EmptyState |
| `/role/[key]` | 5개 역할 가이드 placeholder |
| `/search` | 쿼리 표시 + Phase 3 안내 + 카테고리 카드 |
| `/tickets` | "Phase 6에서 내 문의 추가 예정" + 안내 카드 |
| `/tickets/new` | "Phase 5에서 이슈 접수 폼 추가 예정" + 안내 카드 |
| `/faq` | "Phase 4에서 FAQ 추가 예정" + 안내 |

---

## 4. 헤더 보강 (LP-02)

### 4.1 추가 요소

1. **상단 검색 인풋 (md 이상)** — 작은 인풋, Enter → `/search?q=`
2. **활성 메뉴 표시** — `usePathname()` 비교 후 brand 강조
3. **세션 표시** — `useCurrentUser()`로 로그인 상태 분기 (기존 유지)
4. **모바일 햄버거** — 기존 유지

### 4.2 긴급 배너 (NT-03)

- 위치: `app/layout.tsx`에서 헤더 위에 `<EmergencyBanner />` 추가
- 이 컴포넌트는 **서버 컴포넌트**: `getLatestServiceStatus()` 호출
- `status === 'incident'`이면 빨강 sticky 배너 노출
- 메시지는 plain text로만 렌더 (XSS 방지: JSX는 자동 escape, HTML 입력 거부)

```tsx
{latest.status === 'incident' && (
  <div role="alert" className="sticky top-0 z-50 bg-red-600 text-white">
    <div className="mx-auto max-w-6xl px-4 py-2 text-sm">
      <strong>[장애 발생]</strong> {latest.message}
      <Link href="/status">자세히 보기 →</Link>
    </div>
  </div>
)}
```

---

## 5. 서비스 (lib/services/service-status.ts)

```ts
export async function getLatestServiceStatus(): Promise<ServiceStatus | null>;
export async function listServiceStatusHistory(limit = 20): Promise<ServiceStatus[]>;
export async function changeServiceStatus(input: {
  status: ServiceStatusValue;
  message?: string;
  userId: string;
}): Promise<{ ok: true; id: string } | { ok: false; reason: string }>;
```

- 변경 로직: 트랜잭션 없이 순차 (1) 이전 active row UPDATE→is_active=false+ended_at=now (2) 새 row INSERT
- Neon HTTP는 멀티스테이트먼트 트랜잭션 비지원이므로 단발 SQL 2회. 동시성 충돌은 매우 낮음 (관리자만 호출).

---

## 6. 권한 매트릭스 (Phase 2)

| 라우트 | 호텔리어 | 매니저 | 어드민 |
|:-|:-:|:-:|:-:|
| `/` (홈) | ● | ● | ● |
| `/search`, `/help/*`, `/notices`, `/role/*`, `/status`, `/faq` | 비로그인도 OK | ● | ● |
| `/tickets`, `/tickets/new` | ● | ● | ● |
| `/admin/service-status` | ✕ | ● | ● |
| 기존 어드민 페이지 (users/hotels) | ✕ | ✕ | ● |

→ 어드민 layout(`requireRole(['admin'])`)을 매니저도 진입 가능하게 service-status만 별도 처리.
**해결**: `/admin/service-status`는 `(admin)/admin/service-status/page.tsx`에서 추가로 `requireRole(['manager','admin'])` 호출하되, layout가 차단하므로 layout 가드를 완화하지 않고 **별도 라우트 그룹 `(staff)/admin-staff/service-status`로 분리**하지 않는다. 대신 `admin layout`을 `['manager','admin']`으로 확장. **결정: admin layout 확장 (매니저도 어드민 메뉴 진입 가능, 단 메뉴별로 다시 권한 체크).**

> Phase 1에서는 admin layout이 `['admin']`만 허용했지만, Phase 2부터 매니저도 일부 메뉴(service-status)를 위해 진입 필요. layout은 `requireRole(['manager','admin'])`로 확장하고, **users/hotels 페이지 자체**에서 `requireRole(['admin'])`을 한 번 더 호출하여 사용자/호텔은 어드민 전용 유지.

---

## 7. 모바일 반응형 정책 (LP-05)

| 브레이크포인트 | Hero | 카테고리 | 자주찾는작업 | 역할 | CTA |
|:-|:-|:-|:-|:-|:-|
| `< sm` (640) | 검색 인풋 풀폭 | 2열 | 1열 | 1열 | 1열 스택 |
| `sm` | 검색 인풋 max-w-md | 3열 | 2열 | 2열 | 2열 |
| `md` | 검색 인풋 max-w-2xl | 3열 | 3열 | 3열 | 3열 |
| `lg+` | 동일 | 6열 | 5열 | 5열 | 3열 |

- 모바일에서 "긴급 전화문의" 카드는 Hero 바로 아래에 별도 강조 카드
- 검색 인풋: `text-base sm:text-sm` (모바일 줌 방지: 16px 이상)

---

## 8. 임시값 / TODO 목록

`// TODO(phase-2-temp):` 마커 위치:

| 위치 | 내용 | 해소 Phase |
|:-|:-|:-:|
| `app/page.tsx — POPULAR_KEYWORDS` | 인기검색어 5개 하드코딩 | Phase 5+ (`popular_keywords` 테이블) |
| `app/page.tsx — QUICK_ACTIONS` | 자주찾는작업 5개 하드코딩 | Phase 9 (`quick_actions` 테이블) |
| `app/page.tsx — ROLE_STARTERS` | 역할별 5개 하드코딩 | Phase 9 (`role_starters` 테이블) |
| `<RecentUpdates>` | 공지 EmptyState | Phase 7 (`notices` 테이블) |
| `/help/*`, `/notices`, `/faq` | placeholder 안내 | Phase 3 / 4 / 7 |
| `/search` | Phase 3 안내 | Phase 3 (실 검색) |
| `/tickets/*` | Phase 5/6 안내 | Phase 5, 6 |

---

## 9. 파일 변경/추가 목록

### 추가
- `db/schema/service-status.ts`
- `db/migrations/0001_*.sql` (drizzle-kit generate 결과)
- `db/migrations/meta/0001_snapshot.json`
- `lib/services/service-status.ts`
- `app/(admin)/admin/service-status/page.tsx`
- `app/(admin)/admin/service-status/_components/service-status-form.tsx`
- `app/(admin)/admin/service-status/_components/service-status-history.tsx`
- `app/actions/service-status-actions.ts`
- `app/status/page.tsx`
- `app/search/page.tsx`
- `app/help/page.tsx`
- `app/help/[product]/page.tsx`
- `app/notices/page.tsx`
- `app/role/[key]/page.tsx`
- `app/faq/page.tsx`
- `app/tickets/page.tsx`
- `app/tickets/new/page.tsx`
- `app/_components/home/home-hero.tsx`
- `app/_components/home/category-grid.tsx`
- `app/_components/home/quick-actions.tsx`
- `app/_components/home/role-starters.tsx`
- `app/_components/home/service-status-widget.tsx`
- `app/_components/home/recent-updates.tsx`
- `app/_components/home/home-cta.tsx`
- `app/_components/home/home-footer.tsx`
- `components/layout/emergency-banner.tsx`
- `components/ui/section-heading.tsx` (재사용 헤더)

### 수정
- `db/schema/_shared.ts` (service_status enum 추가)
- `db/schema/index.ts` (service-status export)
- `db/seed.ts` (service_status 기본 row 추가)
- `app/page.tsx` (LP-01 전면 교체)
- `app/layout.tsx` (EmergencyBanner 추가)
- `components/layout/header.tsx` (검색 인풋 + 활성 메뉴 + 어드민 진입)
- `app/(admin)/admin/_components/admin-nav.tsx` (service-status 탭 추가)
- `app/(admin)/admin/layout.tsx` (manager 진입 허용)
- `app/(admin)/admin/users/page.tsx` (admin only 가드 추가)
- `app/(admin)/admin/hotels/page.tsx` (admin only 가드 추가)

---

## 10. 빌드 통과 체크포인트

1. `npm run typecheck` — service_status 타입 추론 정상
2. `npm run lint` — `any` 금지, unused vars 경고만
3. `npm run build` — 모든 라우트 빌드 성공 (placeholder 페이지 포함)
4. `npx drizzle-kit generate` — 0001 SQL 생성

---

> 본 Design은 Phase 2 구현의 단일 소스. 구현 중 변경 시 이 파일도 함께 갱신.
