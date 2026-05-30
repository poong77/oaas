# business-hours-master — Design

> **Feature**: 운영시간 + 공휴일 + 예약 변경 + 연락처 통합 마스터
> **Phase**: Design (PDCA) — **사후 작성**
> **선행 문서**: [docs/01-plan/features/business-hours-master.plan.md](../../01-plan/features/business-hours-master.plan.md)
> **작성일**: 2026-05-30
> **상태**: APPROVED — 구현 완료 분과 일치

---

## 0. 개요

Plan에서 확정된 G1~G7 + P1·P2·P3 모든 항목의 구현 명세를 확정한다. **운영시간·점심·접수마감·휴무·긴급전화·대표전화·이메일·ARS·Fax·웹사이트가 단일 도메인**이라는 통찰에서 출발해, `business_hours_default` 한 테이블에 응집하고 어드민이 한 화면에서 통째로 편집한다. 호텔리어는 4곳(헤더·사이드바×2·푸터)에서 같은 데이터를 1분 단위로 자동 갱신해 본다.

| 결정 | 선택 | Design 반영 |
|:-|:-|:-|
| 단일 행 강제 | service layer | §3.1, §4.1 — UI 신규 생성 차단 |
| 충돌 방지 | service 사전 검증 | §4.4 `hasOverrideCollision()` |
| 이력 저장 | `activity_logs` 재사용 | §10 action 11종 패턴 |
| override 휴무 표현 | `forcedClosure` 옵션 | §3.3 calculate 시그니처 유지 |
| 연락처 응집 | default 컬럼 통합 | §2.1 컬럼 5개 추가 |
| 탭 라우팅 | `?tab=` searchParam | §7.1 SSR 친화 |

---

## 1. 파일 변경 요약

### 1.1 신규 파일 (20개)

**DB (3 + 스크립트 2)**
| 경로 | 역할 | Phase |
|:-|:-|:-:|
| `db/schema/business-hours-default.ts` | 단일 행 마스터 + ArsItem 타입 | P1·P3 |
| `db/schema/business-hours-overrides.ts` | 예약 변경 (kind/status enum) | P2 |
| `db/schema/business-holidays.ts` | 공휴일 + 부분 unique index | P1 |
| `db/scripts/add-contact-columns.ts` | P3-W 컬럼 5개 안전 추가 (다른 세션 migration 충돌 회피) | P3 |
| `db/scripts/cleanup-duplicate-settings.ts` | system_settings 잔여 키 cleanup | P3 |

**도메인·서비스·훅 (3)**
| 경로 | 역할 | Phase |
|:-|:-|:-:|
| `lib/business-hours/calculate.ts` | 순수 함수 (timezone-aware) | P1·P2 |
| `lib/services/business-hours.ts` | CRUD + cron + audit + status 통합 | P1·P2·P3 |
| `lib/hooks/use-business-status.ts` | 클라이언트 훅 (1분 tick + 5분 refetch) | P1 |

**API & Cron (2)**
| 경로 | 역할 | Phase |
|:-|:-|:-:|
| `app/api/business-hours/context/route.ts` | 정책 + 공휴일 + active override 머지 결과 (60s 캐시) | P1·P2 |
| `app/api/cron/business-hours-overrides/route.ts` | 매일 KST 00:01 cron | P2·P3 |

**Server Actions (1)**
| 경로 | 역할 | Phase |
|:-|:-|:-:|
| `app/actions/master-business-hours-actions.ts` | 7개 액션 (default upsert / holiday CRUD / replicate / override CRUD / shorten / cancel) | P1·P2·P3 |

**어드민 페이지 (7)**
| 경로 | 역할 | Phase |
|:-|:-|:-:|
| `app/(admin)/admin/master/business-hours/page.tsx` | 메인 (4탭 라우팅) | P1·P2 |
| `_components/tab-bar.tsx` | 탭 네비 (카운트 뱃지) | P1·P2 |
| `_components/status-preview.tsx` | 실시간 운영상태 미리보기 | P1 |
| `_components/business-hours-form.tsx` | 탭 ① 편집 폼 (시간 + 휴무 + 긴급 + 연락처) | P1·P3 |
| `_components/holidays-section.tsx` | 탭 ③ 리스트 + 인라인 추가 + 양력 복제 | P1·P3 |
| `_components/overrides-section.tsx` | 탭 ② 상태별 그룹 + 신규 폼 + 단축 인라인 | P2·P3 |
| `_components/history-section.tsx` | 탭 ④ activity_logs 타임라인 (user JOIN) | P2·P3 |

