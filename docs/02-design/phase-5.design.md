# Phase 5 Design — 이슈 클레임 (Issue Claim)

> 작성일: 2026-05-28
> 범위: IC-01 ~ IC-08 (P1)
> 선행 Phase: Phase 0~4 완료 (DB, 인증, 권한, 셀프 서비스 콘텐츠)

---

## 1. 개요

### 1.1 목적

호텔리어가 셀프 서비스(아티클·FAQ·체크리스트)로 해결하지 못한 이슈를
**3단계 폼**으로 접수하고, 매니저가 **티켓 큐**에서 상태/담당자/내부메모를 관리한다.

접수 즉시 SMS·이메일·Slack 알림이 자동 발송되어 누락 없이 처리된다.

### 1.2 범위 (이 Phase에서 구현)

| ID | 기능 | 위치 |
|:-:|:-|:-|
| IC-01 | 3단계 접수 폼 (제품·유형·내용) | `/tickets/new` |
| IC-02 | 첨부파일 (이미지·로그, 최대 50MB) | `/tickets/new` + `Vercel Blob` |
| IC-03 | 연락수단 선택 (SMS·이메일·둘 다) | `/tickets/new` |
| IC-04 | 전화 접수 (매니저 직접 작성) | `/admin/tickets/new-by-phone` |
| IC-06 | 티켓 자동 생성·번호 발급·자동 알림 | service layer |
| IC-07 | 내부 메모 (매니저 비공개) | `/admin/tickets/[id]` |
| IC-08 | Dev 에스컬레이션 (Slack `#dev-escalation`) | `/admin/tickets/[id]` |
| IS-01 | 내 문의 목록 (호텔리어) | `/tickets` |
| IS-02 | 티켓 상세 + 추가 답변 | `/tickets/[id]`, `/admin/tickets/[id]` |
| IS-04 | 티켓 큐 (매니저) | `/admin/tickets` |

### 1.3 범위 외 (Phase 6 이후)

- IC-05 챗봇 경유 접수
- IC-09~11 AI 보조
- IS-03 자동 상태 알림 — Phase 6에서 보강 (이 Phase는 접수확인만)
- IS-05 엑셀 다운로드
- IS-06 SMS/이메일 수동 발송
- ⑦ 티켓 피드백

---

## 2. 데이터 모델

### 2.1 신규 테이블 5개

#### `tickets`
```ts
id           uuid pk
ticket_no    text not null unique         // 'AS-2026-000123' 형식
hotel_id     uuid fk hotels (nullable)    // 전화 접수에서 호텔 미매핑 가능
reporter_id  uuid fk users (nullable on delete set null)
product_code text not null                // categories.code where type='product'
issue_type   text not null                // categories.code where type='issue_type'
urgency      text not null                // categories.code where type='urgency'
impact_scope text                         // categories.code where type='impact'
title        text not null
content      text not null                // markdown
custom_fields jsonb default '{}'          // ticket_form_fields에 따른 동적 값
status       enum('received','in_progress','on_hold','completed')
                 default 'received'
assignee_id  uuid fk users (nullable on delete set null)
due_date     timestamptz (nullable)
channel      enum('web','phone','chatbot') default 'web'
contact_methods jsonb default '[]'        // ['sms','email'] — IC-03
slack_thread_ts text                      // Slack 스레드 식별자
slack_dev_thread_ts text                  // Dev 에스컬용
created_at, updated_at, is_active
```

인덱스:
- `tickets_ticket_no_uq` UNIQUE on (ticket_no)
- `tickets_status_created_idx` on (status, created_at desc) — 큐 정렬
- `tickets_reporter_created_idx` on (reporter_id, created_at desc) — 내 문의
- `tickets_hotel_created_idx` on (hotel_id, created_at desc)
- `tickets_assignee_status_idx` on (assignee_id, status)
- `tickets_urgency_status_idx` on (urgency, status) — P1 긴급 필터

#### `ticket_messages`
```ts
id          uuid pk
ticket_id   uuid fk tickets on delete cascade
author_id   uuid fk users (nullable on delete set null)
kind        enum('public','internal_memo','status_change','system')
content     text not null
metadata    jsonb default '{}'    // status_change면 { from, to }, system이면 event_key 등
created_at, updated_at, is_active
```

