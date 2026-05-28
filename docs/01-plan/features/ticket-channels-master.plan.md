# ticket-channels-master — Plan

> **Feature**: 유입 채널 마스터화 + 대리 접수 폼 채널 드롭다운
> **Phase**: Plan (PDCA)
> **작성일**: 2026-05-28
> **선행 결정**: 페이지 통합 X / 유입채널만 마스터화 / 페이지는 분리 유지
> **상태**: ✅ APPROVED — Design 단계 진입 가능 (Q-1~Q-4 결정 완료)

---

## 1. 배경 (Why)

### 1.1 발견된 문제

- **티켓 유입 채널이 enum 하드코드**: `db/schema/tickets.ts:37` `ticket_channel_kind = ('web', 'phone', 'chatbot')` — DB 변경 없이 채널 확장 불가
- **표시 라벨 하드코드 산재**:
  - `app/tickets/[id]/page.tsx:213-217` — 삼항 분기 인라인
  - `app/(admin)/admin/tickets/[id]/page.tsx:344-353` — `channelLabel()` 함수
- **`new-by-phone` 페이지가 "전화"에 고정**: `app/actions/ticket-actions.ts:212` `channel: 'phone'` 하드코드 → 매니저가 카카오톡/이메일로 들어온 문의도 같은 폼으로 받지만 채널이 'phone'으로 저장됨 (데이터 왜곡)
- **CLAUDE.md 8번 원칙 미준수**: "어드민 DB 편집 우선 설계" — 마스터 데이터인데 어드민에서 편집 불가

### 1.2 현재 구조 진단 (분리 페이지 유지 근거)

| 페이지 | 본질 | 채널과의 관계 |
|:-|:-|:-|
| `/tickets/new` | 본인 셀프 접수 (호텔리어/매니저/어드민) | 항상 `web` 고정 (브라우저 직접 접수) |
| `/admin/tickets/new-by-phone` | 매니저/어드민 **대리** 접수 (호텔/접수자 선택 UI 필수) | 통화·카카오톡·이메일 등 **다양** |

→ **UI 톤이 본질적으로 다름** (안내형 3단계 스텝퍼 vs 통화 중 빠른 1페이지). 페이지 분리는 합리적. 다만 후자의 채널은 **마스터에서 선택**할 수 있어야 한다.

---

## 2. Goals (G1~G5)

| ID | Goal | 측정 기준 |
|:-:|:-|:-|
| **G1** | `ticket_channels` 마스터 테이블 신설 — 어드민에서 채널 추가/수정/숨김 가능 | `/admin/master/ticket-channels` CRUD 동작 + 시드 4종 이상 |
| **G2** | `tickets.channel` 컬럼 enum → text 전환 — 마스터 code 문자열 저장 | 기존 데이터 무손실 마이그레이션 + 신규 채널 INSERT 가능 |
| **G3** | `/admin/tickets/new-by-phone` 폼에 "유입 채널" 드롭다운 추가 (기본값 `phone`) | 매니저가 카카오톡 문의를 'kakao'로 저장 가능 |
| **G4** | 티켓 상세/리스트의 채널 라벨이 마스터에서 동적 조회 | 하드코드 라벨 0건 (grep 검증) |
| **G5** | 페이지 제목/설명을 "전화 접수" → "대리 접수"로 톤 다듬기 | UI 문구 일관성 (전화 외 채널도 받을 수 있음을 시사) |

---

## 3. Non-Goals (이번 Phase에서 안 함)

- `/tickets/new`(호텔리어 셀프 접수) 폼 변경 — 항상 `web` 고정 유지
- 페이지 경로 변경 (`new-by-phone` → `new-on-behalf`) — 외부 링크/북마크 영향 우려, 후속 Phase에서 redirect와 함께 일괄 처리
- 호텔리어가 채널을 직접 선택하게 하기 — UX 혼란 (셀프 접수자는 어차피 web)
- 채널별 자동 라우팅·SLA 분기 등 비즈니스 로직 추가
- 알림 채널(`notification-templates`의 `channel: 'sms' | 'email'`)과의 통합 — **다른 개념**, 혼동 방지를 위해 분리 유지

---

## 4. Scope — 작업 항목 (P0/P1)

### 4.1 P0 (필수)