**호텔리어 컴포넌트 (2)**
| 경로 | 역할 | Phase |
|:-|:-|:-:|
| `components/contact/business-status-badge.tsx` | size=sm(헤더) / md(사이드바·푸터) | P1 |
| `components/contact/contact-panel.tsx` | variant=sidebar(수직) / footer(가로) | P1·P3 |

### 1.2 수정 파일

| 경로 | 변경 내용 |
|:-|:-|
| `db/schema/index.ts` | 3개 신규 스키마 export |
| `db/seed.ts` | default 1행 + 19 공휴일 시드 + 연락처 backfill 로직 + `system_settings.business_hours`·`contact_phone` 키 제거 |
| `components/layout/header.tsx` | `<BusinessStatusBadge size="sm" />` 우상단 (`sm:block`만) |
| `components/layout/role-scope.tsx` | `<ContactPanel variant="footer" />` 전역 (어드민 외) |
| `app/(admin)/admin/master/page.tsx` | "운영시간" 카드 + system-settings description 수정 |
| `app/help/page.tsx`, `app/faq/page.tsx`, `app/troubleshoot/page.tsx`, `app/troubleshoot/[id]/page.tsx`, `app/tickets/new/page.tsx` | `[1fr_300px]` grid + sidebar ContactPanel |
| `vercel.json` | `1 15 * * *` UTC cron 등록 |
| `docs/IMPLEMENTATION_PLAN.md` | 마스터 표·Phase 1·Phase 9 항목 추가 + 체크박스 동기화 |

---

## 2. DB 스키마 최종안

### 2.1 `business_hours_default`

```ts
export const businessHoursDefault = pgTable('business_hours_default', {
  ...commonColumns(),  // id (uuid PK), created_at, updated_at, is_active
  // 시간 정책
  weekdayOpen: time('weekday_open').notNull(),
  weekdayClose: time('weekday_close').notNull(),
  lunchStart: time('lunch_start'),
  lunchEnd: time('lunch_end'),
  intakeDeadline: time('intake_deadline'),
  // 휴무 정책
  saturdayClosed: boolean('saturday_closed').notNull().default(true),
  sundayClosed: boolean('sunday_closed').notNull().default(true),
  holidaysClosed: boolean('holidays_closed').notNull().default(true),
  // 긴급전화 (운영 외)
  emergencyPhone: text('emergency_phone'),
  emergencyNote: text('emergency_note'),
  // 연락처 — P3-W 일원화 (system_settings에서 이전)
  mainPhone: text('main_phone'),         // '1833-4702'
  mainEmail: text('main_email'),         // 'as@oapms.com'
  arsItems: jsonb('ars_items').notNull().default([]).$type<ArsItem[]>(),
  faxNumber: text('fax_number'),         // '0505-300-4702'
  websiteUrl: text('website_url'),       // 'www.oapms.com'
  // 기타
  timezone: text('timezone').notNull().default('Asia/Seoul'),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

export type ArsItem = { num: string; label: string };
```

**단일 행 강제**: DB 제약 없음. service layer (`upsertBusinessHoursDefault`)가 활성 행 1건만 사용.

### 2.2 `business_holidays`

```ts
export const businessHolidays = pgTable('business_holidays', {
  ...commonColumns(),
  date: date('date').notNull(),
  name: text('name').notNull(),
  isRecurring: boolean('is_recurring').notNull().default(false),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
}, (table) => [
  // 활성 행만 같은 date 유니크 — 비활성은 허용 (삭제 이력 보존)
  uniqueIndex('business_holidays_date_uniq')
    .on(table.date)
    .where(sql`is_active = true`),
]);
```

### 2.3 `business_hours_overrides`