인덱스:
- `ticket_messages_ticket_created_idx` on (ticket_id, created_at)
- `ticket_messages_kind_idx` on (ticket_id, kind)

`kind` 값:
- `public` — 양쪽에 공개 (호텔리어 답변·매니저 답변)
- `internal_memo` — 매니저+어드민만 (호텔리어는 못 봄)
- `status_change` — 시스템 자동 ('받음 → 처리중' 등)
- `system` — Slack 발송 결과, 알림 발송 결과 등 audit

#### `ticket_attachments`
```ts
id            uuid pk
ticket_id     uuid fk tickets on delete cascade
message_id    uuid fk ticket_messages (nullable)  // 첨부가 어느 message에 속하는지 (옵션)
blob_url      text not null      // Vercel Blob URL
pathname      text not null      // Blob pathname
original_name text not null
mime_type     text
size_bytes    integer not null default 0
uploader_id   uuid fk users (nullable)
created_at, updated_at, is_active
```

> S3 대신 **Vercel Blob** 사용 — Vercel 환경에서 가장 단순한 통합.
> 추후 S3 이전이 필요하면 `blob_url`을 `s3_key`로 마이그레이션.

#### `ticket_form_fields`
```ts
id          uuid pk
product_code text (nullable)         // null이면 공통 필드
field_key   text not null
label       text not null
input_type  enum('text','textarea','select','number','date','file')
options     jsonb default '[]'       // select일 때 [{value,label}]
required    boolean default false
sort_order  integer default 0
help_text   text
created_at, updated_at, is_active
```

> Phase 5에선 빈 테이블로 마이그레이션만. Phase 9에서 어드민 편집 UI 추가.
> Phase 5에선 하드코딩된 기본 필드 (제품·유형·영향범위·긴급도·제목·내용·첨부·연락수단)로만 진행.

#### `notification_logs`
```ts
id             uuid pk
template_event_key text not null    // 'ticket.received', 'ticket.escalated_dev' 등
channel        enum('sms','email','slack')
to_address     text                  // 전화/이메일/Slack channel
payload        jsonb default '{}'
status         enum('sent','failed','retry') not null
attempts       integer not null default 1
error_message  text
related_ticket_id uuid fk tickets (nullable)
sent_at        timestamptz
created_at     timestamptz default now()
```

> append-only. `is_active` 없음.

인덱스:
- `notification_logs_ticket_created_idx` on (related_ticket_id, created_at desc)
- `notification_logs_status_idx` on (status)

### 2.2 enum 추가

```sql
CREATE TYPE ticket_status_kind AS ENUM ('received','in_progress','on_hold','completed');
CREATE TYPE ticket_channel_kind AS ENUM ('web','phone','chatbot');
CREATE TYPE ticket_message_kind AS ENUM ('public','internal_memo','status_change','system');
CREATE TYPE ticket_form_field_input AS ENUM ('text','textarea','select','number','date','file');
CREATE TYPE notification_channel AS ENUM ('sms','email','slack');
CREATE TYPE notification_status AS ENUM ('sent','failed','retry');
```

---

## 3. 티켓 번호 발급 정책

형식: `AS-YYYY-NNNNNN` (예: `AS-2026-000001`)

발급 방법:
- 현재 연도 prefix
- 해당 연도의 max(ticket_no) + 1 (zero-padded 6자리)
- 동시성 보호: DB 트랜잭션 내에서 `SELECT ... FOR UPDATE` 또는 try/retry 1회

