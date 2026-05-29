# Plan — 통합 리치 에디터 (rich-editor)

> **Feature**: rich-editor
> **Phase**: Plan
> **작성일**: 2026-05-29
> **연계 Feature**: role-mode-ui, admin-sidebar-layout, ticket-channels-master, Phase 5(이슈 클레임), Phase 9(어드민 마스터)
> **참조 프로젝트**: 오아 마케팅 플랫폼 블로그 에디터(`/Users/marc/프로젝트/오아 마케팅 플랫폼/oa-marketing/components/admin/RichEditor.tsx`)

---

## Executive Summary

| 항목 | 값 |
|:-|:-|
| **Feature** | 텍스트 입력 10곳에 Tiptap WYSIWYG 리치 에디터 통합 |
| **저장 포맷** | 마크다운 (기존 `*_markdown` 컬럼 유지, 마이그레이션 0) |
| **에디터** | Tiptap v3.x + tiptap-markdown (입력 WYSIWYG, 저장 마크다운) |
| **렌더링** | 기존 `components/articles/markdown-view.tsx` 그대로 재사용 |
| **이미지 업로드** | 기존 `/api/upload` 재사용 (`purpose='editor'` 분기) + Rate Limit 추가 |
| **신규 테이블** | `editor_drafts` 1개 (자동 저장) |
| **신규 파일** | 약 16개 (에디터 4 + 톨바 3 + 변환 helper 3 + draft 2 + sandbox 1 + DB 1 + plan 2) |
| **수정 파일** | 약 10곳 (notice/article/faq/checklist/quick-reply 에디터 + 티켓 답변·내부메모 + 시스템 설정 + 발송 모듈 3개) |
| **삭제 파일** | 0 |
| **Phase 1 예상** | 1.5일 (호환성 검증 + 인프라 + 변환 helper) |
| **전체 예상** | 5.5일 (Phase 1~5) |
| **롤백 전략** | RichEditor를 Textarea로 1줄 교체 (props 호환) + draft 테이블 비활성화 |

### 가치 전달 (Plan 단계 — 4관점)

| 관점 | 내용 |
|:-|:-|
| **Problem 해결 명세** | ① 어드민/매니저 콘텐츠 작성 UX 개선 (split-view → WYSIWYG) ② 호텔리어 티켓 작성 가독성 강화 (가이드 placeholder + lite 톨바) ③ 5곳 인라인 split-view 중복 제거 ④ 매니저 일과 80% 차지하는 티켓 답변 효율 향상 (단축키·슬래시·SMS 미리보기) |
| **Solution 기술 명세** | Tiptap v3 + tiptap-markdown으로 입력은 WYSIWYG·저장은 마크다운. 기존 react-markdown 렌더링 재사용으로 데이터 마이그레이션 0. brand-* 토큰 cascade로 role-mode-ui 자동 적응. Vercel Blob 업로드 인프라 재사용 |
| **Function UX Effect 검증 가능성** | Phase 1 첫 commit이 호환성 sandbox 검증 (React 19 + Tiptap v3). 모든 단축키·슬래시·자동저장·이미지 lifecycle은 Playwright 시나리오로 검증 |
| **Core Value 구현 안전성** | 기존 `body_markdown` 컬럼·MarkdownView·8곳 사용처 무변경. RichEditor는 Textarea와 동일한 props 시그니처(value/onChange)로 롤백 1줄. SMS/이메일/Slack 변환 helper로 발송 깨짐 사전 차단 |

---

## 1. Problem (왜)

### 1.1 현재 문제

| # | 문제 | 영향 |
|:-:|:-|:-|
| 1 | 어드민 5곳(article·notice·faq·checklist·quick-reply)이 각자 textarea + tab(edit/preview/split) 인라인 구현. 약 1700행 중복 | 유지보수 어려움, UX 일관성 떨어짐 |
| 2 | 호텔리어 티켓 신규/추가답변이 plain Textarea — 가이드·구조 없음 | 부실한 접수 본문 → 매니저 추가 질문 → 처리 지연 |
| 3 | 매니저 티켓 답변/내부 메모도 plain Textarea — 빠른답변 템플릿 통합 없음 | 매니저 일과 80%의 답변 작성에 시간 손실 |
| 4 | SMS/이메일/Slack 발송에 마크다운 변환 없음 — 본문에 마크다운이 들어가면 그대로 발송 (현재는 변수 치환만 사용해서 안 깨짐) | 에디터 도입 후 본문에 마크다운 잔존 시 깨짐 위험 |
| 5 | 자동 저장 없음 — 작성 중 탭 닫으면 손실 | KB 아티클·긴 답변 작성 시 사용자 불안 |