```ts
export const businessHoursOverrideKindEnum = pgEnum('business_hours_override_kind', [
  'short_hours', 'closed', 'custom',
]);
export const businessHoursOverrideStatusEnum = pgEnum('business_hours_override_status', [
  'scheduled', 'active', 'expired', 'canceled',
]);

export const businessHoursOverrides = pgTable('business_hours_overrides', {
  ...commonColumns(),
  kind: businessHoursOverrideKindEnum('kind').notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveUntil: date('effective_until').notNull(),
  weekdayOpen: time('weekday_open'),     // NULL → default 사용
  weekdayClose: time('weekday_close'),
  lunchStart: time('lunch_start'),
  lunchEnd: time('lunch_end'),
  intakeDeadline: time('intake_deadline'),
  reason: text('reason').notNull(),
  status: businessHoursOverrideStatusEnum('status').notNull().default('scheduled'),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
});
```

---

## 3. 도메인 로직

### 3.1 `calculateBusinessStatus` 순수 함수

```ts
function calculateBusinessStatus(args: {
  now: Date;
  hours: BusinessHoursInput;
  holidays: HolidayInfo[];
}): BusinessStatusResult;
```

**우선순위 분기**:
1. `hours.forcedClosure` → 즉시 `status='closed', label=forcedClosure.label` (override 임시휴무)
2. `holidaysClosed && todayHoliday` → closed, label=`${name} 휴무`
3. `weekday===0 && sundayClosed` → closed, label=`일요일 휴무`
4. `weekday===6 && saturdayClosed` → closed, label=`토요일 휴무`
5. `now < open` → closed, label=`운영 시작 전`, nextOpenAt=today open
6. `now >= close` → closed, label=`운영 종료`, nextOpenAt=다음 운영일
7. `lunchStart <= now < lunchEnd` → status='lunch', nextOpenAt=lunchEnd
8. `intakeDeadline !== null && now >= intakeDeadline` → status='intake_closed'
9. otherwise → status='open'

### 3.2 timezone 처리

```ts
// UTC Date → KST 'YYYY-MM-DD' / 'HH:MM' / weekday
const iso = now.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
// sv-SE 로케일은 ISO 형식 그대로 출력 ('2026-05-30 14:30:45')

// KST localDate + localTime → UTC Date (Asia/Seoul만 정확)
return new Date(Date.UTC(y, m-1, d, hh - 9, mm));
```

### 3.3 override 머지

```ts
function mergeOverrideIntoHours(base, ovr): BusinessHoursInput {
  if (ovr.kind === 'closed') {
    return { ...base, forcedClosure: { label: `${ovr.reason} (임시 휴무)`, reason: ovr.reason } };
  }
  // short_hours / custom — 시간 필드 override가 있으면 우선
  return {
    ...base,
    weekdayOpen: ovr.weekdayOpen ?? base.weekdayOpen,
    weekdayClose: ovr.weekdayClose ?? base.weekdayClose,
    lunchStart: ovr.lunchStart ?? base.lunchStart,
    lunchEnd: ovr.lunchEnd ?? base.lunchEnd,
    intakeDeadline: ovr.intakeDeadline ?? base.intakeDeadline,
  };
}
```

### 3.4 다음 운영일 찾기 (`findNextOpenDate`)

내일부터 30일 lookahead, 주말·공휴일 자동 건너뜀. recurring=true 공휴일은 월/일만 매칭.

---

## 4. 서비스 함수 카탈로그

### 4.1 default 관련

```ts
getBusinessHoursDefault(): Promise<BusinessHoursDefault | null>
upsertBusinessHoursDefault(input, userId): Promise<{ ok, message? }>  // 단일 행 UPSERT + audit
```

### 4.2 holidays 관련

```ts
listBusinessHolidays({ year?, includeInactive? }): Promise<BusinessHoliday[]>
createBusinessHoliday(input, userId): Promise<{ ok, id?, message? }>     // unique 위반 → DUPLICATE_DATE
deactivateBusinessHoliday(id, userId): Promise<{ ok, message? }>          // soft delete
replicateRecurringHolidaysForYear(year, userId): Promise<{ created, skipped }>  // P3-S
```

### 4.3 overrides 관련

```ts
listBusinessHoursOverrides({ status?, includeInactive?, limit? }): Promise<BusinessHoursOverride[]>
getActiveOverrideForDate(isoDate): Promise<BusinessHoursOverride | null>
hasOverrideCollision(from, until, exceptId?): Promise<boolean>
createBusinessHoursOverride(input, userId): Promise<{ ok, id?, message? }>  // 충돌 검증 → PERIOD_COLLISION
cancelBusinessHoursOverride(id, userId): Promise<{ ok, message? }>          // scheduled만
shortenActiveOverride(id, newUntil, userId): Promise<{ ok, message?, nowExpired? }>  // P3-T
applyScheduledOverrides(today): Promise<{ applied }>                        // cron
expireFinishedOverrides(today): Promise<{ expired }>                        // cron
notifyUpcomingOverrides(today): Promise<{ notified }>                       // cron + slack 'new'
```