```ts
// 의사 코드
async function generateTicketNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AS-${year}-`;
  // 연도별 최대 번호
  const rows = await db.execute(sql`
    SELECT COALESCE(MAX(SUBSTRING(ticket_no FROM 9)::int), 0) AS max_no
    FROM tickets
    WHERE ticket_no LIKE ${prefix + '%'}
  `);
  const nextNo = (rows[0]?.max_no ?? 0) + 1;
  return `${prefix}${String(nextNo).padStart(6, '0')}`;
}
```

연도 전환 시 자동으로 새 시퀀스 시작. retry는 최대 3회.

---

## 4. 권한 매트릭스

| 액션 | 호텔리어 | 매니저 | 어드민 |
|:-|:-:|:-:|:-:|
| 신규 접수 (`/tickets/new`) | 본인 호텔만 | ● (channel=web) | ● |
| 전화 접수 (`/admin/tickets/new-by-phone`) | ✕ | ● | ● |
| 내 문의 목록 (`/tickets`) | 본인 reporter_id만 | (본인 접수만) | (본인 접수만) |
| 티켓 상세 (`/tickets/[id]`) | 본인 또는 본인 호텔 | 모두 | 모두 |
| 티켓 상세 (`/admin/tickets/[id]`) | ✕ | 모두 | 모두 |
| 티켓 큐 (`/admin/tickets`) | ✕ | 모두 | 모두 |
| 상태 변경 | ✕ | ● | ● |
| 담당자 배정 | ✕ | ● (본인만) | ● (전체) |
| 내부 메모 | ✕ | ● | ● |
| Dev 에스컬 | ✕ | ● | ● |
| 답변(공개) | 본인 티켓만 | ● | ● |

호텔리어 가시 범위:
- `reporter_id = me.id` OR `hotel_id = me.hotelId` (호텔별 공유)
- 같은 호텔의 다른 호텔리어 티켓도 볼 수 있게 → 호텔 내 정보 공유 효과
- `kind = 'internal_memo'` 메시지는 호텔리어에게 노출 금지 (서버 단에서 필터)

---

## 5. UI 흐름

### 5.1 호텔리어 접수 폼 (`/tickets/new`)

3단계 스텝퍼:

**Step 1 — 무엇이 문제인가요?**
- 제품 선택 (categories: type=product, radio 카드)
- 유형 선택 (categories: type=issue_type, radio 카드)
- 영향범위 (categories: type=impact, select)
- 긴급도 (categories: type=urgency, radio with color hint)

**Step 2 — 자세히 알려주세요**
- 제목 (text, max 200)
- 내용 (textarea, markdown 지원, 최소 10자)
- 첨부파일 (Vercel Blob, drag-drop, 다중, 총 50MB)

**Step 3 — 어떻게 연락드릴까요?**
- SMS/이메일/둘 다 (checkbox)
- 본인 정보 미리보기 (수정 불가, 프로필에서 변경 안내)
- 동의 후 `[접수하기]`

쿼리 파라미터 pre-fill:
- `?type=error` — Step 1 유형을 `error`로 기본 선택
- `?product=pms` — 제품 기본 선택
- `?from=checklist&checklist=...&step=...` — Step 2 content 상단에 컨텍스트 자동 삽입
  ```
  ## 사전 진단
  - 체크리스트: {checklist title}
  - 분기 단계: step {step}
  ```

제출 시:
1. `create ticket` server action
2. `ticket_no` 발급
3. 첨부파일 upload (이미 Blob에 올라가 있으면 ticket_id 매핑)
4. SMS/이메일 발송 (notification_logs 기록)
5. Slack `#as-new` 알림 (urgency=p1 이면 `#as-urgent`도)
6. `redirect /tickets/[id]?created=1`

### 5.2 호텔리어 내 문의 (`/tickets`)

- 본인 + 같은 호텔 티켓 리스트
- 카드형 + 모바일 카드뷰
- 필터: 상태 (전체/접수/처리중/보류/완료), 제품, 정렬 (최신순/오래된순)
- 페이지네이션 (20개씩)
- 상태 뱃지 색상:
  - received → brand
  - in_progress → warn
  - on_hold → slate
  - completed → success
- 카드 클릭 → `/tickets/[id]`

### 5.3 호텔리어 티켓 상세 (`/tickets/[id]`)

- 헤더: 티켓번호, 상태 뱃지, 제목, 접수일자
- 메타 행: 제품·유형·긴급도·영향범위·담당자(있을 때)
- 내용 (markdown 렌더)
- 첨부 (썸네일/파일명 링크)
- 처리 이력 타임라인 (kind=public, status_change만 표시 — internal_memo 제외)
- 추가 답변 작성 폼 (status가 'completed'가 아닐 때만)
- 완료 시 안내 (Phase 6 피드백 위젯 예고)