### 1.2 사용자 요구

- **사용자 명시**: "글을 입력하는 모든 곳에 마크다운 적용된 에디터" + "오아 마케팅 플랫폼 블로그 에디터 참고"
- **3인 관점 검토 결과**: 마크다운 유지 + Tiptap WYSIWYG + 매니저 단축키 마스터 + Slack 변환 helper 모두 포함

---

## 2. Solution (무엇/어떻게)

### 2.1 핵심 설계

```
┌─ 사용자 입력 ─────────────────────────────────────────┐
│  [Tiptap WYSIWYG]                                      │
│  - StarterKit (헤딩·목록·인용·코드·표·체크리스트)        │
│  - Image (Vercel Blob 업로드)                          │
│  - Link, Underline, TextStyle, Highlight              │
│  - tiptap-markdown (입력→마크다운 변환)                 │
│  - 슬래시 커맨드 (빠른답변·이미지·표)                    │
└────────────────────┬──────────────────────────────────┘
                     ↓ onChange(markdown)
┌─ 저장 ────────────────────────────────────────────────┐
│  DB 컬럼: body_markdown (기존 그대로)                   │
│  자동 저장: editor_drafts 테이블 (debounce 30초)        │
└────────────────────┬──────────────────────────────────┘
                     ↓
┌─ 발송/렌더링 ─────────────────────────────────────────┐
│  화면 표시: react-markdown (기존 MarkdownView)          │
│  SMS:    markdownToPlain() → 솔라피                     │
│  Email:  markdownToHtml() → SES                         │
│  Slack:  markdownToSlackMrkdwn() → Slack Webhook        │
└───────────────────────────────────────────────────────┘
```

### 2.2 결정 사항 일람

| 영역 | 결정 |
|------|------|
| 에디터 라이브러리 | Tiptap v3.x + tiptap-markdown |
| 저장 포맷 | 마크다운 (기존 컬럼명 `*_markdown` 유지) |
| 데이터 마이그레이션 | **0건** ✅ |
| 렌더링 컴포넌트 | 기존 `components/articles/markdown-view.tsx` 재사용 |
| 이미지 업로드 | 기존 `/api/upload` + `purpose='editor'` 분기 + Rate Limit |
| 첨부 종류 | 이미지(jpg/png/webp/gif) + PDF, 10MB |
| 영상 | **Phase 1 제외** (톨바 비활성) — 후속 결정 |
| 이미지 보안 | A안 public URL (hash 32+자) |
| 이미지 lifecycle | 본문 diff 후 Blob delete (저장·삭제 시) |
| 자동 저장 | localStorage 2초 + `editor_drafts` 테이블 30초 |
| Draft 저장 위치 | **별도 `editor_drafts` 테이블** (사용자 확정) |
| 단축키 마스터 | 전체 적용 (Cmd+Enter·Cmd+S·Cmd+/·슬래시 등) |
| 슬래시 커맨드 | `/`, `/q` (빠른답변), `/sms` (미리보기), `/image` 등 |
| SMS 미리보기 | 매니저 답변 화면 사이드 패널 (140자 카운터) |
| Slack mrkdwn 변환 | Phase 1에 포함 (`lib/notifications/_helpers/`) |
| brand-* 토큰 | viewMode 자동 적응 (role-mode-ui cascade 활용) |
| 호텔리어 placeholder | "예시 채우기 ↳" 인터랙티브 토글 |
| Toaster | 미도입 (인라인 indicator로 대체) |
| Sanitization | `rehype-sanitize` 추가 (호텔리어 입력 본문 대비) |

### 2.3 적용 대상 10곳