| ID | 항목 | 영향 파일 |
|:-:|:-|:-|
| **P0-A** | `db/schema/ticket-channels.ts` 신규 스키마 작성 | 신규 1개 |
| **P0-B** | `tickets.channel` enum → text 마이그레이션 + enum drop | `db/schema/tickets.ts` 수정 |
| **P0-C** | 시드 데이터 추가 (web/phone/chatbot/kakao/email/walk_in) | `db/seed.ts` |
| **P0-D** | `lib/services/master-ticket-channels.ts` CRUD 서비스 | 신규 1개 |
| **P0-E** | `app/actions/master-ticket-channels-actions.ts` Server Actions | 신규 1개 |
| **P0-F** | `/admin/master/ticket-channels` 페이지 (목록+신규+상세) | 신규 3개 |
| **P0-G** | `/admin/tickets/new-by-phone` 폼에 채널 드롭다운 추가 | `phone-ticket-form.tsx` 수정 + `page.tsx` |
| **P0-H** | `createTicketByPhoneAction` channel formData 받기 + 검증 | `ticket-actions.ts:182-238` |
| **P0-I** | 티켓 상세 라벨을 마스터에서 가져오기 (캐시) | `app/tickets/[id]/page.tsx`, `app/(admin)/admin/tickets/[id]/page.tsx` |

### 4.2 P1 (권장)

| ID | 항목 |
|:-:|:-|
| **P1-J** | `IMPLEMENTATION_PLAN.md` `tickets` 스키마 정의(L261) 갱신 + `ticket_channels` 정의 추가 |
| **P1-K** | `/admin` 사이드바 master 메뉴에 "유입 채널" 추가 |
| **P1-L** | 페이지 제목/설명 톤 다듬기 ("전화 접수" → "대리 접수 (전화·카카오·이메일 등)") |
| **P1-M** | 매니저 어드민 메뉴 "신규 접수" 라벨 변경 검토 |
| **P1-N** | 티켓 리스트(`/admin/tickets`)에 채널 필터/뱃지 추가 (코드+아이콘) |

---

## 5. DB 설계 (예비)

### 5.1 `ticket_channels` 테이블

```ts
// db/schema/ticket-channels.ts
import { boolean, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';

export const ticketChannels = pgTable(
  'ticket_channels',
  {
    ...commonColumns(),
    /** 'web' | 'phone' | 'chatbot' | 'kakao' | 'email' | 'walk_in' ... */
    code: text('code').notNull(),
    /** '웹', '전화', '챗봇', '카카오톡', '이메일', '방문' */
    label: text('label').notNull(),
    description: text('description'),
    /** lucide 컴포넌트 이름 ('Globe' | 'Phone' | 'MessageCircle' ...) */
    icon: text('icon'),
    /** 매니저 대리 접수 폼 드롭다운 노출 여부 */
    selectableInAgentForm: boolean('selectable_in_agent_form').notNull().default(true),
    /** 매니저 대리 접수 폼 기본 선택값(true는 1개만) */
    isAgentDefault: boolean('is_agent_default').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    uniqueIndex('ticket_channels_code_uniq').on(table.code),
  ],
);

export type TicketChannel = typeof ticketChannels.$inferSelect;
export type NewTicketChannel = typeof ticketChannels.$inferInsert;
```

**비고**:
- `code`는 unique. 기존 enum 값과 동일 (`web`, `phone`, `chatbot`) → 호환성 보장
- `selectableInAgentForm = false` 케이스: `web`(호텔리어 자동), `chatbot`(챗봇 자동) — 매니저가 굳이 선택할 일 없음
- `isAgentDefault = true`는 1개만 (시드에서 `phone` 지정). UI에서도 강제하지 않고 어드민 UX로 가이드
- 아이콘은 lucide-react 컴포넌트 이름 문자열 (quick-actions 패턴과 동일)

### 5.2 `tickets.channel` 컬럼 변경

```ts
// db/schema/tickets.ts:78 변경
// 기존
channel: ticketChannelEnum('channel').notNull().default('web'),

// 변경 후
channel: text('channel').notNull().default('web'),
```

**enum drop 마이그레이션 순서** (Drizzle):
1. `channel` 컬럼 타입 `text`로 변경 (기존 enum 값 그대로 보존)
2. `ticket_channel_kind` enum drop
3. `ticketChannelEnum` export 삭제

**FK는 안 검**: 마스터 비활성화돼도 과거 티켓의 `channel` 값이 깨지지 않도록. 표시할 때 마스터 조회 후 없으면 raw code 노출.

### 5.3 시드

