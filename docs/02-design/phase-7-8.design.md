# Phase 7 + 8 — 공지/업데이트 (NT-01) + 챗봇 임베드 (CB-01~03)

## 목적

- **Phase 7 (NT-01)**: 공지·릴리즈노트·장애 공지를 하나의 `notices` 테이블로 통합 관리. 호텔리어 목록/상세, 매니저+어드민 CRUD, 홈 위젯/검색/긴급 배너 통합. placeholder였던 `/notices`를 실제 운영 가능한 페이지로 교체.
- **Phase 8 (CB-01~03)**: `oachat.ai` iframe 임베드용 플로팅 챗봇 위젯. 모든 페이지(로그인·어드민 제외) 우하단 FAB. `OACHAT_EMBED_URL`이 비어있을 때는 안내 카드 fallback. 챗봇 미해결 시 접수 폼으로 자연스럽게 이어지는 `from=chatbot` 컨텍스트 지원.

두 Phase 합쳐도 Phase 5의 1/3 수준. 신규 외부 라이브러리 없음.

---

## 1. 데이터 모델 — `notices`

### 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | gen_random_uuid() |
| `kind` | `notice_kind` enum NOT NULL | `notice` (공지) / `release` (릴리즈노트) / `incident` (장애 공지) |
| `product_code` | text NULL | categories.code 참조 (FK 없음, 카테고리 변경 유연성). null이면 전체 공지 |
| `title` | text NOT NULL | 제목 (최대 200자) |
| `body_markdown` | text NOT NULL | 본문 (마크다운, MarkdownView 재사용) |
| `pinned` | boolean NOT NULL DEFAULT false | 목록 상단 고정 |
| `banner` | boolean NOT NULL DEFAULT false | 홈/전역 상단 띠 노출 여부 |
| `banner_until` | timestamptz NULL | banner=true일 때 자동 해제 시각. null이면 무기한 |
| `published_at` | timestamptz NULL | null이면 draft. 발행 시점에 채워짐 |
| `view_count` | integer NOT NULL DEFAULT 0 | 상세 진입 시 fire-and-forget +1 |
| `author_id` | uuid FK(users) SET NULL | 작성자 |
| `created_at`, `updated_at`, `is_active` | 공통 컬럼 | soft delete |

### pgEnum

- `notice_kind` = `('notice', 'release', 'incident')`
- **테이블명과 enum명 동명 회피** — Phase 5/6의 학습. enum 이름은 `notice_kind`, 테이블 이름은 `notices`로 명확히 분리.

### 인덱스

- `notices_active_published_idx` on (is_active, published_at DESC) — 통합 목록 (가장 빈번)
- `notices_product_published_idx` on (product_code, published_at) — 제품 필터 목록
- `notices_banner_active_idx` on (banner, is_active) — 긴급 배너 조회 (`banner=true AND is_active=true`)

> `pinned` 컬럼은 정렬용. 조회는 보통 `is_active=true` + `published_at IS NOT NULL`을 함께 보므로 인덱스 분리하지 않고 위 두 개로 커버.

### 운영 패턴

- **draft**: `published_at IS NULL`
- **발행**: `published_at = now()` (홈 위젯·검색·목록 노출)
- **발행 취소**: `published_at = NULL`
- **비활성(soft delete)**: `is_active = false`
- **자동 banner 해제**: 별도 cron 없이, 조회 시점에 `banner_until > now()` 체크하는 식으로 lazy 처리 (코드 단순성)

---

## 2. 서비스 레이어 — `lib/services/notices.ts`

server-only. 패턴은 `articles.ts`와 동일.

### 조회

- `listNotices({ kind?, productCode?, publishedOnly?, isActive?, sortBy?, sortOrder?, page?, pageSize? })`
  - 기본 정렬: **pinned DESC, published_at DESC, created_at DESC** (핀 상단)
  - 인덱스 활용: pinned는 정렬 키지만 적은 카디널리티 → 인덱스 추가 비용 < 효익. 시드 데이터 규모에서는 무시.
- `getNoticeById(id, { includeUnpublished? })` — 상세 진입
- `listActiveBannerNotices()` — `banner=true AND is_active=true AND published_at IS NOT NULL AND (banner_until IS NULL OR banner_until > now())`
- `listRecentPublishedNotices(limit=2)` — 홈 위젯 (발행분 최근순)
- `listPinnedPublishedNotices(limit=1)` — 홈 위젯 핀고정용
- `listRelatedNotices(noticeId, productCode, kind, limit=3)` — 상세 페이지 하단
- `searchNotices(q, { productCode?, limit? })` — 검색 페이지 공지 탭. title + body_markdown ILIKE