### 4.4 이력 + 통합 상태

```ts
listBusinessHoursActivityLogs({ limit?, offset? }): Promise<BusinessHoursActivityLogRow[]>
  // users LEFT JOIN — userName 포함 (P3-V)

getCurrentBusinessStatus(now?): Promise<BusinessStatusResult | null>
  // default + holidays + active override 머지 → calculate 호출
```

---

## 5. API 설계

### 5.1 `GET /api/business-hours/context`

**용도**: 호텔리어 클라이언트가 정책 데이터 페치
**캐시**: `unstable_cache` 60초 + `revalidateTag('business-hours')` 무효화
**응답**:
```json
{
  "ok": true,
  "hours": { /* BusinessHoursInput, override 머지 적용된 결과 */ },
  "holidays": [ { "date", "name", "isRecurring" }, ... ],
  "serverNow": "2026-05-30T05:30:00.000Z"
}
```

> **참고**: `hours.forcedClosure`가 채워져 있으면 active override (kind='closed')가 적용 중이라는 의미. 별도 `activeOverride` 필드는 노출하지 않음 (호텔리어 UI는 `status.label`로 충분히 표시 — 임시휴무 사유가 forcedClosure.label에 반영됨).

**에러**: `{ ok: false, message: 'BUSINESS_HOURS_NOT_CONFIGURED' }` → 503

### 5.2 `GET /api/cron/business-hours-overrides`

**용도**: Vercel Cron 매일 KST 00:01 (UTC 15:01)
**인증**: `Authorization: Bearer ${CRON_SECRET}`
**동작**:
```ts
Promise.all([
  applyScheduledOverrides(today),     // scheduled → active
  expireFinishedOverrides(today),     // active → expired
  notifyUpcomingOverrides(today),     // today+1 scheduled → slack 'new'
])
```
**응답**: `{ ok, today, applied, expired, reminded }`

---

## 6. Server Actions

| 함수 | 입력 (FormData) | 권한 | 캐시 무효화 |
|:-|:-|:-:|:-|
| `updateBusinessHoursDefaultAction` | 시간 5 + 휴무 3 + 긴급 2 + 연락처 5 = 15 필드 | admin | `business-hours` + path |
| `createBusinessHolidayAction` | date, name, isRecurring | admin | 동일 |
| `deactivateBusinessHolidayAction` | id | admin | 동일 |
| `replicateRecurringHolidaysAction` | targetYear | admin | 동일 |
| `createBusinessHoursOverrideAction` | kind, from, until, time 5, reason | admin | 동일 |
| `cancelBusinessHoursOverrideAction` | id | admin | 동일 |
| `shortenActiveOverrideAction` | id, newEffectiveUntil | admin | 동일 |

**zod cross-field 검증**
- `weekdayClose > weekdayOpen`
- 점심 시작·종료 함께 있거나 함께 없음
- `lunchEnd > lunchStart`
- `intakeDeadline <= weekdayClose`
- override: `effectiveUntil >= effectiveFrom`
- override short_hours/custom: 시간 필드 최소 1개 입력
- ARS items: 최대 10건, num/label 비어있지 않음

---

## 7. UI 설계

### 7.1 어드민 메인 페이지 (탭 라우팅)

```tsx
// app/(admin)/admin/master/business-hours/page.tsx
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole(['admin']);
  const sp = await searchParams;
  const tab = VALID_TABS.includes(sp.tab) ? sp.tab : 'hours';

  // 카운트만 항상 (가벼움), 본문은 활성 탭만 페치
  const [status, holidaysCount, overridesCount] = await Promise.all([...]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader ... />
      <StatusPreview status={status} />
      <BusinessHoursTabBar active={tab} counts={{ overrides, holidays }} />
      {tab === 'hours' && <HoursTab />}
      {tab === 'overrides' && <OverridesTab />}
      {tab === 'holidays' && <HolidaysTab />}
      {tab === 'history' && <HistoryTab />}
    </div>
  );
}
```

### 7.2 탭 ① 운영시간 폼 구조

