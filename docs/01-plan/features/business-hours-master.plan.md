# business-hours-master — Plan

> **Feature**: 운영시간 + 공휴일 + 예약 변경 + 연락처 통합 마스터
> **Phase**: Plan (PDCA) — **사후 작성** (구현 완료 후 문서 정합성 확보)
> **작성일**: 2026-05-30
> **선행 결정**: 단일 테이블 분할(default/overrides/holidays) / 연락처는 default와 응집 / activity_logs 재사용
> **상태**: ✅ APPROVED — Design 참조용

---

## 1. 배경 (Why)

### 1.1 발견된 문제

- **호텔리어가 "지금 운영 중인가" 알기 어려움**: 모든 페이지에서 운영 상태 안내 없음 → 새벽 인시던트 시 전화 폭주 또는 응대 지연
- **연락처(대표전화·이메일·ARS·Fax·웹)가 코드 하드코딩**: ContactPanel 컴포넌트 내 상수 → 어드민이 운영 중 변경 불가능
- **`system_settings.business_hours` / `contact_phone` 키가 시드되지만 어디서도 안 읽음**: 유령 데이터 + 잘못된 값(`09:00~19:00`, `02-1234-5678`)이 DB에 적재
- **운영시간 정책의 일시적 변경(설/추석 단축, 사옥 점검 임시휴무) 처리 방법 없음**: 매니저가 매번 수동 공지
- **CLAUDE.md 8번 원칙 미준수**: "어드민 DB 편집 우선 설계" — 운영시간·연락처 모두 마스터 데이터인데 어드민에서 편집 불가

### 1.2 핵심 통찰

운영시간·점심·접수마감·휴무·긴급전화·대표전화·이메일·ARS·Fax·웹사이트는 **모두 "오아테크와 어떻게 연락하나"라는 단일 도메인 정보**다. 분리된 곳(system_settings, 하드코딩, 별도 테이블 후보)에 흩어지면 정합성 깨짐. **한 테이블로 통합**하고 어드민이 **한 화면에서 통째로 편집**하게 한다.

---

## 2. Goals (G1~G7)

| ID | Goal | 측정 기준 |
|:-:|:-|:-|
| **G1** | 운영시간 정책 단일 테이블 — 어드민 1행 편집 | `business_hours_default` 1행, `/admin/master/business-hours` 탭 ① 편집 동작 |
| **G2** | 공휴일 별도 관리 (양력 매년 반복 + 음력 매년 등록) | `business_holidays` + UI 탭 ③ + 2026 시드 19종 |
| **G3** | 일시적 운영시간 변경 예약 가능 (단축운영/임시휴무/자유설정) | `business_hours_overrides` + cron 자동 활성화/만료 |
| **G4** | 변경 이력 완전 추적 (사람 + 시각 + 전후 값) | `activity_logs` action 8종 + 탭 ④ 타임라인 + user JOIN |
| **G5** | 연락처(대표전화·이메일·ARS·Fax·웹) 어드민 편집 | `business_hours_default` 컬럼 5개 + 폼 입력 |
| **G6** | 호텔리어 실시간 운영상태 노출 (1분 단위) | 헤더 sm 배지 + 사이드바 ContactPanel + 푸터 ContactPanel |
| **G7** | 동일 정책 소스 — 어드민 미리보기와 호텔리어 표시 결과가 정확히 일치 | 같은 `calculateBusinessStatus` 순수 함수 양쪽 호출 |

---

## 3. Non-Goals (이번 Phase에서 안 함)

- 호텔별·지역별 다른 운영시간 — 오아테크 단일 본사 운영, 멀티테넌시 제외
- 요일별 다른 운영시간 (월~금 각각) — 현재 평일 단일, 단축운영은 override로 처리
- active override 임의 시간 단축 (전체 시간 재정의) — 종료일 단축만 P3, 시간 변경은 cancel + 재예약
- 운영시간 변경 사용자 알림 (호텔리어에게 SMS/이메일) — 패널 표시로 충분
- 다국어 (영문 ARS 메뉴 등) — 한국어 단일 운영

---

## 4. Scope — 작업 항목 (P1/P2/P3)

### 4.1 P1 (선행 — 호텔리어 컨택 패널 의존)

