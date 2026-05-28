# Phase 10 Design — 배포·검증

> 코드는 거의 없고 설정·운영 중심. 본 문서는 사용자가 운영에 들어가기 위한 체크리스트.

## 1. 변경 요약

| 파일 | 변경 |
|:-|:-|
| `next.config.ts` | CSP, HSTS, frame-src oachat.ai 추가 |
| `docs/dev-logs/2026-05-28-phase-10.html` | MVP P1 완성 보고서 |

## 2. CSP 정책

```
default-src 'self'
script-src 'self' 'unsafe-inline' (+ 'unsafe-eval' in dev)
img-src 'self' data: blob: + Vercel Blob 도메인
frame-src 'self' https://*.oachat.ai
upgrade-insecure-requests (production only)
```

oachat.ai 챗봇이 iframe으로 임베드되므로 `frame-src`에 명시 허용. Vercel Blob 첨부 파일이 `*.public.blob.vercel-storage.com` / `*.private.blob.vercel-storage.com` 도메인에서 제공되므로 `img-src`/`media-src`/`connect-src`에 추가.

`'unsafe-inline'` script는 Next.js 16의 hydration boot script가 inline이라 필요. nonce 기반 strict CSP는 차후 강화 대상.

## 3. HSTS

프로덕션에서만 `max-age=2년 + preload`. 로컬 dev에 HTTP 영향 없음.

## 4. 커스텀 도메인 가이드

`docs/dev-logs/2026-05-28-phase-10.html` 4번 섹션 참고.

## 5. 운영 매뉴얼

`docs/dev-logs/2026-05-28-phase-10.html` 6번 섹션 참고. 일상 작업 5가지:
1. 호텔리어 SSO 첫 매핑
2. 장애 발생 시 긴급 배너
3. Dev 에스컬레이션
4. 콘텐츠 추가
5. 마스터 데이터 변경
