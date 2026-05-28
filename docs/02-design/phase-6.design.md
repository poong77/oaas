# Phase 6 — IS-04 칸반뷰 + ⑦ 티켓 피드백

## 목적

Phase 5에서 완성된 매니저 리스트뷰(`/admin/tickets`)에 시각화·플로우 강조형 **칸반뷰**를 추가하고,
완료 티켓에 대한 호텔리어 **피드백(rating + comment)** 을 수집한다.

작업량은 Phase 5의 약 1/5 수준. 신규 외부 의존성 없음(드래그앤드롭은 HTML5 native).

---

## 1. 데이터 모델

### `ticket_feedback` (신규)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | gen_random_uuid() |
| `ticket_id` | uuid FK(tickets) **CASCADE** | 1 ticket → 보통 1 active feedback (변경 시 기존 active row 비활성 후 새 row) |
| `rating` | text NOT NULL (`ticket_feedback_rating_kind` enum) | `resolved` / `partial` / `unresolved` |
| `comment` | text NULL | 호텔리어 자유 코멘트 |
| `submitted_by` | uuid FK(users) **SET NULL** | 제출자 (보통 ticket reporter) |
| `created_at`, `updated_at`, `is_active` | 공통 컬럼 | 활성만 최신 1건 |

#### pgEnum
- `ticket_feedback_rating_kind` = `('resolved', 'partial', 'unresolved')`
- 테이블 이름과 enum 이름 동명 회피 — Phase 5 같은 실수 방지

#### 인덱스
- `ticket_feedback_ticket_idx` on (ticket_id, is_active)

#### upsert 패턴
1. `submitFeedback({ ticketId, rating, comment, userId })`:
   1. 트랜잭션 시작
   2. `UPDATE ticket_feedback SET is_active=false WHERE ticket_id=$1 AND is_active=true`
   3. `INSERT INTO ticket_feedback ...`
   4. 트랜잭션 종료
2. `getFeedback(ticketId)` — `SELECT * WHERE ticket_id=$1 AND is_active=true ORDER BY created_at DESC LIMIT 1`

> Soft history 보존: 호텔리어가 평가를 변경하면 이전 평가는 `is_active=false`로 남는다. 매니저 페이지 통계에서는 활성만 집계.

---

## 2. 칸반 뷰 `/admin/tickets/kanban`

### 페이지 구조 (위→아래)

1. `PageHeader` (title="티켓 큐", 리스트/칸반 toggle)
2. `TicketsSummaryCards` (Phase 5 재사용)
3. 칸반 필터 (긴급도 / 제품 / "내 담당" 토글) — 검색은 X
4. 칸반 컬럼 4개 (`received` / `in_progress` / `on_hold` / `completed`)

### 컬럼 정책

| status | 표시 범위 |
|--------|-----------|
| received | 전체 (is_active=true) |
| in_progress | 전체 |
| on_hold | 전체 |
| completed | 최근 30일 (created_at >= now() - interval '30 days') — 시각 깔끔 + 성능 |

**페이지네이션 X** — 칸반은 한눈에 보는 게 핵심. 카드가 너무 많으면 사용자가 리스트뷰로 자연스럽게 이동.

### 카드 정보

- 티켓번호 (`AS-YYYY-NNNNNN`, mono font)
- 제목 (최대 60자, ellipsis)
- 호텔명
- 긴급도 배지 (p1=danger / p2=warn / p3=slate)
- 담당자 이니셜 (없으면 "미배정" 텍스트)
- 마감일 (있을 때만, 24h 이내면 빨강 강조)
- 접수일 (relative, "3시간 전" 같은 한글 짧은 표기)
- 클릭 → `/admin/tickets/[id]`

### 드래그앤드롭

**HTML5 native DnD API** 사용 (`@dnd-kit` 도입 X — 번들 비용)

| 이벤트 | 동작 |
|--------|------|
| `dragstart` | 카드 opacity 0.5, `dataTransfer.setData('text/plain', ticketId)` |
| `dragend` | 카드 opacity 1.0 복원 |
| `dragover` | preventDefault (drop 활성화) + 컬럼 border highlight |
| `dragleave` | 컬럼 border 복원 |
| `drop` | preventDefault + 컬럼의 status 추출 + optimistic UI update + Server Action `moveTicketStatusAction` |

### Optimistic UI

- drop 즉시 카드를 현재 컬럼에서 제거하고 대상 컬럼에 prepend → 사용자는 즉시 변경 확인
- Server Action 실패 시:
  - 토스트 (inline notice with auto-dismiss 3.5s) 에러 표시
  - 원래 컬럼으로 카드 rollback
- 성공 시:
  - `router.refresh()` — 서버에서 최신 데이터 재취득 (담당자/마감일 등 부작용 반영)
  - 호텔리어 알림(SMS/Email)은 기존 `changeStatus` 내부에서 자동 발송 (Phase 5)

### 권한

- 매니저 + 어드민만 접근 (`requireRole(['manager', 'admin'])`)
- 호텔리어는 칸반 페이지 자체 접근 불가 → notFound

### 모바일

