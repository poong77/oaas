# 개발 룰셋 — 통합 AS 플랫폼

> 코드 수정 시 항상 참조. 신규 규칙 추가 시 이 파일 먼저 갱신 후 코드.

---

## 1. 기술 스택 & 라이브러리

### Core
| 영역 | 선택 | 비고 |
|:-:|:-:|:-:|
| Framework | **Next.js 15** (App Router) | RSC + Server Actions + Route Handlers |
| Language | **TypeScript** | `strict: true` |
| DB | **Neon (PostgreSQL serverless)** | 추후 Cloudflare D1 이전 여지 |
| ORM | **Drizzle ORM** | type-safe, lightweight |
| Validation | **Zod** | 클라이언트+서버 공통 |
| Form | **React Hook Form** + Zod resolver | |
| Style | **Tailwind CSS 4** + **shadcn/ui** | |
| Auth | **NextAuth.js** (OA SSO Provider) | |
| State (Client) | **Zustand** | 글로벌 다이얼로그, 테마 등 |

### 외부 연동
| 서비스 | 라이브러리 | 용도 |
|:-:|:-:|:-:|
| 솔라피 (SMS) | `solapi` 공식 SDK | 접수·처리중·완료 알림, 직원 초대 |
| AWS SES | `@aws-sdk/client-sesv2` | 이메일 알림 |
| AWS S3 | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | 첨부파일 Presigned URL |
| Slack | `fetch` (Webhook URL) | `#as-new`, `#as-urgent`, `#dev-escalation` |
| oachat.ai | iframe 임베드 | 챗봇 |
| oapms.com SSO | OAuth/OIDC | 호텔 계정 SSO |

### 개발 도구
- **Drizzle Kit** — 스키마 push/migrate/studio
- **Playwright** — E2E (사용자 명시 요청 시만)
- **Vercel** — 배포 + Preview
- **GitHub** — 저장소 + Actions
- **ESLint + Prettier** — 코드 품질

---

## 2. 스킬 (Claude Code)

이 프로젝트에서 자주 쓰는 스킬:
- `/dev-javascript` — TypeScript/Next.js/React 작성·최적화
- `/dev-sql` — PostgreSQL 스키마·쿼리 설계
- `/frontend-design-merged` — UI 디자인 (모바일 우선)
- `/design-review` — UI 리뷰
- `/code-review` — 코드 리뷰
- `/test-e2e` — Playwright E2E (사용자 명시 요청 시만)
- `/report-doc` — 개발 일지 HTML 생성
- `/git-commit` — Conventional Commit 메시지
- `/git-pr` — PR 본문 생성

---

## 3. 코딩 컨벤션

### 명명
- **변수/함수**: `camelCase`
- **컴포넌트/타입/Interface**: `PascalCase`
- **상수**: `SCREAMING_SNAKE_CASE`
- **파일**: 라우트는 Next.js 규칙(`page.tsx`, `route.ts`, `layout.tsx`). 일반 모듈은 `kebab-case.ts`. 컴포넌트는 `PascalCase.tsx`
- **DB 테이블/컬럼**: `snake_case` (Drizzle 스키마는 카멜케이스 키 → DB는 스네이크)

