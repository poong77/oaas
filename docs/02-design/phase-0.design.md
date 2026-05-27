# Phase 0 — Project Setup Design

> 작성일: 2026-05-28
> 범위: Phase 0 한정 셋업 구조. 비즈니스 도메인(인증·티켓 등)은 Phase 1+에서 별도 설계.

## 1. 결정 사항 요약

| 결정 | 선택 | 이유 |
|:-|:-|:-|
| Next.js 버전 | **15.1.3** + App Router + Turbopack dev | CLAUDE.md 명시. RSC + Server Actions 활용 |
| React 버전 | **19.0.0** | Next 15 기본 매칭 |
| Tailwind | **4 (beta)** | CLAUDE.md 명시. CSS-first 설정, `@theme`로 토큰 |
| ORM | **Drizzle 0.36** + Neon HTTP 드라이버 | Vercel Edge 호환, type-safe |
| 다크모드 | `next-themes` + class strategy | localStorage + 시스템 감지, hydration mismatch 방지 (`suppressHydrationWarning`) |
| 상태 | **Zustand 5** | 글로벌 ConfirmDialog 큐, 가볍고 boilerplate 적음 |
| Dialog | `@radix-ui/react-dialog` | shadcn/ui 도입 전 단계에서도 표준 접근성 보장 |
| Toast | `sonner` | shadcn 표준, 가벼움 |
| Icons | `lucide-react` | shadcn 표준 |

## 2. 폴더 구조 (Phase 0 기준)

```
/app
  layout.tsx              # 루트 레이아웃 + Providers + Header
  page.tsx                # 빈 홈 (Phase 카드)
  globals.css             # Tailwind 4 진입 + @theme 토큰
  /api
    /health/route.ts      # 헬스체크 (graceful degrade)
/components
  providers.tsx           # ThemeProvider + Toaster + ConfirmDialogHost
  /layout
    header.tsx            # GNB (LP-02 자리잡기) + 다크모드 토글
  /dialogs
    confirm-dialog.tsx    # 글로벌 ConfirmDialog (Zustand store + Radix)
/db
  index.ts                # Drizzle Neon HTTP 클라이언트 (lazy, graceful)
  /schema/index.ts        # 스키마 진입점 (Phase 1+ 채움)
/lib
  utils.ts                # cn() (tailwind-merge + clsx)
  env.ts                  # 환경변수 안전 로더 + isDbConfigured()
docs/
  IMPLEMENTATION_PLAN.md
  dev-rules.md
  /02-design/phase-0.design.md   # 이 파일
  /dev-logs/2026-05-28.html      # Phase 0 보고서
```

## 3. 핵심 설계 포인트

### 3.1 Graceful Degrade (DB 미연결 허용)

`lib/env.ts`의 `isDbConfigured()`로 `DATABASE_URL`이 비어있는지 검사. 비어있으면 `db/index.ts`는 `null`을 반환하고, `/api/health`는 `db.configured=false, db.ok=false`로 응답하되 **HTTP 200**을 유지. 임시값 진행 정책에 부합.

### 3.2 ConfirmDialog 글로벌

`useConfirmDialog()` hook → `Promise<boolean>` 반환. 직전 요청이 있으면 자동 `false`로 닫고 새 요청을 띄움. `RootLayout`에 `<ConfirmDialogHost />` 하나만 마운트되므로 마운트 비용 없음.

### 3.3 다크모드 hydration 방지

- `<html suppressHydrationWarning>` (next-themes 권장)
- `ThemeToggle`은 `mounted` 가드로 서버 렌더 시 빈 자리만 노출 → 클라이언트 hydration 후 아이콘 표시
- 저장 키: `oa-support-theme`

### 3.4 Tailwind 4 토큰

`@theme { --color-brand-* }` 로 indigo 스케일을 `brand-*` 별칭으로 노출. Phase 2(LP 본격 작업)에서 OA 공식 컬러 확정 후 값만 교체하면 모든 컴포넌트가 자동 적용됨.

## 4. 보안 (security-architect 자문 반영)

- `next.config.ts`에 기본 보안 헤더(`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`). CSP는 SSO/외부 임베드(oachat.ai) 구조 확정 후 Phase 1~2에서 강화.
- `.env*.local` 모두 .gitignore. `.env.example`만 커밋.
- `poweredByHeader: false` (X-Powered-By 노출 방지).

## 5. 인프라 (infra-architect 자문 반영)

- Neon HTTP 드라이버 사용으로 Vercel Edge / Node 양쪽 호환.
- `vercel.json`은 작성하지 않음 (기본 설정으로 충분, Phase 10에서 도메인·리전 명시 필요 시 추가).
- 환경변수는 모두 `.env.example`에 placeholder. 실제 값은 Vercel Project Settings에 등록 예정.

## 6. Phase 1 진입 시 해야 할 것 (체크리스트)

- [ ] NextAuth (OA SSO Provider) 설계 → `lib/auth.ts`
- [ ] `db/schema/users.ts`, `db/schema/categories.ts` 작성 + `drizzle-kit push`
- [ ] `lib/permissions.ts` (`requireRole`)
- [ ] 솔라피 클라이언트 (`lib/solapi.ts`) + 발신번호 결정
- [ ] AWS SES 클라이언트 (`lib/ses.ts`) + 발신 도메인 결정 (support@oapms.com)
- [ ] `activity_logs` 기본 로거 (fire-and-forget)
- [ ] CSP 헤더 본격 정의