| # | 위치 | 사용자 | 톨바 | 단축키 | placeholder | 슬래시 | SMS 미리보기 |
|:-:|:-|:-:|:-:|:-:|:-:|:-:|:-:|
| 1 | `app/(admin)/notices` 공지 본문 | 어드민 | full | ● | — | ● | — |
| 2 | `app/(admin)/articles` KB 본문 | 어드민 | full | ● | — | ● | — |
| 3 | `app/(admin)/faqs` FAQ 답변 | 어드민 | full | ● | — | ● | — |
| 4 | `app/(admin)/checklists/steps` 단계 | 어드민 | full | ● | — | ● | — |
| 5 | `app/(admin)/quick-replies` 템플릿 | 매니저/어드민 | full | ● | — | ● | — |
| 6 | `app/tickets/new` 문제 상세 | 호텔리어 | **lite** | 최소 | ✅ | × | — |
| 7 | `app/tickets/[id]` 추가 답변 | 호텔리어 | lite | 최소 | ✅ | × | — |
| 8 | `app/(admin)/tickets` 공개 답변 | 매니저/어드민 | full | ● | — | ● | **✅** |
| 9 | `app/(admin)/tickets` 내부 메모 | 매니저/어드민 | full | ● + Slack 발송 | — | ● | — |
| 10 | `app/(admin)/master/system-settings` | 어드민 | full | ● | — | ● | — |

---

## 3. 컴포넌트·파일 설계

### 3.1 신규 파일

```
components/editor/
├── rich-editor.tsx              [신규] Tiptap 래퍼 (mode='full'|'lite', value, onChange, autoSave, brandTone)
├── toolbar/
│   ├── full-toolbar.tsx         [신규] 14개 버튼 그룹화
│   ├── lite-toolbar.tsx         [신규] 4개 버튼 (굵게·이미지·목록·체크)
│   └── mobile-bottom-toolbar.tsx [신규] iOS 키보드 위 sticky
├── extensions/
│   ├── slash-command.tsx        [신규] "/" 입력 메뉴 (Tiptap suggestion API)
│   ├── quick-reply-trigger.tsx  [신규] Cmd+/ 빠른답변 패널 (quick_reply_templates 연결)
│   ├── media-lifecycle.ts       [신규] 본문 diff → Blob delete
│   └── auto-save.ts             [신규] localStorage + draft API debounce
├── panels/
│   ├── sms-preview-panel.tsx    [신규] 매니저 답변 화면 사이드 패널
│   ├── save-indicator.tsx       [신규] "저장 중 ⠋ / 저장됨" 인라인 텍스트
│   └── shortcut-help-modal.tsx  [신규] Cmd+? 단축키 도움말
└── placeholders/
    └── hotelier-guide.tsx       [신규] "예시 채우기" 토글 (호텔리어)

lib/editor/
├── markdown-to-plain.ts          [신규] SMS용 plain 추출
├── markdown-to-html.ts           [신규] SES용 HTML 변환 (marked)
├── markdown-to-slack-mrkdwn.ts   [신규] Slack mrkdwn 변환
├── editor-permissions.ts         [신규] 호텔리어/매니저 톨바·기능 분기
└── editor-keymap.ts              [신규] 단축키 정의

app/api/
├── upload/route.ts               [수정] purpose='editor' 분기 + Rate Limit
└── drafts/[scope]/[id]/route.ts  [신규] GET/PUT/DELETE draft

db/schema/
└── editor-drafts.ts              [신규] editor_drafts 테이블

app/(admin)/admin/_sandbox/
└── editor-check/page.tsx         [신규, 검증용] React 19 + Tiptap v3 호환성 sandbox (어드민만 접근)
```

### 3.2 재사용 (변경 없음)

- `components/articles/markdown-view.tsx` — 8곳 사용 중. 렌더링 그대로
- `/api/upload` — `purpose='editor'` 분기만 추가, MIME·인증·확장자 검증 그대로
- `lib/permissions.ts` — `getCurrentUser()`, `requireRole()`, `withAuthorizedAction()` 표준 helper
- `components/dialogs/confirm-dialog.tsx` — z-50 Radix Portal, Tiptap BubbleMenu와 충돌 0
- `lib/notifications/{solapi,ses,slack}.ts` — 변환 helper 적용 1줄로 본문 전처리
- `db/schema/quick-reply-templates.ts` — 슬래시 커맨드가 fetch만

### 3.3 수정 파일