### 폴더 구조 (제안)
```
/app
  /(public)              # 비로그인 또는 공개 영역
    page.tsx             # LP: 통합 홈
    /search              # SS-01 통합 검색
    /help/[slug]         # SS-03 도움말 상세
    /faq                 # SF-01
  /(user)                # 호텔리어 영역
    /tickets             # IC, IS
      new/page.tsx
      [id]/page.tsx
    /profile             # AC-01~05
  /(admin)               # 매니저·어드민
    /admin
      /tickets           # IS-04 티켓 큐
      /articles          # SS-06
      /faqs              # SF-04
      /notices           # NT
      /users             # AC-06~10
      /insights          # DI
      /master            # 마스터 데이터 편집 (어드민)
        /categories      # 제품·문제유형·긴급도·영향범위
        /forms           # 이슈접수 폼 필드
        /templates       # SMS/이메일 템플릿
        /quick-actions   # 자주찾는작업
        /role-starts     # 역할별 시작하기
        /solution-links  # 솔루션 링크 마스터
        /settings        # 시스템 설정
  /api                   # Route Handlers
    /auth/[...nextauth]
    /tickets
    /articles
    /upload              # Presigned URL 발급
/db
  schema.ts              # Drizzle 스키마 한 파일 (또는 도메인별 분리)
  index.ts               # db 클라이언트
  migrations/
/lib
  auth.ts                # NextAuth + OA SSO
  solapi.ts
  ses.ts
  slack.ts
  s3.ts
  permissions.ts         # 역할 체크 helper
  rate-limit.ts
/components
  /ui                    # shadcn/ui 기반 원시 컴포넌트
  /forms                 # 도메인 폼 (TicketForm 등)
  /dialogs               # ConfirmDialog, FormDialog
  /layout                # Header, GNB, Footer
/docs
  IMPLEMENTATION_PLAN.md
  dev-rules.md
  /dev-logs
```

### TypeScript
- `any` 금지 → `unknown` + 좁히기. 부득이한 경우 `// eslint-disable-next-line` + 사유 주석
- API 응답 타입 항상 정의 (서버↔클라이언트 일관성)
- Server/Client 명시: 클라이언트는 `'use client'` 최상단
- `interface` (확장 위주) vs `type` (조합 위주) 의도에 맞게

---

## 4. 디자인 시스템

### 메인 컬러
- **Primary**: OA 브랜드 컬러 기준 (아직 미정 → 우선 `slate` + `indigo`로 시작 후 확정)
- Tailwind 컬러 50~900 전체 스케일 정의 (`tailwind.config.ts`)

### 타이포그래피 (Figma 토큰)
- **폰트 크기·굵기·줄간격은 `text-*` 토큰 사용** — 원시값(`text-sm`, `font-bold`, `text-[28px]`) 직접 지정 금지
- 토큰은 `app/globals.css`의 `@theme` 블록에 `--text-{name}` 으로 정의 (Figma `textStyles.json` export 기준 35종)
- 이름 규칙: `text-{용도}-{크기}-{굵기}` (예: `text-heading-large-bold`, `text-body-medium-regular`)
  - 용도: `display`(36/48/60) · `heading`(20/24/32) · `title`(16/18) · `body`(12/14/16) · `label`(12/14/16) · `caption`(11)
- **타이포 ↔ 컬러 역할 분리**: 크기/굵기는 `text-*` 토큰, 색은 `text-brand-*`/`text-slate-*` 로 따로 지정
- 토큰 스케일에 없는 크기가 필요하면 임의값(`text-[Npx]`) 대신 **디자이너 확인 후 토큰 신설**

### 반응형 (모바일 우선)
- 호텔리어 대부분 모바일 환경 → **모바일 우선 설계**
- Breakpoint: sm(640) / md(768) / lg(1024) / xl(1280)
- 모든 신규 페이지: **모바일 카드뷰 + 데스크톱 테이블뷰** 양쪽 구현 필수

### 다크모드
- `next-themes` + Tailwind `dark:` 클래스 + 시스템 감지 + localStorage 저장
- 우상단 토글 버튼 (GNB)

### 컴포넌트 원칙
- **새 페이지 = 기존 페이지와 동일한 디자인 수준** (날것의 페이지 절대 금지)
- 리스트 페이지 필수 요소: Card 래퍼, 정렬, 필터, 검색, 페이지네이션, 모바일 카드뷰, EmptyState, 요약 통계 카드
- 폼 페이지: 단계형(stepper)은 모바일에서도 명확히 표시

### Confirm/Alert
- `window.confirm()` / `window.alert()` 금지
- 글로벌 `<ConfirmDialog>` 컴포넌트 (Zustand 트리거)
- 토스트는 `sonner` 또는 shadcn `<Toaster>` 사용

