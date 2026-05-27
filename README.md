# 통합 AS 플랫폼 — support.oapms.com

> OA 솔루션(PMS · CMS · Keyless · 키오스크 · 웹서비스) 호텔리어를 위한
> 통합 셀프 서비스 + AS 티켓 허브.

## Quick Start

```bash
# 1) 의존성 설치
npm install

# 2) 환경변수 템플릿 복사 (실제 값은 .env.local에)
cp .env.example .env.local

# 3) 개발 서버
npm run dev
# → http://localhost:3000

# 4) 헬스체크
curl http://localhost:3000/api/health
```

## 주요 명령

```bash
npm run dev          # 개발 서버 (Turbopack)
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 실행
npm run lint         # ESLint
npm run typecheck    # TypeScript 검사
npm run format       # Prettier 포맷

npm run db:push      # 스키마 즉시 반영 (Phase 1+, DATABASE_URL 필요)
npm run db:generate  # 마이그레이션 SQL 생성
npm run db:migrate   # 마이그레이션 적용 (프로덕션)
npm run db:studio    # Drizzle Studio
```

## 문서

- `CLAUDE.md` — 프로젝트 정체성 + 핵심 행동 규칙
- `docs/IMPLEMENTATION_PLAN.md` — 60개 기능 명세 + DB 스키마 + Phase 0~10 계획
- `docs/dev-rules.md` — 컨벤션 · 디자인 · API · 보안 · 배포 상세
- `docs/dev-logs/` — 일자별 HTML 작업 보고서

## 현재 Phase

**Phase 0 완료** — 프로젝트 셋업 (Next.js 15 + Tailwind 4 + Drizzle + shadcn 기반 골격).
Phase 1(인증 · 권한 · 프로필)부터 실제 기능 개발 시작.