| 파일 | 변경 |
|------|------|
| `app/(admin)/admin/notices/_components/notice-editor.tsx` | Textarea + tab → `<RichEditor mode="full">` 교체 |
| `app/(admin)/admin/articles/_components/article-editor.tsx` | 동일 |
| `app/(admin)/admin/faqs/_components/faq-editor.tsx` | 동일 |
| `app/(admin)/admin/checklists/_components/step-editor.tsx` | 동일 |
| `app/(admin)/admin/quick-replies/_components/quick-reply-editor.tsx` | 동일 |
| `app/tickets/new/_components/ticket-new-form.tsx` | 본문 Textarea → `<RichEditor mode="lite" placeholder="hotelier">` |
| `app/tickets/[id]/_components/ticket-reply-form.tsx` | 동일 |
| `app/(admin)/admin/tickets/_components/public-reply-form.tsx` | `<RichEditor mode="full" smsPreview>` |
| `app/(admin)/admin/tickets/_components/internal-memo-form.tsx` | `<RichEditor mode="full" slackSend>` |
| `app/(admin)/admin/master/system-settings/_components/setting-editor.tsx` | `<RichEditor mode="full">` |
| `app/api/upload/route.ts` | `purpose='editor'` 분기 + Rate Limit |
| `lib/notifications/solapi.ts` | 본문 발송 전 `markdownToPlain()` 적용 |
| `lib/notifications/ses.ts` | 본문 발송 전 `markdownToHtml()` 적용 |
| `lib/notifications/slack.ts` | 본문 발송 전 `markdownToSlackMrkdwn()` 적용 |

---

## 4. DB 스키마 (`editor_drafts`)

```ts
// db/schema/editor-drafts.ts
import { pgTable, uuid, text, varchar, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const editorDrafts = pgTable('editor_drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  scope: varchar('scope', { length: 50 }).notNull(),  // 'article' | 'notice' | 'faq' | 'checklist-step' | 'quick-reply' | 'ticket-message' | 'system-setting'
  targetId: uuid('target_id'),                         // 기존 항목 편집 시 PK. 신규 작성은 null
  draftKey: varchar('draft_key', { length: 200 }).notNull(), // 'scope:targetId' 또는 'scope:new:nonce'
  contentMarkdown: text('content_markdown').notNull(),
  metadata: text('metadata'),  // JSON: { title?, customFields? } 일부 메타도 보관
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => ({
  uniqUserDraft: index('editor_drafts_user_draft_key_uniq').on(t.userId, t.draftKey),
  byUser: index('editor_drafts_user_id_idx').on(t.userId),
  byUpdated: index('editor_drafts_updated_at_idx').on(t.updatedAt),
}));
```

### 4.1 정책

- **자동 정리**: 30일 경과 draft는 cron 또는 즉시 `is_active = false`
- **본 작업 저장 시 draft 자동 삭제**: 본 DB(articles 등) PUT/POST 성공 후 해당 draftKey delete
- **소유자만 접근**: GET/PUT/DELETE 모두 `userId = currentUser.id` 검증
- **scope 검증**: 화이트리스트 enum 7종만 허용

---

## 5. API 설계

### 5.1 `POST/PUT /api/drafts/[scope]/[id?]`

```ts
// Body: { contentMarkdown: string, metadata?: Record<string, unknown> }
// scope: 'article' | 'notice' | ... (화이트리스트)
// id: 기존 편집 시 PK, 신규는 'new' (또는 새 nonce)
// 200: { ok: true, draftKey, updatedAt }
// 401: 비로그인
// 403: 호텔리어가 어드민 scope 접근 시
// 422: 검증 실패
```

### 5.2 `GET /api/drafts/[scope]/[id?]`

```ts
// 응답: { ok: true, data: { contentMarkdown, metadata, updatedAt } | null }
```

### 5.3 `DELETE /api/drafts/[scope]/[id?]`

```ts
// 응답: { ok: true }
```

### 5.4 `/api/upload` 수정

```ts
// 요청 FormData에 purpose: 'ticket' | 'editor'
// purpose='editor'일 때 pathname: editor/{user.id}/{timestamp-random}-{filename}
// + Rate Limit: 사용자별 분당 30회 (IP + userId 키)
// + 클라이언트 throttle: 연속 업로드 최소 500ms 간격 (RichEditor 내부)
```

