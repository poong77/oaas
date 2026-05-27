# 통합 AS 플랫폼 — support.oapms.com

## 정체성
OA 솔루션(PMS·CMS·Keyless·키오스크·웹서비스) 호텔리어를 위한 **통합 셀프 서비스 + AS 티켓 허브**.
기존 as.oapms.com(티켓)과 help.oapms.com(아티클, 채널.io)을 통합하고, oachat.ai 챗봇을 임베드한다.

## 사용자 3종
- **호텔리어** (이용자) — 셀프서치·셀프픽스·이슈접수·본인 숙소 직원 관리
- **매니저** (OA 운영팀) — 콘텐츠 편집·이슈 처리·SMS/이메일 발송·Dev 에스컬레이션
- **어드민** (OA 관리자) — 카테고리 구조·계정 권한·DB 마스터 데이터·Data Insight 전체

## 기술 스택
- **Next.js 15** (App Router, Server Actions/Route Handlers) + TypeScript
- **Drizzle ORM** + **Neon (PostgreSQL, serverless)** — 추후 Cloudflare D1 이전 여지
- **Tailwind CSS 4** + **shadcn/ui**
- **Vercel** 배포
- 외부: oapms.com SSO · oachat.ai (iframe) · Slack Webhook · 솔라피 (SMS) · AWS SES · S3

## 우선순위
**MVP = P1만** (약 35개 기능). P2/P3는 운영하면서 순차 추가. 상세는 `docs/IMPLEMENTATION_PLAN.md`.

## 핵심 행동 규칙
1. **문서 먼저, 코드 나중** — 기능/스키마 변경 시 `docs/IMPLEMENTATION_PLAN.md` 먼저 갱신
2. **Phase 진행 보고** — Phase 하위 작업 완료마다 상세 보고 → 다음 Phase는 사용자 승인 후 진행
3. **존댓말로 응답** — 사용자는 반말이지만 응답은 항상 존댓말 (기획 컨설턴트/시니어 개발자 톤)
4. **"세세하게 해" 정신** — 날것의 페이지 금지. 모든 페이지는 동일 디자인 수준(Card, 정렬, 모바일 카드뷰, 필터, EmptyState)
5. **물리 DELETE 금지** — `is_active = false` 소프트 삭제. 이력 보존 원칙. 비활성 계정의 접수 이력은 유지
6. **window.confirm/alert 금지** — 글로벌 `<ConfirmDialog>` 사용
7. **HTML 보고서** — 개발 일지·테스트·리뷰 모두 HTML로 `docs/dev-logs/YYYY-MM-DD.html`
8. **어드민 DB 편집 우선 설계** — 카테고리·폼 필드·SMS/이메일 템플릿·자주찾는작업·역할별 시작·솔루션 링크 마스터·시스템 설정 등 마스터 데이터는 모두 어드민 메뉴에서 편집 가능. 별도 `/admin` 영역 + 메뉴별 세부 탭으로 구성

## DB 핵심 원칙
- 모든 테이블 `id (uuid)`, `created_at`, `updated_at`, `is_active` 공통 컬럼
- 리스트 쿼리: `is_active = true` 조건 필수, `sortBy/sortOrder/page/pageSize` 지원, 기본 `created_at DESC`
- **PostgreSQL JSONB** 적극 활용 (동적 폼 필드, 메타데이터)
- 감사 로그 `activity_logs`: 어드민 액션 + 티켓 상태 변경 + 권한 변경 (fire-and-forget)
- 마이그레이션: 개발 `drizzle-kit push`, 프로덕션 `drizzle-kit migrate`

## 문서 체계
- `CLAUDE.md` — 이 파일 (정체성 + 핵심 규칙, 70줄 이내)
- `docs/dev-rules.md` — 컨벤션·디자인·API·DB·보안·배포·스킬 상세
- `docs/IMPLEMENTATION_PLAN.md` — 60개 기능 명세·DB 스키마·Phase 계획·권한 매트릭스
- `docs/dev-logs/` — 일자별 HTML 작업 보고서

## 외부 의존성 리스크 (의식하고 작업)
- **help.oapms.com (채널.io) 마이그레이션** — 아티클 데이터 이관 방안 별도 설계 (Phase 3)
- **OA PMS 호텔 계정 DB 매핑** — SSO + 호텔 식별자 연동 구조 (Phase 1, 호텔 마스터 동기화 정책 결정 필요)
- **oachat.ai** — iframe 임베드 외 의존도 최소화. 장애 시 직접 접수폼 fallback

## Git & 배포
- Conventional Commits + `Co-Authored-By: Claude`
- `.env*` 절대 커밋 금지 (`.env.example` 작성)
- Vercel preview 배포로 PR 단위 확인. main 브랜치 보호