| ID | 항목 | 영향 파일 |
|:-:|:-|:-|
| **P1-A** | `business_hours_default` 스키마 (단일 행) | `db/schema/business-hours-default.ts` 신규 |
| **P1-B** | `business_holidays` 스키마 + 부분 unique index | `db/schema/business-holidays.ts` 신규 |
| **P1-C** | 도메인 순수 함수 `calculateBusinessStatus` | `lib/business-hours/calculate.ts` 신규 |
| **P1-D** | 도메인 서비스 (default upsert + holiday CRUD + getCurrentBusinessStatus) | `lib/services/business-hours.ts` 신규 |
| **P1-E** | Server Actions + zod 검증 | `app/actions/master-business-hours-actions.ts` 신규 |
| **P1-F** | 어드민 페이지 `/admin/master/business-hours` 탭 ① ③ | 7개 컴포넌트 (page + tab-bar + status-preview + business-hours-form + holidays-section) |
| **P1-G** | 호텔리어 `useBusinessStatus` 훅 + `/api/business-hours/context` | `lib/hooks/use-business-status.ts`, `app/api/business-hours/context/route.ts` |
| **P1-H** | `BusinessStatusBadge` 헤더 우상단 배지 (sm) | `components/contact/business-status-badge.tsx` + 헤더 통합 |
| **P1-I** | `ContactPanel` (sidebar / footer) | `components/contact/contact-panel.tsx` + RoleScope footer |
| **P1-J** | 시드 — default 1행 + 2026 공휴일 19종 | `db/seed.ts` |

### 4.2 P2 (예약 변경 + 이력)

| ID | 항목 |
|:-:|:-|
| **P2-K** | `business_hours_overrides` 스키마 (kind/status enum + 시간 nullable + 사유) |
| **P2-L** | override CRUD + 충돌 검증 (`hasOverrideCollision`) |
| **P2-M** | `calculate.ts`에 `forcedClosure` 옵션 추가 — kind='closed' 처리 |
| **P2-N** | `getCurrentBusinessStatus`에 override 머지 적용 (`mergeOverrideIntoHours`) |
| **P2-O** | Vercel Cron — 매일 KST 00:01 활성화/만료 (`/api/cron/business-hours-overrides`) |
| **P2-P** | 탭 ② 예약 변경 UI (상태별 그룹 + 신규 폼) |
| **P2-Q** | 탭 ④ 변경 이력 UI (`activity_logs` LIKE 'business_hours.%' 필터 타임라인) |
| **P2-R** | `system_settings.business_hours` 키 제거 메모 (스키마 주석) |

### 4.3 P3 (보강)

| ID | 항목 |
|:-:|:-|
| **P3-S** | 양력 공휴일 일괄 복제 (`replicateRecurringHolidaysForYear`) + 어드민 버튼 |
| **P3-T** | active override 종료일 단축 (`shortenActiveOverride`) — newUntil < today면 즉시 expired |
| **P3-U** | 예약 적용 24시간 전 슬랙 사전 알림 (cron 통합 `notifyUpcomingOverrides`, `new` 채널) |
| **P3-V** | 이력 user.name LEFT JOIN — userId 대신 이름 표시 |
| **P3-W** | **연락처 정보 일원화** — `business_hours_default`에 컬럼 5개 추가(main_phone/main_email/ars_items/fax_number/website_url), ContactPanel 하드코딩 제거, `system_settings` 중복 키 cleanup |

---

## 5. DB 설계 (예비)

### 5.1 `business_hours_default` (단일 행)

```ts
{
  id, ...commonColumns(),
  weekday_open      time NOT NULL,        // '10:00'
  weekday_close     time NOT NULL,        // '18:40'
  lunch_start       time,                 // '12:00'
  lunch_end         time,                 // '13:00'
  intake_deadline   time,                 // '18:00' (운영 종료보다 빠를 수 있음)
  saturday_closed   bool DEFAULT true,
  sunday_closed     bool DEFAULT true,
  holidays_closed   bool DEFAULT true,
  emergency_phone   text,                 // '070-8028-0919'
  emergency_note    text,                 // '단순 금액 정정 불가'
  // P3-W: 연락처 일원화
  main_phone        text,                 // '1833-4702'
  main_email        text,                 // 'as@oapms.com'
  ars_items         jsonb [{num,label}],  // [{num:'1', label:'시스템 사용 문의'}, ...]
  fax_number        text,                 // '0505-300-4702'
  website_url       text,                 // 'www.oapms.com'
  timezone          text DEFAULT 'Asia/Seoul',
  updated_by        uuid → users.id ON DELETE SET NULL,
}
```

### 5.2 `business_holidays`

```ts
{
  id, ...commonColumns(),
  date          date NOT NULL,
  name          text NOT NULL,
  is_recurring  bool DEFAULT false,        // 양력=true (매년 반복)
  created_by    uuid → users.id ON DELETE SET NULL,
}
// 부분 unique index: WHERE is_active = true ON (date)
// 삭제 이력 보존 위해 비활성 행은 중복 허용
```

### 5.3 `business_hours_overrides`

```ts
{
  id, ...commonColumns(),
  kind             enum('short_hours' | 'closed' | 'custom'),
  effective_from   date NOT NULL,
  effective_until  date NOT NULL,
  weekday_open     time,                  // NULL이면 default 사용
  weekday_close    time,
  lunch_start      time,
  lunch_end        time,
  intake_deadline  time,
  reason           text NOT NULL,         // 사유 필수 (이력 추적)
  status           enum('scheduled' | 'active' | 'expired' | 'canceled') DEFAULT 'scheduled',
  applied_at       timestamp,             // cron이 활성화한 시각
  created_by       uuid → users.id ON DELETE SET NULL,
}
```

