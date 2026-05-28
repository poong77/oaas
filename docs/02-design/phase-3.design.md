# Phase 3 Design — 셀프 서치 (SS)

> 작성일: 2026-05-28
> 대상: 호텔리어가 본인 힘으로 답을 찾는 핸드북 / 통합 검색.

## 1. Executive Summary

| 관점 | 요약 |
|------|------|
| 문제 | 호텔리어가 채널.io 별도 페이지(help.oapms.com)에서 도움말을 찾고, 검색은 통합되지 않음. |
| 솔루션 | 자체 마크다운 기반 아티클 시스템 + ILIKE 통합 검색 + 도움됨 피드백 |
| 기능 UX 효과 | `/help` → `/help/[product]` → `/help/[product]/[slug]`로 1-2 클릭 안에 핸드북 접근. 검색은 GNB 어디서나 진입 |
| 핵심 가치 | 호텔리어 셀프 서치율↑ → 매니저 단순 문의 응대 부하↓ |

## 2. 신규 DB 테이블

### 2.1 `articles`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | gen_random_uuid() |
| product_code | text NOT NULL | `categories.code where type='product'` 참조 (FK 없음 — 카테고리 변경 유연성) |
| category_path | text[] | `['결제', '오류']` 같은 트리식 경로 (옵션) |
| slug | text UNIQUE NOT NULL | URL-safe |
| title | text NOT NULL | 제목 |
| summary_30s | text | 30초 요약 (강조 카드) |
| body_markdown | text NOT NULL | 본문 마크다운 |
| toc | jsonb | `[{ level, text, anchor }, ...]` 발행 시 자동 추출 |
| related_article_ids | uuid[] | 관련 문서 id 배열 |
| author_id | uuid REFERENCES users(id) ON DELETE SET NULL | 작성자 |
| published_at | timestamptz | null이면 draft |
| view_count | integer DEFAULT 0 NOT NULL | 조회수 |
| helpful_yes | integer DEFAULT 0 NOT NULL | 도움됨 yes 카운트 |
| helpful_no | integer DEFAULT 0 NOT NULL | 도움됨 no 카운트 |
| created_at, updated_at, is_active | 공통 |

**인덱스**
- `articles_slug_uq` UNIQUE on `slug`
- `articles_product_published_idx` on `(product_code, published_at DESC)`
- `articles_active_published_idx` on `(is_active, published_at DESC)`

### 2.2 `article_feedback`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK |  |
| article_id | uuid REFERENCES articles(id) ON DELETE CASCADE NOT NULL | 대상 아티클 |
| user_id | uuid REFERENCES users(id) ON DELETE SET NULL | 로그인 사용자 1회. 비로그인은 NULL 무제한 |
| helpful | boolean NOT NULL | 도움됨 yes/no |
| comment | text | 선택 코멘트 |
| created_at, updated_at, is_active | 공통 |

**인덱스**
- `article_feedback_user_unique_idx` UNIQUE on `(article_id, user_id)` partial WHERE `user_id IS NOT NULL`

**트랜잭션 규칙**
- 로그인 사용자: upsert (이미 있으면 helpful/comment 갱신 + helpful_yes/no 카운터 보정)
- 비로그인: insert only (카운터만 +1)

### 2.3 enum 이름 충돌 회피

- 신규 enum 없음. `boolean`/`integer`/`text`/`uuid[]`만 사용하므로 `*_kind` 패턴 불필요.

## 3. 페이지 구조

### 3.1 호텔리어 영역

| Route | 역할 | RSC/CC |
|-------|------|--------|
| `/help` (재작성) | 제품 카드 6개 + 인기 아티클 5건 + Hero 검색 | RSC |
| `/help/[product]` (재작성) | 제품별 가이드 목록, 정렬/필터/페이지네이션 | RSC |
| `/help/[product]/[slug]` (신규) | 마크다운 본문 + TOC + 도움됨 위젯 + 관련 문서 | RSC + 부분 CC (도움됨 위젯, 인쇄/공유 버튼) |
| `/search` (재작성) | 탭별 통합 검색 (도움말/FAQ/공지/장애) | RSC |

### 3.2 어드민 영역

| Route | 역할 | RSC/CC |
|-------|------|--------|
| `/admin/articles` (신규) | 리스트, 필터, 페이지네이션, 발행 토글 | RSC + CC actions |
| `/admin/articles/new` (신규) | 마크다운 split view 폼 | CC (split view 인터랙티브) |
| `/admin/articles/[id]` (신규) | 편집 + 미리보기 + 삭제 | CC |

### 3.3 기존 페이지 보강