### CRUD

- `slugUsedForNoticeUuid?` 슬러그 없음 (notices는 uuid로 라우팅 `/notices/[id]`)
- `createNotice(input, authorId)` — banner=true && banner_until 검증
- `updateNoticeById(id, input)`
- `togglePublishNoticeById(id, publish)` — `published_at` 토글
- `archiveNoticeById(id)` / `restoreNoticeById(id)`
- `incrementNoticeViewCount(id)` — fire-and-forget

### Zod 검증

`z.enum(['notice', 'release', 'incident'])` — pgEnum과 별개로 인라인. 테이블 이름과 enum 이름이 다르므로 충돌 없음.

---

## 3. Server Actions — `app/actions/notice-actions.ts`

- `bumpNoticeViewCount(id)` — public, fire-and-forget
- `createNoticeAction` / `updateNoticeAction` / `togglePublishNoticeAction` / `archiveNoticeAction` / `restoreNoticeAction` — 매니저+어드민
- `activity_logs` 기록: `notice.create` / `notice.update` / `notice.publish` / `notice.unpublish` / `notice.archive` / `notice.restore`
- `revalidatePath('/notices')`, `revalidatePath('/admin/notices')`, 그리고 banner 변경 시 `revalidatePath('/')` (홈), `revalidatePath('/notices/[id]')`

---

## 4. 페이지 — 호텔리어

### `/notices` (NT-01 목록)

- placeholder 전면 교체
- 필터: 제품 (전체/공지/제품별), 종류 (notice/release/incident/all)
- 정렬: 항상 pinned 상단 → published_at desc (기본 고정. 사용자 정렬 없음 — 공지는 흐름이 중요)
- 카드: 종류 배지 (notice=brand 파랑 / release=violet 보라 / incident=danger 빨강), 핀 표시 (pinned=true면 Pin 아이콘), 제목, 30자 요약 (body_markdown 첫 줄 또는 첫 텍스트), 작성자 이름, 발행일, 조회수
- 페이지네이션 10건/페이지
- 모바일 카드뷰 (테이블 X — 목록은 본래 카드 흐름)
- EmptyState

### `/notices/[id]` (NT-01 상세)

- 종류 배지 + 제품 태그 + 발행일 + 작성자 + 조회수
- `MarkdownView source={body_markdown}` 본문 렌더
- 진입 시 view_count +1 (Server Action fire-and-forget)
- 인쇄 / 공유 (간단 — 인쇄는 `window.print()`, 공유는 URL 복사 클립보드. Client Component 분리)
- 관련 공지 3건 (같은 product 또는 같은 kind, 자신 제외)
- 비활성/미발행은 404

---

## 5. 페이지 — 어드민 `/admin/notices`

### 리스트 `/admin/notices/page.tsx`

매니저+어드민. 패턴은 `/admin/articles` 동일.

- 컬럼: 종류 / 제품 / 제목 / 상태(발행/Draft, 핀, 배너) / 조회수 / 작성일 / 작업
- 필터: 검색(title+body_markdown ILIKE), 종류, 제품, 발행상태(published/draft/all), active(active/inactive/all), 정렬(updated_at/published_at/view_count)
- 페이지네이션 20건/페이지
- StatCard 3개: 전체 / 발행 / Draft

### 폼 `/admin/notices/new` + `/admin/notices/[id]`

- ArticleEditor 패턴 참고, 단순화한 `NoticeEditor` 컴포넌트 신규 작성 (slug 없음, 종류·핀·배너 추가)
- 필드:
  - 종류 select (`notice` / `release` / `incident`)
  - 제품 select (`전체 공지` 옵션 포함 — 빈 값이 product_code=null)
  - 제목 (max 200)
  - 본문 (마크다운 split-view — MarkdownView 재사용)
  - pinned 체크박스
  - banner 체크박스 + banner_until datetime-local (banner=true일 때만 노출)
  - 액션: Draft 저장 / 발행하기 / 저장+재발행
- banner=true인데 banner_until이 비어있어도 OK (무기한 — 매니저 의도)
- banner_until이 과거이면 폼 단계에서 경고 ("이미 만료된 시각입니다. 그래도 저장하시겠어요?")

---

## 6. 보강 — 기존 페이지

### 홈 `/app/page.tsx` — `RecentUpdates` 위젯

기존 `listRecentPublishedArticles(3)`만 호출하던 것을:

1. `listPinnedPublishedNotices(1)` — pinned 핀고정 공지 1건 (있을 때만 카드 상단에 별도 표시)
2. `listRecentPublishedNotices(2)` + `listRecentPublishedArticles(1)` → 발행일 desc로 통합 정렬 → 최대 3건
3. 각 카드에 **종류 라벨**:
   - notice → "공지" (brand)
   - release → "릴리즈" (violet — Badge에 violet tone 없으므로 brand 색 + 다른 라벨)
   - incident → "장애" (danger)
   - article → "가이드" (slate)

> Badge에 violet/purple tone이 없으므로 `release`는 인라인 className으로 보라색 처리하거나 brand 색 재사용. **결정: Badge에 새 tone 추가 X. release는 인라인 클래스(`bg-violet-100 text-violet-700 ...`)로 처리** — 변경 영향 최소화.

### 검색 `/search/page.tsx` — 공지 탭 활성화

- `searchNotices(query, { productCode: product, limit: 100 })` 호출
- 결과 없으면 EmptyResults
- 결과 카드: 종류 배지 + 제목 + 본문 30자 요약 + 발행일 + 조회수
- 클릭 → `/notices/[id]`
- 카운트 뱃지 업데이트 (`counts.notice = noticeHits.length`)

### 어드민 nav `/app/(admin)/admin/_components/admin-nav.tsx`

- 새 탭 추가: `{ href: '/admin/notices', label: '공지 관리', icon: Megaphone, roles: ['manager','admin'] }`
- 위치: 아티클 다음 (Phase 7 신규)

### 긴급 배너 `components/layout/emergency-banner.tsx` — NT-03 통합

기존: `service_status='incident'` 일 때만 빨간 띠.

추가:
- `notices.banner=true AND is_active=true AND published_at IS NOT NULL AND (banner_until IS NULL OR banner_until > now())` 조건의 notice들도 함께 노출
- 우선순위: service_status가 incident면 **service_status 우선**으로 위쪽, 그 아래 notices.banner는 별도 라인(amber 색)으로 노출
- 두 종류 모두 없으면 null
- notices.banner는 kind에 따라 색상 분리:
  - `incident` → red (service_status와 동일 톤)
  - `release` → indigo
  - `notice` → amber
- 여러 개 있으면 모두 표시 (대부분 1~2건이라 OK). 닫기 버튼 없음 (publishd 페이지에서 dismiss는 Phase 8.5+ 추후)

---

## 7. 시드 — `db/seed.ts` 보강 (10번 섹션 추가)

샘플 공지 3건 idempotent:

| kind | product | title | banner | banner_until | pinned |
|------|---------|-------|--------|--------------|--------|
| notice | (전체) | 신규 기능 출시 — Self-Search 통합 검색 안내 | false | - | true |
| release | (전체) | v1.1.0 릴리즈 노트 — 이슈 클레임 UX 개선 | false | - | false |
| incident | pms | [해제] 5/27 03:00 PMS 결제 일시 지연 안내 | true | now + 6h | false |

> incident 시드의 banner_until은 시드 실행 시점 기준 +6h. 시드 재실행 시에도 (kind, title) 중복 시 skip.

작성자는 manager@oa.local. 모두 `published_at = now()` 발행 상태.

---

## 8. Phase 8 — ChatbotFab 컴포넌트

### 파일 구조

```
components/chatbot/
  ├── chatbot-fab.tsx          (Client Component, FAB + 펼침 패널)
  └── chatbot-meta.ts          (server-only meta 분리, env 값 노출용)
```

- meta 파일에서 `embedUrl: env.OACHAT_EMBED_URL` 노출 (server-only chain).
- `layout.tsx` (RSC) → `<ChatbotFab embedUrl={...} />`로 prop 전달.

### 동작

- **FAB**: 우하단 `fixed bottom-4 right-4` (모바일은 `bottom-3 right-3`), 둥근 버튼, brand 색, MessageCircle 아이콘
- 클릭 → 패널 펼침 (transition: scale + fade)
- 패널 크기:
  - 데스크탑: `w-96 h-[600px] max-h-[80vh]` 우하단 정렬
  - 모바일: 풀스크린 (`fixed inset-0`)
- 패널 헤더: 제목 "OA 챗봇" + 닫기 버튼 (X)
- 패널 본문:
  - `OACHAT_EMBED_URL` 있음 → iframe (lazy mount — 펼친 후 mount)
  - 비어있음 → fallback 카드 ("챗봇은 곧 제공됩니다. 지금은 [문의 접수](/tickets/new?from=chatbot)를 이용해주세요.") + 버튼 링크