### 5.4 audit log action 패턴 (총 11종)

- default 2: `business_hours.default.update`, `business_hours.default.create`
- holiday 3: `business_hours.holiday.create`, `business_hours.holiday.delete`, `business_hours.holiday.replicate`
- override 6: `business_hours.override.create`, `business_hours.override.cancel`, `business_hours.override.applied`, `business_hours.override.expired`, `business_hours.override.shorten`, `business_hours.override.reminder_sent`

---

## 6. UX/UI 흐름

### 6.1 어드민 한 화면 (탭 4개)

```
/admin/master/business-hours
  ┌─ PageHeader + Breadcrumb (← 마스터 데이터)
  ├─ StatusPreview (현재 운영상태, 호텔리어와 동일 결과)
  ├─ Tab Bar [현재 운영시간] [예약 변경 N] [공휴일 N] [변경 이력]
  ├─ ?tab=hours      → 운영시간 편집 폼 (시간 + 휴무 + 긴급전화 + 연락처 5필드)
  ├─ ?tab=overrides  → 진행중/예약/만료/취소 그룹 + 신규 예약 폼
  ├─ ?tab=holidays   → 19건 리스트 + 인라인 추가 + 양력 복제 버튼
  └─ ?tab=history    → activity_logs 타임라인 + payload diff
```

### 6.2 호텔리어 4곳 노출

```
헤더 우상단      BusinessStatusBadge size=sm  ("● 운영 중")
도움말 사이드바  ContactPanel variant=sidebar (/help, /faq, /troubleshoot)
티켓 사이드바    ContactPanel variant=sidebar (/tickets/new)
사이트 푸터      ContactPanel variant=footer (전역, 어드민 외)
```

---

## 7. 리스크

| 리스크 | 영향 | 완화책 |
|--------|------|--------|
| Drizzle EXCLUDE 제약 미지원 → override 기간 충돌 DB 차단 불가 | 동시 어드민 편집 시 중복 등록 가능 | service `hasOverrideCollision()` 사전 검증 (단일 어드민 가정 충분) |
| timezone 처리 — 서버는 UTC, 정책은 KST | 시간 비교 오류 | `sv-SE` 로케일 + UTC+9 직접 매핑 (Asia/Seoul 단일) |
| `.next` 빌드 캐시에 다른 세션 흔적 | typecheck 에러 노이즈 | 우리 코드 외 영역 — 빌드 시 자동 갱신 |
| `system_settings.business_hours` / `contact_phone` 잔여 행 | DB에 유령 데이터 | P3-W cleanup 스크립트 실행 (DELETE) |
| Vercel Cron이 미동작하면 scheduled override 활성화 안 됨 | 호텔리어 패널이 옛 상태 노출 | revalidateTag 트리거 + 헬스 체크 시 cron 로그 확인 |

---

## 8. Open Questions (사후 작성이라 해결 완료)

- ❓ 단일 행 강제는 DB 제약? → ✅ service layer 보장 (UI에서 신규 생성 차단)
- ❓ 충돌 방지는 DB EXCLUDE? → ✅ service 사전 검증 (Drizzle 미지원 + 단일 어드민 가정)
- ❓ 이력은 별도 테이블? → ✅ `activity_logs` action 패턴 재사용
- ❓ override 휴무 표현은? → ✅ `BusinessHoursInput.forcedClosure` 옵션 (calculate 시그니처 유지)
- ❓ 연락처는 별도 테이블 vs default 통합? → ✅ default 통합 (응집도 ↑, 한 화면 편집)
- ❓ 탭 라우팅은 세그먼트 vs searchParam? → ✅ `?tab=` searchParam (SSR 친화, 새로고침 시 탭 유지)

---

## 9. Phase 매핑

| Phase | 작업 묶음 | 완료일 |
|-------|----------|--------|
| Phase 1 (선행) | P1-A ~ P1-J (호텔리어 컨택 패널 의존) | 2026-05-29 |
| Phase 9 (P2) | P2-K ~ P2-R (예약 변경 + 이력 + cron) | 2026-05-29 |
| Phase 9 (P3) | P3-S ~ P3-W (보강 + 연락처 일원화) | 2026-05-30 |

**완료 기준 (Done Definition)**
- 어드민이 한 화면에서 운영시간·휴무·연락처·예약을 모두 편집
- 호텔리어 4곳(헤더·사이드바×2·푸터)이 같은 데이터를 1분 단위로 자동 갱신
- 매일 KST 00:01 cron이 예약 활성화/만료/24h 사전 알림 처리
- 모든 변경 액션이 activity_logs에 사용자명 포함 기록
- `system_settings`에 운영시간/연락처 관련 잔여 키 0건
- typecheck 통과 (운영시간·컨택 관련 0 에러)