---

## 6. 리스크 (16건)

| ID | 리스크 | Phase 해소 |
|:-:|:-|:-|
| **C1** | React 19 + Tiptap v3 호환성 미확정 (Drag Handle ext 등 일부 깨짐) | **Phase 1 첫 commit으로 sandbox 검증**. 실패 시 Tiptap v2 fallback |
| **C2** | tiptap-markdown 패키지의 React 19 호환성 | sandbox에서 함께 검증 |
| **C3** | SSR hydration mismatch (Tiptap은 클라이언트 전용) | `immediatelyRender: false` + `'use client'` + 최초 마운트 후 useEffect 패턴 |
| **C4** | 본문 폭 1040px(사이드바 펼침)에서 full 톨바 14개 가로 overflow | 그룹화 3블록 + lg 미만 줄바꿈 + sm 이하 `[B I 🖼 ⋯]` 4개 + ⋯ 메뉴 |
| **C5** | BubbleMenu z-index가 ConfirmDialog(z-50)·Sheet(z-50)에 가림 | `z-[55]` 또는 BubbleMenu portal target을 dialog 내부로 분기 |
| **D1** | 마크다운 sanitization 부재 (호텔리어 입력 본문) | `rehype-sanitize` 추가, MarkdownView 옵션 갱신 |
| **D2** | `/api/upload` Rate Limit 없음 | Phase 1에서 추가 (분당 30회 + 500ms 클라이언트 throttle) |
| **D3** | SMS 발송에 마크다운 잔존 | `markdownToPlain()` helper + solapi.ts 호출 전 적용 |
| **D4** | 이메일 본문이 인라인 HTML 하드코딩 — 마크다운 변환 없음 | `markdownToHtml()` helper + ses.ts 호출 전 적용 |
| **D5** | Slack mrkdwn 문법 차이 (`**` vs `*`, `[]()` vs `<\|>`) | `markdownToSlackMrkdwn()` helper + slack.ts 호출 전 적용. IC-08 운영 중이라 우선순위 ↑ |
| **E1** | 이미지 lifecycle (orphan) | 저장 시 본문 diff → Blob delete. 글 비활성 시 본문 내 모든 이미지 delete |
| **E2** | 모바일 가상 키보드 + 톨바 충돌 (iOS Safari) | visualViewport API로 키보드 위치 감지, sticky bottom |
| **E3** | 사이드바 펼침 상태에서 글 작성 페이지 본문 폭 부족 | 글 작성 페이지 진입 시 사이드바 자동 접힘 hint 쿠키 (`editorFocus`) — Phase 4 |
| **E4** | 빠른답변 슬래시 커맨드 데이터 fetch 비용 | 페이지 진입 시 1회 fetch + 클라이언트 cache (in-memory) |
| **E5** | 자동저장 draft DB 비용 폭증 (다중 사용자) | localStorage 2초 + 서버 30초 debounce + 30일 자동 정리 cron |
| **R1** | 기존 5곳 인라인 split-view → RichEditor 교체 시 회귀 | 단계적 교체 + 페이지별 시각 회귀 캡처 |

---

## 7. Phase 계획

### Phase 1 — 인프라 + 호환성 검증 + 변환 helper (1.5일)

**Commit 1**: `docs(rich-editor): Plan + IMPLEMENTATION_PLAN 갱신`
**Commit 2**: `chore(deps): Tiptap v3 + tiptap-markdown + rehype-sanitize + marked 설치`
**Commit 3**: `feat(sandbox): React 19 + Tiptap v3 호환성 검증 페이지` ← 검증 후 결과 분기
**Commit 4**: `feat(db): editor_drafts 테이블 + drizzle push`
**Commit 5**: `feat(api): /api/drafts CRUD + /api/upload editor prefix + Rate Limit`
**Commit 6**: `feat(editor): RichEditor + full/lite Toolbar + Save Indicator`
**Commit 7**: `feat(editor): media lifecycle helper + auto-save hook`
**Commit 8**: `feat(notifications): markdown 변환 helper 3종 (plain/html/slackMrkdwn)`
**Commit 9**: `feat(globals): brand-* 토큰 에디터 CSS + viewMode 적응`