### 5.4 매니저 큐 (`/admin/tickets`)

- 리스트 + 필터:
  - 상태 (탭) — 미처리/처리중/보류/완료/전체
  - 제품 (select)
  - 유형 (select)
  - 긴급도 (select)
  - 담당자 (select: 미배정/내것/매니저별)
  - 검색 (제목·티켓번호·호텔명)
- 정렬: created_at desc (기본), urgency asc, due_date asc
- 카드 / 데스크탑 테이블 듀얼 뷰
- 카드/행 클릭 → `/admin/tickets/[id]`
- 상단 요약 통계 (P1 긴급 N, 처리 대기 N, 오늘 완료 N)

### 5.5 매니저 티켓 처리 (`/admin/tickets/[id]`)

좌측 (메인):
- 헤더 + 상태 변경 select (received/in_progress/on_hold/completed)
- 담당자 select (전체 매니저+어드민 + 미배정)
- 마감일 picker
- 본문 (markdown)
- 첨부
- 메시지 타임라인 (모든 kind 표시. internal_memo는 색상 다르게)
- 답변 작성: 공개/내부 선택 가능 (radio)

우측 (사이드):
- 메타 (호텔·접수자·연락처·연락방식)
- "Dev 에스컬" 버튼 (Slack `#dev-escalation`로 발송, 이미 발송된 경우 thread_ts 표시)
- "체크리스트 발송 (Phase 6)" 비활성 버튼 (안내)
- 변경 이력 (status_change kind만 추출)

상태 변경 시:
- `ticket_messages` insert (kind=status_change, metadata={from,to})
- 호텔리어 알림 발송 (옵션 — Phase 6 본격화. Phase 5는 logActivity만)
- Slack 채널 발송 (옵션, MVP는 생략)

### 5.6 전화 접수 (`/admin/tickets/new-by-phone`)

매니저 전용. 호텔 검색 + 호텔리어 검색 (선택사항) + 나머지 입력은 일반 접수폼과 동일.
`channel='phone'`, `reporter_id`는 매니저 본인 (또는 호텔리어를 선택했으면 그 사람).
접수확인 SMS/이메일은 호텔리어가 매핑된 경우에만 발송.

---

## 6. 알림 시스템

### 6.1 채널별 동작

| 채널 | 라이브러리 | 키 비어있을 때 |
|:-|:-|:-|
| SMS | `solapi` SDK | console.log stub |
| Email | `@aws-sdk/client-sesv2` | console.log stub |
| Slack | `@slack/web-api` | console.log stub |

모든 발송은 `notification_logs`에 fire-and-forget으로 기록 (성공/실패 무관하게).

### 6.2 이벤트별 발송

| 이벤트 | 채널 | 대상 | 트리거 |
|:-|:-|:-|:-|
| `ticket.received` | SMS+Email | 접수자 (contact_methods 따라) | 신규 접수 |
| `ticket.in_progress` | SMS+Email | 접수자 | 상태 변경 → in_progress (Phase 6 자동) |
| `ticket.completed` | SMS+Email | 접수자 | 상태 변경 → completed (Phase 6 자동) |
| `ticket.new_slack` | Slack | `#as-new` | 모든 신규 접수 |
| `ticket.urgent_slack` | Slack | `#as-urgent` | urgency=p1 신규 접수 |
| `ticket.escalated_dev` | Slack | `#dev-escalation` | Dev 에스컬 버튼 |

### 6.3 솔라피 SDK 통합

`lib/notifications/solapi.ts`를 실 SDK 호출로 교체:
```ts
import solapi from 'solapi';
const client = new solapi.SolapiMessageService(API_KEY, API_SECRET);
await client.send({
  to: input.to,
  from: env.SOLAPI_SENDER,
  text: input.text,
});
```

키 미설정 시 stub은 유지.

### 6.4 Slack 통합

`lib/notifications/slack.ts` 신규:
```ts
import { WebClient } from '@slack/web-api';
// 또는 Webhook 방식: IncomingWebhook
```