```
[평일 운영] 시작 [10:00] / 종료 [18:40]
[점심]     시작 [12:00] / 종료 [13:00]
[접수 마감] [18:00]

[휴무 정책 fieldset]
  ☑ 토요일 휴무
  ☑ 일요일 휴무
  ☑ 공휴일 자동 휴무

[운영시간 외 긴급전화 fieldset]
  번호 [070-8028-0919]
  안내문구 [단순 금액 정정 불가]

[연락처 정보 fieldset]   ← P3-W 신규
  대표전화 [1833-4702]    대표 이메일 [as@oapms.com]
  Fax     [0505-300-4702] 웹사이트  [www.oapms.com]
  ARS 메뉴:
    [1] [시스템 사용 문의] [X]
    [2] [도입 상담]       [X]
    [3] [경영·회계 기타]   [X]
    [+ 항목 추가] (최대 10건)

                                              [저장]
```

ARS는 state(`useState<ArsItem[]>`)로 관리하고 hidden input에 `JSON.stringify(arsItems)` 직렬화해서 FormData로 전달.

### 7.3 탭 ② 예약 변경 구조

```
[CalendarClock 아이콘] 예약 변경 (N건)
                          [+ 신규 예약]

[진행 중 그룹]
  ─ 2026-02-16~18 [진행 중] [단축운영] 운영 10:00~14:00 · 접수12:00
    설 연휴 단축운영
    [종료일 단축]
  ─ ...

[예약됨 그룹]
  ─ 2026-05-15~17 [예약됨] [임시휴무]
    사옥 점검
    [취소]
  ─ ...

[만료 그룹]   (muted, 흐림)
[취소 그룹]   (muted, 흐림)
```

**신규 예약 폼** (인라인 펼침):
- 유형 Select: 단축운영/임시휴무/자유설정
- 시작일/종료일 date input
- 시간 5필드 (kind='closed'면 숨김)
- 사유 textarea (필수)

### 7.4 탭 ③ 공휴일 구조

```
[CalendarOff 아이콘] 공휴일 (19건)
                       [2027년 자동 등록] [+ 신규 추가]

[인라인 추가 폼]
  날짜 [date] 이름 [text] ☐ 매년 반복  [추가]

[리스트]
  2026-01-01 (목) 신정          [매년 반복] [🗑]
  2026-02-16 (월) 설날 연휴            [🗑]
  ...
```

### 7.5 탭 ④ 변경 이력 구조

```
[History 아이콘] 변경 이력 (최근 N건)

▣ 운영시간 수정 [default.update] 2026-05-30 14:30  by 김매니저
  운영 종료: 18:40 → 19:00 · 점심 시작: 12:00 → 12:30
▣ 예약 자동 적용 [override.applied] [시스템] 2026-05-30 00:01
  cron 자동 처리 (2026-05-30)
▣ 공휴일 추가 [holiday.create] 2026-05-29 11:20  by 박어드민
  2026-12-31 종무일
...
```

### 7.6 호텔리어 — BusinessStatusBadge

```tsx
// size='sm' (헤더용)
<Link href="/help">
  <Dot tone="open" />
  운영 중
</Link>

// size='md' (사이드바·푸터용)
<Link href="#hours" className="...border...">
  <Dot tone="open" />
  운영 중
  <span>접수 마감 2h 20m</span>
</Link>
```

### 7.7 호텔리어 — ContactPanel variant=sidebar

```
┌─ sticky top-20 ────────────────────┐
│ 🟢 운영 중 · 접수 마감 2h 20m       │
├────────────────────────────────────┤
│ 💬 챗봇으로 바로 물어보기 (옵션)    │
│ 📅 이슈 접수하기                    │
├────────────────────────────────────┤
│ 📞 1833-4702                        │
│    1️⃣ 시스템 사용 문의              │
│    2️⃣ 도입 상담                     │
│    3️⃣ 경영·회계 기타                │
│ ✉️ as@oapms.com                     │
├────────────────────────────────────┤
│ ⚠️ 운영시간 외 긴급                 │
│    070-8028-0919                    │
│    단순 금액 정정 불가              │
└────────────────────────────────────┘
```

운영 외 시간엔 긴급전화 박스 amber 강조.

### 7.8 호텔리어 — ContactPanel variant=footer

