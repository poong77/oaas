# Phase 1 — 인증·권한·프로필 Design

> 작성일: 2026-05-28
> 범위: Phase 1 (PM-04, AC-01~AC-10, 그리고 마스터 데이터 일부 — 카테고리·호텔)
> 참조: `docs/IMPLEMENTATION_PLAN.md` §1 (기능), §5 (권한), §7 (스키마)

---

## 1. 결정 사항 요약

| 결정 | 선택 | 이유 |
|:-|:-|:-|
| Auth 라이브러리 | **NextAuth.js v5 (Auth.js)** | Next 16 App Router 네이티브, edge 호환 |
| Session 전략 | **JWT** | DB 어댑터 마이그레이션 미실행 (placeholder DB) |
| Provider 1 | **Credentials (dev-stub)** | `AUTH_DEV_STUB=true`일 때 시드 계정으로 로그인 가능 |
| Provider 2 | **OA SSO (OIDC)** | `OA_SSO_ISSUER` 비어있지 않을 때만 활성화 (Phase 1에선 placeholder) |
| 비밀번호 | **bcryptjs cost 12** | dev-rules.md §7 명시. Edge 호환 위해 bcryptjs (native bcrypt X) |
| 권한 체크 | `requireRole(roles[])` Server-side | RSC + Route Handler 양쪽에서 사용 |
| 클라이언트 hook | `useCurrentUser()` (`useSession` 래퍼) | 컴포넌트에서 role 분기 |
| SMS (Phase 1) | **솔라피 SDK stub** | 키 없으므로 `console.log('[SMS STUB]', ...)`. fire-and-forget |
| 이메일 (Phase 1) | **AWS SES v2 SDK 실제 발송** | oa-marketing 재사용 키, `noreply@oapms.com` 검증 완료 |
| 감사 로그 | `lib/audit.ts` fire-and-forget | `.catch(() => {})`, append-only, is_active 없음 |

---

## 2. DB 스키마 (Phase 1 한정)

### 2.1 도메인 ERD

```
hotels (1) ─< (N) users
  │                │
  └ activity_logs (N) ─ user_id (nullable)

categories (단일 테이블, 4 type)
  - product / issue_type / urgency / impact

activity_logs (append-only, is_active 없음)
```

### 2.2 테이블별 컬럼 명세

#### `hotels`
| 컬럼 | 타입 | 제약 | 비고 |
|:-|:-|:-|:-|
| id | uuid | PK, default `gen_random_uuid()` | |
| name | text | not null | |
| oa_pms_hotel_id | text | unique nullable | OA PMS 시스템 식별자 |
| business_no | text | nullable | 사업자번호 |
| address | text | nullable | |
| phone | text | nullable | |
| manager_name | text | nullable | 호텔 측 주 담당자 |
| note | text | nullable | 어드민 메모 |
| created_at | timestamptz | not null default now() | |
| updated_at | timestamptz | not null default now() | $onUpdate |
| is_active | boolean | not null default true | |

#### `users`
| 컬럼 | 타입 | 제약 | 비고 |
|:-|:-|:-|:-|
| id | uuid | PK | |
| hotel_id | uuid | FK → hotels(id), nullable | 매니저/어드민은 nullable |
| email | text | unique, not null | |
| name | text | not null | |
| title | text | nullable | 직책 |
| phone | text | nullable | 010-xxxx-xxxx |
| password_hash | text | nullable | SSO 전용 사용자는 null 가능 |
| role | enum('hotelier'\|'manager'\|'admin') | not null default 'hotelier' | |
| last_login_at | timestamptz | nullable | |
| sso_subject | text | unique nullable | OA SSO `sub` 클레임 |
| must_change_password | boolean | not null default false | AC-09 임시 비번 발급 후 강제 변경 |
| invited_by | uuid | FK → users(id), nullable | AC-04/AC-07 |
| created_at, updated_at, is_active | (공통) | | |

#### `categories`
| 컬럼 | 타입 | 제약 | 비고 |
|:-|:-|:-|:-|
| id | uuid | PK | |
| type | enum('product'\|'issue_type'\|'urgency'\|'impact') | not null | |
| code | text | not null | (type, code) unique 인덱스 |
| label | text | not null | 표시 라벨 |
| icon | text | nullable | lucide-react 아이콘명 |
| sort_order | integer | not null default 0 | |
| meta | jsonb | not null default `{}` | 자유형 메타 |
| created_at, updated_at, is_active | (공통) | | |

**유니크 인덱스**: `categories_type_code_uq (type, code)`

#### `solution_link_presets` (AC-02 기본 옵션)
| 컬럼 | 타입 | 제약 | 비고 |
|:-|:-|:-|:-|
| id | uuid | PK | |
| label | text | not null | 'PMS', 'Keyless', '홈페이지' 등 |
| default_url_template | text | nullable | `https://hotel-${slug}.example.com` 등 |
| icon | text | nullable | |
| sort_order | integer | not null default 0 | |
| created_at, updated_at, is_active | (공통) | | |