CLAUDE.md에 따라 **Slack Webhook** 사용 (env에 webhook URL 3개).
WebClient 대신 fetch + JSON Block Kit으로 간단히 처리.
스레드 답글이 필요한 곳 (Dev 에스컬 ↔ 티켓 양방향)은 webhook으로는 ts를 못 얻으므로
**현재 Phase 5는 webhook 단방향만 구현**. 양방향 스레드 동기화는 추후 Bot Token 발급 후 Phase 6+.

`slack_thread_ts` 컬럼은 미래 대비 비워둠.

---

## 7. Vercel Blob 통합

### 7.1 업로드 흐름

Phase 5는 **client-side upload** + `/api/upload`에서 presigned URL 발급 패턴 대신,
**`/api/upload` POST → 서버에서 `put()`** 방식 사용 (Vercel 권장).

```ts
// app/api/upload/route.ts
import { put } from '@vercel/blob';

POST(request) {
  // 1. 로그인 확인
  // 2. multipart/form-data parse
  // 3. file size check (50MB)
  // 4. blob.put(pathname, file)
  // 5. return { url, pathname, originalName, mimeType, sizeBytes }
}
```

업로드한 파일은 **티켓 생성 전에는 ticket_id가 없으므로** 별도 staging 영역에 보관.
- pathname pattern: `tickets/_staging/{userId}/{uuid}-{filename}`
- 티켓 생성 시 ticket_attachments에 매핑하고 그대로 사용 (재업로드 X)
- staging cleanup은 TTL 기반 cron으로 (이번 Phase는 미구현, 운영 매뉴얼에 메모만)

### 7.2 권한·보안

- 인증된 사용자만 업로드
- 파일 확장자 화이트리스트: 이미지 (jpg/png/gif/webp/heic), PDF, 로그 (.log/.txt), 비디오 (mp4/mov), 압축 (.zip)
- 각 파일 최대 50MB, 한 티켓 총 최대 200MB (느슨한 가드)
- 이미지 외 직접 링크 노출은 매니저+어드민+본인만 (현재 Phase는 Blob URL 공개 — 추후 signed URL로 강화 가능)

---

## 8. 파일 구성

### 8.1 신규 스키마

```
db/schema/tickets.ts            (tickets + 관련 enum)
db/schema/ticket-messages.ts
db/schema/ticket-attachments.ts
db/schema/ticket-form-fields.ts
db/schema/notification-logs.ts
db/schema/index.ts              (export 추가)
```

### 8.2 신규 lib

```
lib/notifications/slack.ts            (Slack Webhook 헬퍼)
lib/notifications/solapi.ts            (실 SDK 교체)
lib/notifications/ses.ts               (notification_logs 기록 추가)
lib/notifications/templates.ts         (ticket.* 템플릿 추가)
lib/services/tickets.ts                (티켓 CRUD + 발급 + 알림)
```

### 8.3 신규 Server Actions

```
app/actions/ticket-actions.ts          (create / addMessage / changeStatus / assign / escalate)
```

### 8.4 신규 API Route

```
app/api/upload/route.ts                (Vercel Blob upload)
```

### 8.5 신규 페이지

호텔리어:
```
app/tickets/page.tsx                                  (rewrite: 내 문의 리스트)
app/tickets/_components/my-tickets-list.tsx
app/tickets/_components/my-tickets-filters.tsx

app/tickets/new/page.tsx                              (rewrite: 3단계 스텝퍼)
app/tickets/new/_components/ticket-create-form.tsx
app/tickets/new/_components/attachment-uploader.tsx

app/tickets/[id]/page.tsx                             (신규: 호텔리어 상세)
app/tickets/[id]/_components/ticket-thread.tsx
app/tickets/[id]/_components/reply-form.tsx
```