```
[가로 4열 grid]
[운영 상태] [대표전화 + ARS] [이메일·긴급] [빠른 해결]

[하단 가로선 + 동적 안내문]
평일 10:00–18:40 · 점심 12:00–13:00 · 토·일·공휴일 휴무 · Fax 0505-300-4702 · www.oapms.com
```

운영시간 안내문은 `summarizeOperationLine(hours)` 함수로 동적 생성.

---

## 8. 권한 정책

| 영역 | 권한 |
|:-|:-:|
| `/admin/master/business-hours` 모든 탭 | admin |
| 모든 Server Action | admin (`requireRole(['admin'])`) |
| `GET /api/business-hours/context` | 공개 (인증 불필요 — 운영시간은 공개 정보) |
| `GET /api/cron/business-hours-overrides` | Bearer `${CRON_SECRET}` |
| 호텔리어 4곳 (배지·sidebar·footer) | 비로그인 포함 모두 (어드민 영역 제외) |

---

## 9. 캐시 전략

| 레이어 | 키 | TTL | 무효화 트리거 |
|:-|:-|:-:|:-|
| `/api/business-hours/context` | `business-hours-context` | 60s | `revalidateTag('business-hours')` |
| 호텔리어 클라이언트 | 메모리 | 5분 | 자동 refetch |
| 호텔리어 status 계산 | 메모리 | 1분 | 자동 tick |

모든 mutate Server Action + cron 활성화/만료 시 `revalidateTag('business-hours', 'default')` 호출 → 다음 호출에서 새 데이터.

> **참고 (Next 15 API)**: `revalidateTag(tag: string, profile?: string)` 의 두 번째 인자는 cache profile 식별자(Next 15 신규). 단일 호출이며, `'default'` profile에 묶인 모든 캐시 엔트리를 무효화한다.

---

## 10. Audit Log 정책 (action 11종)

| action | 트리거 | userId | payload 핵심 |
|:-|:-|:-:|:-|
| `business_hours.default.update` | 운영시간 수정 | 사용자 | before/after diff |
| `business_hours.default.create` | 운영시간 첫 등록 | 사용자 | after |
| `business_hours.holiday.create` | 공휴일 추가 | 사용자 | date, name, isRecurring |
| `business_hours.holiday.delete` | 공휴일 소프트 삭제 | 사용자 | date, name |
| `business_hours.holiday.replicate` | 양력 일괄 복제 | 사용자 | targetYear, created, skipped |
| `business_hours.override.create` | 예약 등록 | 사용자 | kind, period, reason |
| `business_hours.override.cancel` | 예약 취소 (scheduled만) | 사용자 | kind, period, reason |
| `business_hours.override.shorten` | active 종료일 단축 | 사용자 | previousUntil, newUntil, nowExpired |
| `business_hours.override.applied` | cron 자동 활성화 | null | trigger=cron, today |
| `business_hours.override.expired` | cron 자동 만료 | null | trigger=cron, today |
| `business_hours.override.reminder_sent` | cron 24h 사전 알림 | null | tomorrow, slackOk, stub |

이력 탭은 `WHERE action LIKE 'business_hours.%'`로 필터링, users LEFT JOIN으로 userName 노출.

---

## 11. Cron 동작

### 11.1 스케줄

`vercel.json`:
```json
{ "path": "/api/cron/business-hours-overrides", "schedule": "1 15 * * *" }
```
UTC 15:01 = KST 00:01.

### 11.2 처리 흐름

```
1. KST today 추출: now.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10)

2. Promise.all([
     applyScheduledOverrides(today),
       // WHERE status='scheduled' AND effective_from <= today
       // → UPDATE status='active', applied_at=now()
       // → activity_logs('business_hours.override.applied', trigger=cron)

     expireFinishedOverrides(today),
       // WHERE status='active' AND effective_until < today
       // → UPDATE status='expired'
       // → activity_logs('business_hours.override.expired', trigger=cron)

     notifyUpcomingOverrides(today),
       // WHERE status='scheduled' AND effective_from = today+1
       // → sendSlack({ channel:'new', blocks:[...] })
       // → activity_logs('business_hours.override.reminder_sent', trigger=cron)
   ])

3. if (applied > 0 || expired > 0) revalidateTag('business-hours')

4. 응답: { ok, today, applied, expired, reminded }
```

### 11.3 멱등성