- `/` (홈) — `RecentUpdates` 컴포넌트를 발행된 아티클 최근 3건으로 교체
- GNB는 이미 검색 인풋 작동 중. 어드민 nav에 "아티클" 탭 추가 (매니저+어드민)

## 4. 검색 흐름 (SS-01)

```
사용자 → GNB 검색 입력 → /search?q=... → 4탭 결과
  - 도움말: articles.title/body_markdown/summary_30s ILIKE %q%, published_at IS NOT NULL
  - FAQ: 빈 (Phase 4 예정 안내)
  - 공지: 빈 (Phase 7 예정 안내)
  - 장애: service_status where status != 'normal' AND created_at >= now() - interval '30 days'
필터: product (categories), issue_type
정렬: 관련도(기본 - title ILIKE 일치 우선) / 최신순 / 조회수순
```

**Phase 3는 단순 ILIKE.** Postgres tsvector는 Phase 5 이후 검색 고도화 단계에서 적용.

## 5. 마크다운 렌더링 / 보안

- `react-markdown` + `remark-gfm` + `rehype-slug` + `rehype-autolink-headings`
- XSS 방어: react-markdown은 기본적으로 `rehype-sanitize` 없이도 raw HTML을 렌더하지 않음 (기본 설정). 추가로 `rehype-sanitize`는 미적용 (default behavior로 충분, 단순화).
- TOC는 발행 시 본문에서 `^#{1,3}\s+(.+)$` 정규식으로 자동 추출 → JSONB에 저장.
- slug 자동 생성: `slugify` 라이브러리 (한글 지원 안 함 → 자동 생성 결과가 빈 문자열이면 `article-{타임스탬프6자리}` fallback).

## 6. 권한

| Route | 권한 |
|-------|------|
| `/help/*` | 비로그인 OK |
| `/search` | 비로그인 OK |
| `/admin/articles/*` | manager, admin |
| 비로그인 도움됨 위젯 | 토스트로 "로그인 후 의견 남기기" 안내, 카운트는 +1 |

미발행 아티클(`published_at IS NULL`):
- 호텔리어/비로그인 → 404 (notFound)
- 매니저/어드민 → 미리보기 + 상단 노란 배지 "DRAFT"

## 7. Server Actions

| 액션 | 권한 | 설명 |
|------|------|------|
| `recordArticleFeedback(articleId, helpful, comment)` | public | upsert + 카운터 트랜잭션 |
| `incrementArticleViewCount(articleId)` | public | fire-and-forget, 페이지 진입 시 호출 |
| `createArticle(input)` | manager+admin | draft 또는 발행. slug 중복 시 에러 |
| `updateArticle(id, input)` | manager+admin | 부분 갱신 + activity_logs |
| `togglePublishArticle(id, publish)` | manager+admin | publish/unpublish + activity_logs |
| `archiveArticle(id)` | manager+admin | `is_active=false` |

## 8. 시드 데이터

`db/seed.ts`에 6건 추가:

```ts
const sampleArticles = [
  { product: 'pms', title: 'PMS 결제 오류 발생 시 점검 절차', ... },
  { product: 'cms', title: 'CMS 객실 재고 미반영 해결 가이드', ... },
  { product: 'keyless', title: 'Keyless 카드키 발급 실패 해결', ... },
  { product: 'kiosk', title: '키오스크 결제 단말 연결 안 될 때', ... },
  { product: 'web', title: '웹서비스 도메인 SSL 갱신 가이드', ... },
  { product: 'config', title: '관리자 비밀번호 분실 시 복구 절차', ... },
];
```

각각 200~400자 body + `## 섹션 1`, `## 섹션 2` 헤딩 + summary_30s + manager@oa.local 작성자.
**idempotent**: `slug` 기준으로 already-exists 확인.

## 9. 라이브러리 추가

- `react-markdown` (^9)
- `remark-gfm` (^4)
- `rehype-slug` (^6)
- `rehype-autolink-headings` (^7)
- `slugify` (^1)

## 10. 임시값 / TODO

- `TODO(phase-3-temp):` 검색 정렬 "관련도" 단순 ILIKE 위치 점수 — Phase 5 tsvector 고도화 시 교체
- `TODO(phase-3-temp):` PDF 변환은 `window.print()`만. 정식 PDF는 Phase 8 이후
- `TODO(phase-3-temp):` 채널.io 마이그레이션은 외부 링크 안내만, 이관 인프라 미구현

## 11. 빌드 게이트

- `npx drizzle-kit generate` 성공 → 0001 SQL 생성
- `npm run db:migrate` 성공 → 새 테이블 2개 생성 확인
- `npm run db:seed` 성공 → idempotent, 6건 아티클 추가
- `npm run build` 통과 → 신규 라우트 4개 추가