#### `hotel_solution_links` (AC-02 호텔별 실 데이터)
| 컬럼 | 타입 | 제약 | 비고 |
|:-|:-|:-|:-|
| id | uuid | PK | |
| hotel_id | uuid | FK → hotels(id), not null | |
| label | text | not null | |
| url | text | not null | |
| sort_order | integer | not null default 0 | |
| created_at, updated_at, is_active | (공통) | | |

> 호텔당 최대 5개는 애플리케이션 레벨에서 검증 (UI에서 추가 버튼 비활성화 + Server Action에서 재확인).

#### `activity_logs` (append-only)
| 컬럼 | 타입 | 제약 | 비고 |
|:-|:-|:-|:-|
| id | uuid | PK | |
| user_id | uuid | FK → users(id), nullable | 비로그인 액션도 기록 가능 |
| action | text | not null | 'user.create', 'user.role_change', 'user.password_reset' 등 |
| target_type | text | nullable | 'user', 'hotel' 등 |
| target_id | uuid | nullable | |
| payload | jsonb | not null default `{}` | before/after diff 등 |
| ip | text | nullable | |
| user_agent | text | nullable | |
| created_at | timestamptz | not null default now() | |

**is_active 없음** (append-only). 인덱스: `activity_logs_user_idx (user_id, created_at DESC)`.

---

## 3. Auth 흐름

### 3.1 Provider 결정 로직

```
모듈 로드 시:
  providers = [Credentials(dev-stub)]
  if (env.AUTH_DEV_STUB === 'true') {
    Credentials 활성 (시드 비밀번호로 로그인)
  }
  if (env.OA_SSO_ISSUER) {
    OIDC(OASSO) 추가
  }
```

### 3.2 Credentials (dev-stub)

```
POST /api/auth/callback/credentials
  { email, password }
    ↓
  DB에서 users.email 조회 (is_active=true)
    ↓
  bcrypt.compare(password, user.password_hash)
    ↓
  성공 시 jwt 발급, last_login_at 갱신, activity_logs('user.login') 기록
```

### 3.3 OA SSO (OIDC, Phase 1에선 placeholder)

```
claims → user
  sub  → users.sso_subject (unique)
  email → users.email (없으면 신규 생성, 호텔리어 role)
  name  → users.name
  custom 'hotel_id' → users.hotel_id 매핑 (없으면 보류 = is_active=false 또는 hotel_id=null 후 어드민이 매핑)
```

**임시값 표시**: `// TODO(phase-1-temp): SSO 클레임 명세 확정 후 hotel_id 매핑 로직 교체`

### 3.4 JWT 콜백

- `jwt({ token, user, trigger })`: 첫 로그인 또는 `trigger==='update'`일 때 DB에서 role/hotel_id/name 조회해 token에 주입
- `session({ session, token })`: token의 role/hotel_id/id를 session.user에 노출

---

## 4. 권한 매트릭스 (코드 매핑)

| 페이지 | 호텔리어 | 매니저 | 어드민 |
|:-|:-:|:-:|:-:|
| `/profile` | 본인 hotel만 | 본인 hotel만 | 본인 hotel만 (없을 수 있음) |
| `/profile/staff` | 본인 호텔 직원 CRUD | (동일) | (동일) |
| `/admin/users` | ✕ (403) | ✕ (403) | ● |
| `/admin/users/[id]` | ✕ | ✕ | ● |
| `/admin/users/new` | ✕ | ✕ | ● |
| `/admin/hotels` | ✕ | 조회만 (Phase 1엔 어드민만) | ● |

**보호 위치**:
1. `middleware.ts`: 비로그인 시 `/login` 리다이렉트 (`/admin/*`, `/profile/*`, `/tickets/*` 등)
2. 페이지 Server Component: `await requireRole(['admin'])` — 매니저/호텔리어가 접근 시 `notFound()` 또는 redirect
3. Server Action: `withAuthorizedAction(['admin'], async (ctx, input) => { ... })`

---

## 5. 페이지 구조

| 경로 | 그룹 | 역할 | 핵심 컴포넌트 |
|:-|:-|:-|:-|
| `/login` | (auth) | 비로그인 | dev-stub 폼 + (placeholder) SSO 버튼 |
| `/profile` | (user) | 호텔리어+ | ProfileInfoForm, ChangePasswordForm, SolutionLinks |
| `/profile/staff` | (user) | 호텔리어+ | StaffTable, StaffEditDialog |
| `/admin/users` | (admin) | 어드민 | UsersTable (검색·필터·정렬·페이징), MobileUsersList |
| `/admin/users/new` | (admin) | 어드민 | UserCreateForm |
| `/admin/users/[id]` | (admin) | 어드민 | UserEditForm, ActiveToggle, ResetPasswordButton |
| `/admin/hotels` | (admin) | 어드민 | HotelsTable, HotelEditDialog |