- `applied`: 이미 `status='active'`인 행은 WHERE에서 제외 → 재실행 안전
- `expired`: 동일 (이미 `expired`면 제외)
- `reminded`: `effective_from = today+1` 정확 매칭 → 매일 1회만 자연 idempotent (같은 override 두 번 알림 X)

---

## 12. 시드 데이터

### 12.1 `business_hours_default` 1행

```ts
{
  weekdayOpen: '10:00', weekdayClose: '18:40',
  lunchStart: '12:00', lunchEnd: '13:00',
  intakeDeadline: '18:00',
  saturdayClosed: true, sundayClosed: true, holidaysClosed: true,
  emergencyPhone: '070-8028-0919',
  emergencyNote: '운영시간 외 긴급전화 (단순 금액 정정 불가)',
  timezone: 'Asia/Seoul',
  // P3-W
  mainPhone: '1833-4702',
  mainEmail: 'as@oapms.com',
  arsItems: [
    { num: '1', label: '시스템 사용 문의' },
    { num: '2', label: '도입 상담' },
    { num: '3', label: '경영·회계 기타' },
  ],
  faxNumber: '0505-300-4702',
  websiteUrl: 'www.oapms.com',
}
```

기존 행이 있으면 NULL 컬럼만 backfill (재실행 안전).

### 12.2 `business_holidays` 2026년 19종

- **양력 8 (is_recurring=true)**: 1/1 신정, 3/1 삼일절, 5/5 어린이날, 6/6 현충일, 8/15 광복절, 10/3 개천절, 10/9 한글날, 12/25 성탄절
- **음력 7 (2026 한정)**: 2/16~18 설날 연휴, 5/24 부처님오신날, 9/24~26 추석 연휴
- **대체공휴일 4 (2026 한정)**: 3/2 삼일절 대체, 5/25 부처님오신날 대체, 8/17 광복절 대체, 10/5 개천절 대체

같은 날짜 활성 행 있으면 skip (idempotent).

---

## 13. 마이그레이션 절차

### 13.1 정상 흐름

```bash
npx drizzle-kit generate       # 0012, 0013 생성
npx drizzle-kit migrate        # 적용
npm run db:seed                # 시드 + 공휴일
```

### 13.2 P3-W 특이 케이스 (다른 세션과 동시 진행)

drizzle-kit이 다른 세션의 ALTER/DROP을 끼워넣는 위험 발생 → raw SQL로 안전 우회:

```bash
npx tsx db/scripts/add-contact-columns.ts          # 5컬럼 IF NOT EXISTS
npx tsx db/scripts/cleanup-duplicate-settings.ts   # system_settings 잔여 키 삭제
npm run db:seed                                    # 연락처 backfill
```

---

## 14. 테스트 시나리오

### 14.1 어드민 (수동)

| # | 시나리오 | 기대 결과 |
|:-:|:-|:-|
| 1 | 운영시간 평일 종료 18:40 → 19:00 변경 후 저장 | toast 성공, StatusPreview 즉시 갱신, 헤더 배지 다음 fetch에 반영 |
| 2 | 점심 시작만 입력하고 종료 비움 | zod 에러 "점심 시작·종료는 모두 입력하거나 모두 비워야 합니다" |
| 3 | 공휴일 추가 — 2026-12-31 종무일 | 리스트에 즉시 노출, 활동 로그에 기록 |
| 4 | 같은 날짜 공휴일 중복 추가 | DUPLICATE_DATE → "이미 등록된 날짜" 에러 |
| 5 | 예약 변경 등록 (2026-06-15~17 임시휴무) | 충돌 없으면 status='scheduled' INSERT |
| 6 | 같은 기간 두 번째 예약 | PERIOD_COLLISION → "기간 충돌" 에러 |
| 7 | scheduled override 취소 | status='canceled', is_active=false |
| 8 | active override "종료일 단축" → 오늘 날짜로 | nowExpired=true, 즉시 status='expired' |
| 9 | 양력 공휴일 "2027년 자동 등록" | 8건 INSERT (음력·대체는 제외) |
| 10 | ARS 항목 [+ 항목 추가] 11번째 | 버튼 disabled (최대 10건) |
| 11 | 변경 이력 탭 | userName 노출, cron 액션은 "시스템" 뱃지 |

### 14.2 호텔리어 (수동)