### Phase 2 — 필수 5곳 적용 (1일)
- 공지 / KB 아티클 / FAQ / 체크리스트 단계 / 빠른답변
- 각 페이지의 split-view 인라인 → RichEditor 교체
- 페이지별 시각 회귀 캡처

### Phase 3 — 권장 5곳 + 매니저 기능 (1.5일)
- 티켓 4곳(공개답변·내부메모·신규·추가답변) + 시스템 설정
- 슬래시 커맨드 (빠른답변·SMS 미리보기·변수 칩)
- SMS 미리보기 패널 (140자 카운터)
- 내부/공개 배지 + Slack 발송 트리거 (Cmd+Shift+Enter)
- 단축키 마스터 적용

### Phase 4 — 호텔리어 + 모바일 + 사이드바 통합 (1일)
- 호텔리어 placeholder 가이드 ("예시 채우기" 토글)
- 모바일 sticky bottom 톨바 (iOS Safari 검증)
- 글 작성 페이지 사이드바 자동 접힘 hint
- 단축키 도움말 모달 (Cmd+? / F1)

### Phase 5 — 정리·QA·문서 (0.5일)
- media orphan 정리 검증
- Playwright E2E (단축키·자동저장·슬래시·이미지 lifecycle)
- `/admin/help/editor` 운영자 가이드 페이지
- dev-logs HTML 보고서

---

## 8. 사용자 가이드 (운영자·매니저·호텔리어)

### 8.1 단축키 마스터

**어드민·매니저 (full)**:
| 키 | 동작 |
|----|------|
| `Cmd/Ctrl + S` | 임시 저장 (draft 즉시) |
| `Cmd/Ctrl + Enter` | 저장 + 발송 (공개 답변) |
| `Cmd/Ctrl + Shift + Enter` | 저장 + Slack 발송 (내부 메모) |
| `Cmd/Ctrl + /` | 빠른답변 템플릿 패널 |
| `/` | 슬래시 커맨드 메뉴 |
| `Cmd/Ctrl + B/I/U/K` | 굵게/기울임/밑줄/링크 |
| `Cmd/Ctrl + Alt + 1~3` | 헤딩 1~3 |
| `Cmd/Ctrl + Shift + 7/8/9` | 번호/글머리/체크리스트 |
| `Cmd/Ctrl + E` / `Shift+C` | 인라인 코드 / 코드 블록 |
| `Cmd/Ctrl + Z` / `Shift+Z` | 실행취소 / 재실행 |
| `Cmd/Ctrl + ?` 또는 F1 | 단축키 도움말 모달 |
| Tab / Shift+Tab | 목록 들여쓰기/내어쓰기 |
| Esc | 메뉴·BubbleMenu 닫기 |

**호텔리어 (lite)**: `Cmd+S`, `Cmd+B/I/K`, `Cmd+Shift+8`, `Cmd+Z`, `Cmd+?`

### 8.2 슬래시 커맨드 (매니저/어드민)

| 키워드 | 삽입 |
|--------|------|
| `/h1~3` | 헤딩 |
| `/ul` `/ol` `/check` | 목록 |
| `/quote` `/code` `/table` `/divider` | 블록 |
| `/image` `/file` `/link` | 미디어 |
| `/q` `/template` | 빠른답변 템플릿 |
| `/sms` | SMS 미리보기 토글 (티켓만) |
| `/customer` `/hotel` `/ticket` | 변수 치환 칩 |

> 한글 검색 지원 (`/표`, `/이미지`, `/빠른답변`)

### 8.3 자동 저장

| 트리거 | 위치 | 표시 |
|--------|------|------|
| idle 2초 | localStorage | "저장 중 ⠋" |
| idle 30초 | localStorage + 서버 draft | "저장됨 (방금 전)" |
| Cmd+S | localStorage + draft (즉시) | "저장됨" |
| 저장 버튼 | 본 DB 컬럼 (최종) | "발행됨" |

페이지 재진입 시 draft 존재하면 `[복구하기] [폐기하기]` 다이얼로그.

### 8.4 이미지·첨부