매니저+어드민:
```
app/(admin)/admin/tickets/page.tsx                    (신규: 큐 리스트)
app/(admin)/admin/tickets/_components/tickets-filters.tsx
app/(admin)/admin/tickets/_components/tickets-list-client.tsx
app/(admin)/admin/tickets/_components/tickets-summary-cards.tsx

app/(admin)/admin/tickets/[id]/page.tsx               (신규: 매니저 상세/처리)
app/(admin)/admin/tickets/[id]/_components/admin-ticket-thread.tsx
app/(admin)/admin/tickets/[id]/_components/admin-ticket-actions.tsx
app/(admin)/admin/tickets/[id]/_components/admin-reply-form.tsx

app/(admin)/admin/tickets/new-by-phone/page.tsx       (전화 접수)
app/(admin)/admin/tickets/new-by-phone/_components/phone-ticket-form.tsx
```

### 8.6 기존 보강

```
app/troubleshoot/[id]/_components/checklist-runner.tsx      (escalateLink 확인 — 이미 ?from=checklist 전달함)
components/layout/header.tsx                                  (티켓 큐 메뉴 — 매니저+어드민)
app/(admin)/admin/_components/admin-nav.tsx                   (티켓 탭 추가)
db/seed.ts                                                     (샘플 티켓 3건 + 메시지 8~9건)
```

### 8.7 마이그레이션

```
db/migrations/0003_phase5_tickets.sql                         (placeholder — drizzle-kit generate가 덮어씀)
```

---

## 9. 구현 순서 (메인 세션 실행 순서와 일치)

1. 스키마 5개 작성 + index 추가
2. 마이그레이션 placeholder 작성
3. package.json 의존성 추가
4. 알림 모듈 4개 (slack/solapi/ses/templates)
5. tickets service (티켓번호 발급 + CRUD + 알림 wire-up)
6. ticket-actions Server Actions
7. Vercel Blob upload API
8. 호텔리어 페이지 3종
9. 매니저 페이지 3종
10. 헤더 + admin-nav 보강
11. 시드 데이터
12. dev-logs HTML 보고서

---

## 10. 알려진 리스크 / 가정

- **Vercel Blob 키**: `BLOB_READ_WRITE_TOKEN` 환경변수 필요. 미설정 시 업로드 API는 503.
- **Slack Webhook 미설정 시**: stub (console.log) — 빌드/배포는 정상 진행.
- **솔라피 SDK 패키지명**: `solapi` (npm). 키 미설정 시 stub.
- **티켓번호 동시성**: 고동시 접수 환경에서는 advisory lock이 필요할 수 있으나, MVP는 정수 충돌 시 retry 1회로 처리.
- **첨부파일 staging cleanup**: TTL 미구현 (운영 메뉴얼에만 기록). 실제 운영에선 Vercel Blob의 `list` + 1일 이전 staging 삭제 cron 필요.
- **Slack 양방향 스레드 (IC-07)**: webhook으로는 thread_ts를 못 받음. Phase 5는 단방향 발송만. 진정한 양방향은 Slack App Bot Token + Event Subscription 필요 → 별도 Phase.

---

## 11. 완료 기준

- [ ] 호텔리어가 셀프 픽스 페이지에서 escalate → 접수폼 pre-fill 정상
- [ ] 호텔리어가 3단계로 접수 → 티켓번호 발급 → SMS·이메일·Slack 동시 발송
- [ ] 호텔리어가 `/tickets`에서 본인 + 같은 호텔 티켓 확인
- [ ] 호텔리어가 상세에서 추가 답변 작성 가능 (completed 외)
- [ ] 호텔리어에게 internal_memo 메시지 노출 안 됨
- [ ] 매니저가 `/admin/tickets`에서 큐 필터/정렬/검색 사용 가능
- [ ] 매니저가 상태/담당자/마감일 변경 → status_change 메시지 기록
- [ ] 매니저가 내부 메모 작성 → 호텔리어 화면엔 표시 안 됨
- [ ] Dev 에스컬 버튼 클릭 → Slack `#dev-escalation` 발송 → notification_logs 기록
- [ ] 전화 접수 폼에서 매니저가 호텔 검색 후 직접 작성 가능
- [ ] 헤더에 매니저+어드민일 때 "티켓 큐" 메뉴 노출
- [ ] 시드 후 샘플 티켓 3건 + 메시지 8~9건 확인 가능
- [ ] 모바일에서 카드뷰 + 3단계 스텝퍼 정상 동작
- [ ] 시드 재실행 idempotent