---

## 5. DB 규칙 (PostgreSQL + Drizzle)

### 공통 컬럼 (모든 비즈니스 테이블)
```ts
id: uuid('id').primaryKey().defaultRandom()
createdAt: timestamp('created_at').notNull().defaultNow()
updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date())
isActive: boolean('is_active').notNull().default(true)
```

### 소프트 삭제
- 물리 `DELETE` 금지 → `is_active = false`
- 리스트 쿼리에 `eq(table.isActive, true)` 조건 필수
- 물리 삭제가 정말 필요하면 사용자 확인 후 진행
- 비활성 계정의 접수 이력·메모는 보존

### 동적 필드 (JSONB)
- 어드민 편집형 폼 필드, 정보칩, 카테고리 메타 등은 PostgreSQL **JSONB** 활용
- Drizzle: `jsonb('custom_fields').$type<Record<string, unknown>>()`
- 인덱스가 필요한 키는 generated column으로 추출

### 정렬/페이징
- 리스트 API 파라미터: `sortBy`, `sortOrder`, `page`, `pageSize`, `q` (검색), `filter[...]`
- 기본값: `created_at DESC`, `page=1`, `pageSize=20`
- 응답: `{ items, total, page, pageSize }`

### 감사 로그
```ts
activity_logs (
  id uuid PK,
  user_id uuid FK,
  action text,              // 'ticket.status_change', 'user.role_update', ...
  target_type text,
  target_id uuid,
  payload jsonb,            // before/after
  ip text,
  user_agent text,
  created_at timestamptz
)
```
- 어드민 액션, 권한 변경, 티켓 상태 변경, 비밀번호 초기화 모두 기록
- **fire-and-forget**: 저장 실패가 메인 로직에 영향 주면 안 됨 (try/catch + 백그라운드)

---

## 6. API 규칙

### Route Handler 구조
- `/app/api/{resource}/route.ts` — GET(목록) / POST(생성)
- `/app/api/{resource}/[id]/route.ts` — GET(상세) / PATCH(수정) / DELETE(비활성)

### 응답 포맷
```ts
type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; details?: unknown }
```
- HTTP status 적절히 (200/201/400/401/403/404/409/422/429/500)

### 인증·권한
- 기본: 모든 API NextAuth 세션 필수 (public 라우트는 명시)
- `middleware.ts`에서 1차 보호 (로그인 여부)
- 라우트 핸들러에서 `requireRole(['manager', 'admin'])` helper로 역할 체크
- 호텔리어는 본인 데이터만 접근 (RLS 또는 쿼리 조건으로 `hotel_id` 강제)

### Rate Limiting
- `@upstash/ratelimit` + Vercel KV (또는 Neon으로 자체 구현)
- 로그인·접수폼·파일 업로드 별도 강한 제한 (IP + user_id 기준)

### 입력 검증 (Zod)
```ts
const TicketCreateSchema = z.object({...});
const parsed = TicketCreateSchema.safeParse(await req.json());
if (!parsed.success) return Response.json({ ok: false, error: 'INVALID', details: parsed.error.flatten() }, { status: 422 });
```

---

## 7. 보안

| 위협 | 대응 |
|:-:|:-:|
| XSS | DOMPurify (마크다운 아티클 본문). React는 기본 escape |
| SQL Injection | Drizzle ORM만 사용. raw SQL 금지 |
| CSRF | NextAuth 기본 보호 + Server Actions origin 검증 |
| 헤더 | `next.config.ts`에 CSP, X-Frame-Options, Referrer-Policy 설정 |
| 시크릿 | `.env.local`만 사용. `.env*` 절대 커밋 금지 |
| 비밀번호 | bcrypt cost 12. NextAuth Credentials Provider 사용 |
| 첨부파일 | S3 Presigned URL (서버 경유 X). 최대 50MB. MIME 화이트리스트 |
| 권한 우회 | API 레벨에서 호텔리어는 본인 hotel_id만 접근 가능하도록 강제 |