- 입력 방법: 드래그앤드롭 / 클립보드 붙여넣기 / 톨바 또는 `/image`
- 제한: 이미지 jpg·png·webp·gif 10MB / PDF 10MB
- 자동 처리: 클라이언트 canvas 리사이즈 최대 1600px, JPEG 0.85
- 영상은 **Phase 1 비활성** (톨바 tooltip "준비 중")
- lifecycle: 본문 삭제 → Blob delete (저장 시 diff)

### 8.5 매니저 전용

- **빠른답변** (`Cmd+/`): `quick_reply_templates` 마스터 연결. `Ctrl+1~9` 즐겨찾기 즉시 삽입. `{{호텔명}}` 변수 자동 치환
- **SMS 미리보기**: 답변 화면 우측 패널, 140자 카운터, 80자 초과 시 LMS 안내
- **내부/공개 배지**: 🔒 내부 메모 / 📢 공개 답변
- **Slack 발송** (`Cmd+Shift+Enter`): 마크다운 → Slack mrkdwn 자동 변환, 발송 전 미리보기

### 8.6 모바일 (호텔리어)

- Lite 톨바 + iOS 가상 키보드 위 sticky bottom 톨바
- 이미지 첨부: 카메라/사진/파일 시트
- placeholder 가이드: "예시 채우기 ↳" 탭 시 템플릿 prefill

### 8.7 접근성 (a11y)

- 모든 톨바 버튼 `aria-label` + `title` (단축키 포함)
- 활성 상태 `aria-pressed`
- 슬래시 메뉴 `role="menu"` + 화살표 + Esc
- 자동저장 indicator `aria-live="polite"`
- 색맹: 굵게는 weight 변화로도 식별
- 모션 감소: `prefers-reduced-motion` 시 transition 제거

---

## 9. 검토에서 발견한 충돌·중복 (검증 완료)

| # | 발견 | 처리 |
|:-:|:-|:-|
| 1 | `MarkdownView` 8곳 재사용 중 | 그대로 사용, RichContent 신규 ❌ |
| 2 | Split-view 5곳 인라인 (1700행 중복) | RichEditor가 흡수 |
| 3 | `/api/upload` Rate Limit 없음 | Phase 1에서 추가 |
| 4 | SMS/이메일에 마크다운 변환 없음 | helper 3종 추가, 발송 모듈 1줄씩 수정 |
| 5 | Slack은 mrkdwn 사용 중이나 표준 마크다운과 문법 다름 | helper로 변환 |
| 6 | Toaster 미구현 | 인라인 indicator로 대체 (Toaster 회피) |
| 7 | sanitization 없음 | `rehype-sanitize` 추가 |
| 8 | 미커밋 변경 — 실제 diff 0건 | 영향 없음 |
| 9 | React 19 + Tiptap v3 호환성 미확정 | Phase 1 첫 commit sandbox 검증 |
| 10 | `tsconfig.json moduleResolution: "bundler"` 이미 적용 | Tiptap React 19 권장 조건 충족 ✅ |

---

## 10. 외부 의존성 노트

### 10.1 신규 npm 패키지
```json
{
  "@tiptap/react": "^3.x",
  "@tiptap/starter-kit": "^3.x",
  "@tiptap/extension-image": "^3.x",
  "@tiptap/extension-link": "^3.x",
  "@tiptap/extension-table": "^3.x",
  "@tiptap/extension-table-row": "^3.x",
  "@tiptap/extension-table-cell": "^3.x",
  "@tiptap/extension-table-header": "^3.x",
  "@tiptap/extension-underline": "^3.x",
  "@tiptap/extension-highlight": "^3.x",
  "@tiptap/extension-task-list": "^3.x",
  "@tiptap/extension-task-item": "^3.x",
  "@tiptap/extension-placeholder": "^3.x",
  "@tiptap/suggestion": "^3.x",
  "tiptap-markdown": "^0.8.x",
  "rehype-sanitize": "^6.x",
  "marked": "^14.x"
}
```

### 10.2 Tiptap React 19 권장 설정
- `tsconfig.json` → `moduleResolution: "bundler"` ✅ 이미 적용
- `new Editor({ immediatelyRender: false, ... })`
- Drag Handle 확장 미사용 (React 19에서 `element.ref` 접근 오류)
- BubbleMenu portal target 명시