- z-index: 패널/FAB 모두 `z-40` (헤더 sticky와 충돌 회피 — 헤더는 z-40, 긴급 배너는 z-50)
  - 결정: FAB `z-40`, 펼친 패널은 `z-50` (헤더보다 위, 긴급 배너와 동일 — 마지막에 렌더되는 게 위로 가도록 React 트리 순서로 자연 해결)

### 마운트

- `app/layout.tsx`에 `<ChatbotFab embedUrl={env.OACHAT_EMBED_URL} pathname={...} />`
- pathname 전달은 RSC에서 불가 → ChatbotFab가 자체적으로 `usePathname()`으로 conditional render
- 노출 제외:
  - `/login` 시작
  - `/admin` 시작
  - `/profile/staff` (직원 관리 — UX 방해)

### CB-04 (P2) — `from=chatbot` 컨텍스트

- 챗봇 fallback / 또는 챗봇 안에서 외부 링크로 접수 폼 진입 시 `?from=chatbot` 쿼리 추가
- `/tickets/new`에서 `from=chatbot`이면 본문 상단에 안내 라인 추가 ("챗봇으로 해결되지 않은 문의를 접수합니다. 챗봇 대화 내용을 함께 적어주시면 더 빠른 처리가 가능합니다.")

---

## 9. server-only chain 보호

- `lib/services/notices.ts` — `'server-only'`
- `app/actions/notice-actions.ts` — `'use server'`
- 모든 페이지에서 db 접근 → `export const dynamic = 'force-dynamic'`
- ChatbotFab는 Client Component (`'use client'`) — `embedUrl`은 prop으로 받음 (env 직접 import X). meta 파일에서 server-side로 한 번 읽어서 전달.

---

## 10. 마이그레이션 placeholder

- `db/migrations/0005_phase7_notices_placeholder.sql` — 메인 세션이 `drizzle-kit generate` 실행 시 덮어쓸 더미. 내용은 `-- placeholder: drizzle-kit generate will overwrite this`만 적어둠.
- `db/migrations/meta/_journal.json`은 generate 명령이 갱신.

---

## 11. 권한 매트릭스 (이 Phase)

| 액션 | hotelier | manager | admin |
|------|:--------:|:-------:|:-----:|
| /notices, /notices/[id] 조회 | ✅ | ✅ | ✅ |
| /admin/notices/* | ❌ | ✅ | ✅ |
| 발행/비활성/배너 토글 | ❌ | ✅ | ✅ |
| 챗봇 FAB 노출 | ✅ | ✅ (호텔리어 페이지에서만) | ✅ (호텔리어 페이지에서만) |

> 어드민이라도 호텔리어 영역(`/`, `/help`, `/tickets` 등)에서는 챗봇 FAB 노출. `/admin/*`에서만 제외.

---

## 12. 작업 흐름

1. 이 Design 문서 작성 ✓
2. `db/schema/notices.ts` 신규 + `index.ts` export
3. `db/migrations/0005_phase7_notices_placeholder.sql` (메인 세션이 덮어씀)
4. `lib/services/notices.ts`
5. `app/actions/notice-actions.ts`
6. `/notices` 목록 페이지 (placeholder 교체)
7. `/notices/[id]` 상세 페이지 신규
8. `/admin/notices` 리스트 + `new` + `[id]` + Editor + Filters + ListClient
9. 어드민 nav 보강 (Megaphone 아이콘)
10. 홈 위젯 `recent-updates.tsx` 보강
11. 검색 페이지 공지 탭 활성화
12. `emergency-banner.tsx`에 notices.banner 통합
13. 시드 — sample notices 3건 추가
14. **Phase 8**: `components/chatbot/chatbot-fab.tsx` + `chatbot-meta.ts` + `layout.tsx` 마운트
15. `/tickets/new`에 `from=chatbot` 안내 라인 추가
16. 개발 일지 `docs/dev-logs/2026-05-28-phase-7-8.html`

---

## 13. 임시값 / TODO

- `// TODO(phase-7-temp):` — Phase 9에서 notice 알림 발송(이메일/SMS) 연동 시 제거
- `// TODO(phase-8-temp):` — `OACHAT_EMBED_URL` 실제 키 입력 후 fallback 카드 제거 가능성
- `// TODO(phase-8-temp):` — 챗봇 대화 컨텍스트(`from=chatbot`) — Phase 9+에서 chatbot_sessions 테이블 연동 시 conversation_id 전달로 확장

---

## 14. 외부 라이브러리 추가 없음

- 마크다운: `react-markdown` 기 도입
- iframe: native
- DnD/모션: native CSS transition
- 신규 npm install 없음 → 메인 세션 부담 최소