### 토큰 전략 (NextAuth JWT 세션)
- **호텔리어**: maxAge 7일 (자동 로그인 체크 시) / 세션(브라우저 종료 시 소멸)
- **매니저/어드민**: maxAge 8시간 (보안 강화)
- 401 응답 시 자동 재로그인 유도

---

## 8. 알림 발송 규칙

### SMS (솔라피)
- 발송 실패 3회 retry, 그래도 실패 시 `notification_logs.status = 'failed'`
- 어드민 편집 가능한 템플릿 (`{{변수}}` 치환)
- 이벤트: 접수확인 / 처리중 / 완료 / 비밀번호 변경 / 직원 초대 / 임시 비번 발급

### 이메일 (SES)
- 발신: `support@oapms.com` (확정 필요)
- 동일 템플릿 시스템 (어드민 편집)
- 이용자 선택 시에만 발송 (IC-03)

### Slack (Webhook)
- `#as-new` — 신규 티켓 알림 (전체)
- `#as-urgent` — P1 긴급건 즉시 알림
- `#dev-escalation` — 매니저가 Dev 에스컬레이션 시
- Webhook URL은 모두 환경변수

---

## 9. 테스트

| 상황 | 방식 |
|:-:|:-:|
| 기능 개발 후 | curl 또는 Vercel preview에서 동작 확인 (기본) |
| "테스트해줘" | 해당 기능 API 수동 테스트 + 화면 검증 |
| "E2E 테스트해줘" 명시 | `/test-e2e` 스킬로 Playwright |
| 단위 테스트 | 도메인 로직(권한 helper, 알림 발송 등)만 선택적 작성 |

---

## 10. 배포 (Vercel)

### 환경
- `production` → `support.oapms.com` (커스텀 도메인 연결 예정)
- `preview` → PR마다 자동
- `development` → 로컬 (`npm run dev`)

### 빌드 명령
```bash
npm run dev          # 로컬 개발 (Turbopack)
npm run build        # 프로덕션 빌드
npm run start        # 빌드 결과 실행

npm run db:push      # 스키마 즉시 반영 (개발)
npm run db:generate  # 마이그레이션 SQL 생성
npm run db:migrate   # 마이그레이션 적용 (프로덕션)
npm run db:studio    # Drizzle Studio 열기
```

### 환경변수 (필수, `.env.example` 작성)
```
# DB
DATABASE_URL=postgres://...@...neon.tech/...

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=
OA_SSO_CLIENT_ID=
OA_SSO_CLIENT_SECRET=
OA_SSO_ISSUER=

# 솔라피
SOLAPI_API_KEY=
SOLAPI_API_SECRET=
SOLAPI_SENDER=

# AWS
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
SES_FROM_EMAIL=
S3_BUCKET=

# Slack
SLACK_WEBHOOK_NEW=
SLACK_WEBHOOK_URGENT=
SLACK_WEBHOOK_DEV=

# 챗봇
OACHAT_EMBED_URL=

# Rate Limit (선택)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## 11. Git 규칙

- **Conventional Commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `style:`, `perf:`
- 본문에 `Co-Authored-By: Claude` 포함
- PR Template: Summary / 변경 파일 / Test Plan / Screenshots (UI 변경 시)
- `main` 보호. PR 통해서만 머지
- `.env*`, `node_modules`, `.next`, `*.log` `.gitignore`

---

## 12. 보고/문서

- 개발 일지: `/report-doc` → `docs/dev-logs/YYYY-MM-DD.html`
- 형식: 카드형 요약 + 테이블 상세 + 체크리스트, 메인 컬러 적용, 모바일 반응형
- Phase 완료 시 상세 보고: **변경 파일 / 기능 설명 / DB 변경 / 테스트 방법 / 주의사항**
- `docs/IMPLEMENTATION_PLAN.md`는 항상 최신 (기능/스키마 변경 즉시 반영)