### 10.3 호환성 검증 sandbox
`app/(admin)/admin/_sandbox/editor-check/page.tsx` 에서:
1. Tiptap StarterKit 마운트
2. tiptap-markdown 입출력 검증
3. 이미지 업로드 (mock)
4. `npm run build` 통과
5. `/admin/_sandbox/editor-check` 접근 → 콘솔 에러 0 확인

---

## 11. 미해결 의사결정 (Open Questions)

| ID | 질문 | 기본 선택 | 변경 시 영향 |
|:-:|:-|:-|:-|
| Q-1 | 영상 처리 | Phase 1 제외 (톨바 비활성) | A(Blob 50MB) / B(Mux) / C(YouTube 링크만) |
| Q-2 | @멘션 (내부 메모 매니저 간) | 본 Phase 외 | 후속 PR. ticket-message에 mentions JSONB 필요 |
| Q-3 | 답변 수정 이력 보존 | 본 Phase 외 | `ticket_message_versions` 테이블 + activity_logs |
| Q-4 | AI 작성 보조 (IC-09/10) | 본 Phase 외 | RichEditor에 `setContent(markdown)` 메서드 노출 (Tiptap 표준) |
| Q-5 | 이미지 EXIF strip (민감정보) | 본 Phase 외 | 클라이언트 canvas 변환 시 EXIF 자동 제거됨. 추가 처리 시 별도 |
| Q-6 | 사이드바 자동 접힘 (글 작성 페이지) | Phase 4 포함 | 후속 결정 가능 |

---

## 12. 다음 단계

1. **본 Plan 사용자 승인** → Phase 1 진입
2. **Phase 1 — Commit 1~9 순차** (1.5일)
3. **Phase 1 완료 보고** → 사용자 승인 → Phase 2
4. 각 Phase 완료 시마다 dev-logs HTML 보고 + 다음 Phase 승인

---

## 부록 A. 디렉토리 트리 (Phase 1~5 완료 후 예상)

```
components/editor/                      [신규 폴더]
├── rich-editor.tsx
├── toolbar/
│   ├── full-toolbar.tsx
│   ├── lite-toolbar.tsx
│   └── mobile-bottom-toolbar.tsx
├── extensions/
│   ├── slash-command.tsx
│   ├── quick-reply-trigger.tsx
│   ├── media-lifecycle.ts
│   └── auto-save.ts
├── panels/
│   ├── sms-preview-panel.tsx
│   ├── save-indicator.tsx
│   └── shortcut-help-modal.tsx
└── placeholders/
    └── hotelier-guide.tsx

components/articles/markdown-view.tsx   [무변경]

lib/editor/                             [신규 폴더]
├── markdown-to-plain.ts
├── markdown-to-html.ts
├── markdown-to-slack-mrkdwn.ts
├── editor-permissions.ts
└── editor-keymap.ts

lib/notifications/
├── solapi.ts                           [수정] markdownToPlain 적용
├── ses.ts                              [수정] markdownToHtml 적용
└── slack.ts                            [수정] markdownToSlackMrkdwn 적용

app/api/
├── upload/route.ts                     [수정] purpose='editor' + Rate Limit
└── drafts/[scope]/[id]/route.ts        [신규]

db/schema/
└── editor-drafts.ts                    [신규]

app/(admin)/admin/_sandbox/             [신규, 검증 후 제거 또는 유지]
└── editor-check/page.tsx

app/(admin)/admin/help/editor/          [신규, Phase 5]
└── page.tsx                            [신규] 운영자 가이드
```

## 부록 B. 참조

- Plan / Design 선행 Feature: `role-mode-ui` (brand-* 토큰 cascade), `admin-sidebar-layout` (본문 폭 1040px), `ticket-channels-master` (마스터 패턴)
- 참조 프로젝트: 오아 마케팅 플랫폼 블로그 에디터 (Tiptap v3.20.1 풀 구성)
- Tiptap React 19 호환성: https://github.com/ueberdosis/tiptap/issues/5876
- Tiptap Next.js 가이드: https://tiptap.dev/docs/editor/getting-started/install/nextjs
- tiptap-markdown: https://github.com/aguingand/tiptap-markdown
- rehype-sanitize: https://github.com/rehypejs/rehype-sanitize