```ts
// db/seed.ts 추가
await db.insert(ticketChannels).values([
  { code: 'web', label: '웹', icon: 'Globe', sortOrder: 10,
    selectableInAgentForm: false, isAgentDefault: false },
  { code: 'phone', label: '전화', icon: 'Phone', sortOrder: 20,
    selectableInAgentForm: true, isAgentDefault: true },
  { code: 'chatbot', label: '챗봇', icon: 'Bot', sortOrder: 30,
    selectableInAgentForm: false, isAgentDefault: false },
  { code: 'kakao', label: '카카오톡', icon: 'MessageCircle', sortOrder: 40,
    selectableInAgentForm: true, isAgentDefault: false },
  { code: 'email', label: '이메일', icon: 'Mail', sortOrder: 50,
    selectableInAgentForm: true, isAgentDefault: false },
  { code: 'walk_in', label: '방문', icon: 'Footprints', sortOrder: 60,
    selectableInAgentForm: true, isAgentDefault: false },
]).onConflictDoNothing();
```

---

## 6. 리스크 (사전 식별)

| ID | 카테고리 | 리스크 | 완화책 |
|:-:|:-|:-|:-|
| **C1** | 마이그레이션 | enum → text 변경 시 기존 production 데이터 손실 | dev에선 `drizzle-kit push`, prod는 별도 SQL 작성: `ALTER COLUMN channel TYPE text USING channel::text` |
| **C2** | 마이그레이션 | enum drop 순서 잘못으로 빌드 실패 | 절대 순서 준수: 컬럼 타입 변경 → 사용처 코드 수정 → enum drop |
| **C3** | 타입 | `TicketChannel` 타입이 enum 기반에서 string으로 변경 | 외부에서 `TicketChannel` 사용하는 파일 grep — `'web' \| 'phone' \| 'chatbot'` 잔존 코드 정리 |
| **D1** | UX 중복 | "유입 채널"과 알림 템플릿의 `channel(sms/email)`이 비슷한 이름 | 어드민 메뉴 라벨을 "**유입 채널**" 로 명확화. 알림 쪽은 "**알림 수단**" 으로 변경 검토 (별도) |
| **D2** | UX | 매니저가 'web' 채널 선택해서 저장하면 본인 셀프 접수와 구분 불가 | `selectableInAgentForm=false`인 채널은 드롭다운에서 제외 (DB 제약 X, UI 가드 O) |
| **E1** | 보안 | 클라이언트가 임의 채널 code 전송 가능 | Zod 스키마에서 `text` 길이만 검증 (60자 이내), 실 존재 검증은 마스터 IN 절. 미존재 code 거부 또는 'phone' fallback 정책 결정 필요 |
| **E2** | 캐시 | 티켓 상세 페이지마다 channel 마스터 조회 시 N+1 | 페이지당 1회만 조회 (또는 `unstable_cache` 5분 TTL) |
| **E3** | UX | 어드민이 사용 중 채널을 비활성(is_active=false)하면 기존 티켓 라벨 깨짐 | 비활성 채널도 라벨 조회는 가능하게 (`is_active` 필터를 select용에만 적용) |
| **E4** | 일관성 | `channelLabel()` 함수가 2곳에 중복 (admin/[id], user/[id]) | 공통 헬퍼 `lib/ticket-channel-label.ts` 또는 마스터 조회 결과를 page에서 prop drilling |
| **R1** | 회귀 | 기존 티켓 페이지 표시 깨짐 | 마이그레이션 후 기존 3종 코드 데이터로 라벨 표시 시각 검증 |
| **R2** | 회귀 | E2E `T-08` 등 기존 시나리오 영향 | role-mode-ui E2E는 채널 무관 — 영향 없음 확인 |
| **R3** | 회귀 | `app/actions/ticket-actions.ts:144,163,212` 하드코드 'web'/'phone'은 유지(셀프 접수=web 고정, 전화접수 기본=phone) | 변경 안 함, 다만 phone은 매니저 폼에서 override 가능하도록 분기 |

---

## 7. 검증 기준 (Acceptance Criteria)

### 7.1 기능

- [ ] 어드민이 `/admin/master/ticket-channels`에서 채널 신규 추가 가능
- [ ] 어드민이 기존 채널 라벨/아이콘/순서 수정 가능
- [ ] 어드민이 채널 비활성(soft delete) 가능 — `is_active=false`로
- [ ] 비활성 채널은 매니저 폼 드롭다운에서 사라짐 (단, 과거 티켓에선 라벨 정상 표시)
- [ ] 매니저가 `/admin/tickets/new-by-phone`에서 채널 'kakao' 선택 → DB에 'kakao' 저장
- [ ] 호텔리어가 `/tickets/new`에서 접수 → DB에 'web' 저장 (변경 없음)
- [ ] 티켓 상세에서 'kakao' 라벨 "카카오톡"으로 표시 + Lucide MessageCircle 아이콘 표시
- [ ] 마이그레이션 후 기존 enum 데이터('web'/'phone'/'chatbot') 무손실 확인

### 7.2 코드 품질