**공통 UI 컨벤션** (dev-rules.md §4):
- 모든 리스트: Card 래퍼 + 데스크탑 Table + 모바일 카드뷰 + EmptyState + 페이지네이션 + 정렬
- 폼: react-hook-form + zod resolver
- 삭제·민감 작업은 모두 `useConfirmDialog()` 경유
- 토스트: `sonner`

---

## 6. 외부 클라이언트

### 6.1 `lib/notifications/ses.ts` (실제 발송)

```ts
sendEmail({ to, subject, html, text? }) → Promise<{ ok, messageId? }>
```

- `@aws-sdk/client-sesv2` 사용
- 키 없으면 console.log + 성공 반환 (graceful)
- fire-and-forget으로 호출되도록 호출부에서 처리

### 6.2 `lib/notifications/solapi.ts` (Phase 1 stub)

```ts
sendSms({ to, text }) → Promise<{ ok, messageId? }>
```

- `SOLAPI_API_KEY` 비어있으면 `console.log('[SMS STUB]', { to, text })` 반환

### 6.3 `lib/notifications/templates.ts`

```ts
buildAccountInvite({ name, email, tempPassword, loginUrl }) → { subject, html, text, sms }
buildPasswordReset({ name, tempPassword, loginUrl }) → { subject, html, text, sms }
```

- 현재 하드코딩, Phase 9에서 DB(notification_templates)로 이전
- `// TODO(phase-1-temp): templates 하드코딩, Phase 9에서 어드민 편집 가능 DB로 이전`

---

## 7. 감사 로그

### 7.1 기록 대상 (Phase 1)

| action | trigger |
|:-|:-|
| `user.login` | dev-stub 또는 SSO 성공 |
| `user.create` | 어드민/호텔리어가 새 계정 생성 |
| `user.update` | 프로필 수정, 어드민 편집 |
| `user.role_change` | role 변경 (어드민 only) |
| `user.activate` / `user.deactivate` | is_active 토글 |
| `user.password_change` | 본인 변경 |
| `user.password_reset` | 어드민 비번 초기화 |
| `hotel.create` / `hotel.update` | 호텔 마스터 변경 |
| `solution_link.upsert` / `solution_link.delete` | 솔루션 링크 변경 |

### 7.2 `lib/audit.ts`

```ts
logActivity({
  userId?, action, targetType?, targetId?, payload?, req?
}): void  // fire-and-forget, 항상 즉시 반환
```

내부적으로 `Promise.resolve().then(() => insert).catch(() => {})`로 처리. 호출부는 await 하지 않음.

---

## 8. 시드 데이터 (`db/seed.ts`)

| 데이터 | 수량 | 비고 |
|:-|:-:|:-|
| categories (product) | 6 | PMS, CMS, Keyless, 키오스크, 웹서비스, 설정 |
| categories (issue_type) | 6 | 오류, 장애, 기능문의, 기능개발, 데이터수정, 기타 |
| categories (urgency) | 3 | P1, P2, P3 |
| categories (impact) | 4 | 전체호텔, 단일호텔, 단일사용자, 정보성 |
| solution_link_presets | 4 | PMS, Keyless, 홈페이지, 기타 |
| hotels | 1 | '샘플 호텔' (oa_pms_hotel_id=null) |
| users | 3 | 어드민(`admin@oa.local`), 매니저(`manager@oa.local`), 호텔리어(`hotelier@oa.local`) — 비번 `oa1234!` (bcrypt cost 12) |

**실행 명령**: `npm run db:seed` (사용자가 DB 연결 후 실행)

---

## 9. 빌드 안전 가드

placeholder DB로도 `npm run build` 통과해야 함.

- 모든 페이지에서 DB를 조회하는 Server Component는 `export const dynamic = 'force-dynamic'` 명시
- `app/page.tsx` (LP 기본 홈)는 DB 조회 X (정적)
- 빌드 중 `(...)` 라우트 그룹의 prerender 시점에 DB 호출 발생 안 하도록 lazy 패턴 유지

---

## 10. 임시값 추적 (`// TODO(phase-1-temp):`)

| 위치 | 내용 | 교체 시점 |
|:-|:-|:-|
| `lib/auth.ts` (OASSO provider) | 클레임 매핑 (`hotel_id` 자리) | OA PMS SSO 명세 확정 |
| `lib/notifications/templates.ts` | 하드코딩 SMS/Email 본문 | Phase 9 (어드민 마스터) |
| `lib/notifications/solapi.ts` | SMS console.log stub | SOLAPI 키 발급 시 |
| `.env` DATABASE_URL | placeholder | 통합AS 전용 Neon URL 받는 즉시 |
| `lib/auth.ts` NEXTAUTH_SECRET | dev 임시값 | 프로덕션 배포 전 강한 시크릿 교체 |

---

## 11. Phase 1 완료 후 후속 작업

- (사용자) 통합AS 전용 Neon URL 발급 → `.env` 교체 → `npm run db:push && npm run db:seed`
- (사용자) OA PMS SSO 명세 공유 → `lib/auth.ts` 매핑 로직 교체
- (Phase 2) LP 홈 시작 (현재 Phase 0 홈 → 실제 LP-01 구조)