| # | 시나리오 | 기대 결과 |
|:-:|:-|:-|
| 1 | 평일 14:00 홈 진입 | 헤더 배지 "🟢 운영 중", footer 운영시간 안내문 노출 |
| 2 | 평일 12:30 / | /help 진입 | 사이드바 ContactPanel "🟡 점심시간 · 13:00 재개" |
| 3 | 평일 18:30 (접수마감 18:00 이후) | "🟠 접수 마감 (운영 중) · 당일 접수 마감" |
| 4 | 평일 19:00 (종료 후) | "🔴 운영 종료 · 다음 5/31 (월) 10:00" |
| 5 | 토요일 14:00 | "🔴 토요일 휴무" |
| 6 | 공휴일 (5/5 어린이날) | "🔴 어린이날 휴무" |
| 7 | active override 임시휴무 적용일 | "🔴 {reason} (임시 휴무)" |
| 8 | 어드민이 대표전화 변경 후 5분 내 | ContactPanel에 새 전화번호 자동 반영 |

### 14.3 Cron (수동 호출)

```bash
curl -H "Authorization: Bearer ${CRON_SECRET}" \
  http://localhost:3000/api/cron/business-hours-overrides
# 기대: { ok: true, today: "...", applied: N, expired: M, reminded: K }
```

---

## 15. 에지 케이스

| 케이스 | 처리 |
|:-|:-|
| `business_hours_default`에 행이 없음 | `getCurrentBusinessStatus` → null, API → 503 "BUSINESS_HOURS_NOT_CONFIGURED", ContactPanel sidebar는 fallback 안내, 헤더 배지·footer는 숨김 |
| 같은 날짜에 2개 active override (충돌 검증 우회) | `getActiveOverrideForDate`가 `createdAt DESC LIMIT 1`로 최신만 |
| Cron이 실패 (네트워크 등) | 다음 cron에서 재시도 (idempotent), 활성화 안 된 override는 다음날도 매칭됨 |
| Slack webhook 미설정 | `sendSlack` stub 처리, audit log에 `stub: true` 기록 |
| 어드민이 운영시간 수정 직후 호텔리어가 새로고침 | `revalidateTag` 트리거됨 → 다음 fetch에서 새 값 |
| 정책 변경 중 cron 실행 동시 발생 | 각자 다른 행 대상 → race condition 없음 |
| timezone이 'Asia/Seoul' 외 값 | `combineLocalDateTime` 일반 UTC 취급 (정밀도 ↓ — 정책상 KST 단일이라 무시) |
| `business_hours_default`에 동시 INSERT 두 번 (단일 행 강제가 service만) | 두 번째 호출이 UPDATE 분기로 가도록 service가 매번 `getBusinessHoursDefault()` 선체크 → race 발생해도 2번째는 1번째 결과 위에 UPDATE. 데이터 손상 X, 단 `updated_by` 누가 이긴지 결정됨 (last-write-wins). 운영상 단일 어드민 동시 편집은 극히 드물어 수용. |

---

## 16. 의존성 다이어그램

```
[business_hours_default]──┐
                          ├──► getCurrentBusinessStatus ──► calculateBusinessStatus ──► BusinessStatusResult
[business_holidays]───────┤                                                                  │
                          │                                                                  ├──► StatusPreview (어드민)
[business_hours_overrides]┘                                                                  ├──► BusinessStatusBadge (헤더)
                                                                                             ├──► ContactPanel sidebar
                                                                                             └──► ContactPanel footer

[activity_logs] ────► listBusinessHoursActivityLogs ──► HistorySection (어드민 탭 ④)

[Vercel Cron] ──► /api/cron/business-hours-overrides ──► applyScheduled / expireFinished / notifyUpcoming
                                                          │                  │                │
                                                          └──► activity_logs ┘                └──► sendSlack('new')
```

---

## 17. 완료 기준 (Done Definition)

- ✅ Plan G1~G7 모두 달성
- ✅ 11종 audit log action 정상 기록
- ✅ 2026 공휴일 19종 시드
- ✅ system_settings에 운영시간/연락처 잔여 키 0건
- ✅ typecheck 통과 (운영시간/컨택 관련 0 에러)
- ✅ 어드민 폼 11개 시나리오 통과 (§14.1)
- ✅ 호텔리어 8개 시나리오 통과 (§14.2)
- ✅ cron 수동 호출 정상 응답 (§14.3)