- `overflow-x-auto` + `snap-x snap-mandatory`
- 각 컬럼 너비 `min-w-[82vw] sm:min-w-[280px]`
- 드래그앤드롭은 모바일 터치 환경에서 동작 보장 어려움 → **모바일에서는 카드 하단에 "다른 상태로" 셀렉트 노출**해 fallback 제공

### 리스트 ↔ 칸반 토글

- 신규 컴포넌트 `list-kanban-toggle.tsx` — `/admin/tickets` 와 `/admin/tickets/kanban` 양쪽 헤더에서 공유
- 현재 모드는 `usePathname()` 으로 판단

---

## 3. 피드백 위젯

### 호텔리어 페이지 `/tickets/[id]`

- 티켓 status === `completed` AND viewer.id === ticket.reporterId 일 때만 노출
- 위치: 답변 폼 위 (완료 티켓엔 답변 폼이 비활성이므로 자연스럽게 강조됨)
- 이미 제출했으면:
  - 평가 결과 표시 + "수정" 버튼 → 다시 라디오로 전환
- 라디오 3개:
  - 해결됨 (success tone)
  - 일부 해결 (warn tone)
  - 미해결 (danger tone)
- 코멘트 textarea (선택, max 2000자)
- 제출 → `submitFeedbackAction` → 성공 토스트 + `router.refresh()`
- 미해결 평가일 때만 추가 안내: "원하시면 [재접수](/tickets/new?from=ticket&ticket=AS-...) 도와드릴게요"

### 매니저 페이지 `/admin/tickets/[id]`

- 피드백이 있으면 우측 사이드 상단(또는 좌측 본문 위)에 카드 표시
- 카드 내용: 평가 라벨 + 코멘트 + 제출일 + (옵션) 본인 담당 만족도 통계
- 본 Phase에서는 본인 통계 옵션은 시간상 생략하고 단순 표시만

---

## 4. 서비스 함수

### `lib/services/tickets.ts` (server-only)

```ts
listAllTicketsForKanban(viewer?, filters?: { urgency?, productCode?, mineOnly? })
  → { received: TicketKanbanCard[], in_progress: [...], on_hold: [...], completed: [...] }

submitFeedback({ ticketId, rating, comment, userId }) → { ok, message? }
getFeedback(ticketId) → TicketFeedback | null
```

### `lib/services/tickets-meta.ts` (client-safe)

- 추가:
  - `KANBAN_COLUMN_ORDER: TicketStatus[]` = `['received', 'in_progress', 'on_hold', 'completed']`
  - `KANBAN_COLUMN_TONE: Record<TicketStatus, ...>`
  - `RATING_LABEL: Record<TicketFeedbackRating, string>`
  - `RATING_TONE: Record<TicketFeedbackRating, 'success'|'warn'|'danger'>`

> Client Component는 절대 `lib/services/tickets.ts` import 금지 (solapi/slack/blob transitive).

---

## 5. Server Actions

### `app/actions/ticket-actions.ts`

추가:

```ts
moveTicketStatusAction(formData) // 드래그앤드롭 전용
  → manager/admin 권한
  → changeStatus 호출
  → activity_logs: 'ticket.kanban_moved' (기존 'ticket.status_change' 와 구분)

submitFeedbackAction(formData)
  → 호텔리어 권한
  → 본인 티켓 reporter인지 검증
  → submitFeedback 호출
  → activity_logs: 'ticket.feedback_submitted'
```

---

## 6. 보안

| 위협 | 대응 |
|------|------|
| 호텔리어가 남의 티켓에 피드백 | `submitFeedback` 내부에서 ticket.reporter_id 검증 |
| 호텔리어가 칸반 페이지 접근 | `requireRole(['manager','admin'])` |
| 매니저가 권한 없는 호텔 티켓 이동 | Phase 5 `changeStatus`는 매니저+어드민에게 전체 권한 부여 (기존 유지) |
| Rating enum 외 값 주입 | zod `z.enum(['resolved','partial','unresolved'])` 인라인 |
| comment XSS | textarea raw text → 표시 시 HTML 미파싱 (plain text rendering) |

---

## 7. 마이그레이션 / 시드

### 마이그레이션
1. `db/migrations/0004_phase6_feedback_placeholder.sql` — 메인이 `drizzle-kit generate` 실행 시 덮어씀
2. 컨텐츠는 enum + 테이블 + 인덱스 SQL 일반 형식

### 시드
- 기존 `AS-YYYY-900002` (completed, 카드키 발급기 장애)에 `ticket_feedback` 1건:
  - rating='resolved'
  - comment='빠른 출동 감사합니다. 게스트 응대도 잘 됐어요.'
  - submitted_by = hotelier
- idempotent: 이미 있으면 skip

---

## 8. activity_logs 이벤트

| action | targetType | payload |
|--------|------------|---------|
| `ticket.kanban_moved` | ticket | `{ from, to }` |
| `ticket.feedback_submitted` | ticket | `{ rating }` |

---

## 9. 빌드 / 배포

1. `npx drizzle-kit generate` → `0004_*.sql` 정식 생성
2. `npm run db:migrate` → Neon 적용
3. `npm run db:seed` → 시드 보강
4. `npm run build` → 통과 확인 (40~41 라우트 예상: kanban +1)
5. git commit + push → Vercel 자동 배포