- [ ] grep `channel === 'phone'` → 0건 (admin 페이지 channelLabel 함수 제거 또는 마스터 기반으로 재구성)
- [ ] grep `'web' \| 'phone' \| 'chatbot'` → tickets.ts schema 외 0건
- [ ] `ticketChannelEnum` export 삭제 후 빌드 통과
- [ ] TypeScript 에러 0건

### 7.3 회귀

- [ ] 기존 E2E 9건 통과 (role-mode-ui)
- [ ] 호텔리어 셀프 접수 폼 동작 변경 없음
- [ ] 매니저 전화 접수 폼 기존 동작(`phone`이 기본 선택) 유지

---

## 8. 전략 결정 사항 (2026-05-28 사용자 확정)

| ID | 결정 | 적용 |
|:-:|:-|:-|
| **Q-1** | ✅ **미존재 channel code 거부 (400 에러)** | `createTicketByPhoneAction` Zod 검증 단계에서 마스터 IN 절 조회 후 미존재 시 `fieldErrors.channel` 반환. 데이터 정합성 최우선. |
| **Q-2** | ✅ **1단계 마이그레이션 (text 변환 + enum drop 동시)** | 단일 PR로 처리. Drizzle migration 파일에 ALTER COLUMN + DROP TYPE 순서 포함. 롤백은 git revert. |
| **Q-3** | ✅ **현 경로 `/admin/tickets/new-by-phone` 유지** | 외부 링크/북마크 영향 0. 페이지 내 제목/설명만 "**대리 접수** (전화·카카오·이메일 등)"으로 톤 다듬기(P1-L). 경로 변경은 후속 Phase. |
| **Q-4** | ✅ **티켓 상세 메타 영역에만 아이콘+라벨 표시** | 이번 Phase는 상세 페이지에만. 리스트/칸반 카드 적용은 P1-N (분리). 마스터 `icon` 필드는 유지(향후 확장 대비). |

---

## 9. 일정 추정

| 단계 | 작업 | 추정 시간 |
|:-|:-|:-:|
| Plan 확정 | 본 문서 + Q-1~Q-4 결정 | 사용자 확인 후 즉시 |
| Design | DB 스키마 확정, 페이지 와이어프레임, 컴포넌트 명세 | 30분 |
| Do — DB | 스키마 + 마이그레이션 + 시드 | 30분 |
| Do — 서비스 | CRUD service + Server Actions | 30분 |
| Do — UI | 어드민 master 페이지 3개 (목록/신규/상세) | 60분 |
| Do — 폼 | 전화접수 폼 드롭다운 + ticket-actions 검증 | 30분 |
| Do — 정리 | 라벨 마스터화, 하드코드 제거, 빌드 | 30분 |
| Check | gap 분석 + E2E 회귀 | 30분 |
| Report | 보고서 + Executive Summary | 20분 |
| **합계** | | **약 5시간** |

---

## 10. 다음 단계

1. **사용자 확인**: Q-1~Q-4 옵션 결정 + 본 Plan 승인
2. → `/pdca design ticket-channels-master` (DB 스키마 확정 + 페이지 와이어프레임)
3. → 구현 (P0 → P1 순서)
4. → Check (gap-detector)
5. → Report

---

## 부록 A. 영향 받는 파일 (구현 시 변경 예상)

### 신규 (7개)
- `db/schema/ticket-channels.ts`
- `lib/services/master-ticket-channels.ts`
- `app/actions/master-ticket-channels-actions.ts`
- `app/(admin)/admin/master/ticket-channels/page.tsx`
- `app/(admin)/admin/master/ticket-channels/new/page.tsx`
- `app/(admin)/admin/master/ticket-channels/[id]/page.tsx`
- `app/(admin)/admin/master/ticket-channels/_components/channel-form.tsx`
- `lib/ticket-channel-label.ts` (선택)

### 수정 (7개)
- `db/schema/tickets.ts` (enum drop, text 변경)
- `db/seed.ts` (시드 추가)
- `db/schema/index.ts` (export 추가)
- `app/actions/ticket-actions.ts` (createTicketByPhoneAction channel 검증)
- `app/(admin)/admin/tickets/new-by-phone/page.tsx` (마스터 props 추가)
- `app/(admin)/admin/tickets/new-by-phone/_components/phone-ticket-form.tsx` (드롭다운 추가)
- `app/tickets/[id]/page.tsx`, `app/(admin)/admin/tickets/[id]/page.tsx` (라벨 마스터화)
- `docs/IMPLEMENTATION_PLAN.md` (L261 갱신, 마스터 정의 추가)
- `app/(admin)/admin/master/page.tsx` 또는 master 사이드바 (메뉴 추가)
