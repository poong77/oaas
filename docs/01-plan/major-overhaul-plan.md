# 대규모 개선 작업 계획서 (major-overhaul)

> 브랜치: `improve/major-overhaul` (main 분기, base 2511d5f)
> 작성일: 2026-06-08
> 원칙: 문서 먼저 → 코드 → 빌드 → 보고 → 다음 Phase 승인

11개 대분류 / 40+ 세부 항목을 **위험도·의존성** 기준으로 7개 Phase로 재편성했다.

---

## Phase 구성 요약

| Phase | 주제 | 위험도 | 원래 항목 |
|-------|------|--------|-----------|
| **P1** | 명칭/용어 정리 + 로그인 비번 토글 | 낮음 | 3, 5, 9 |
| **P2** | 접근제어 버그 수정 | 낮음 | 10 |
| **P3** | 어드민 티켓 관리 화면 개선 | 중간 | 4, 8 |
| **P4** | 호텔리어 문의현황 + 답변 보완 | 중간 | 2, 7 |
| **P5** | 마스터 제품 분류 세분화 (계층화) | 높음 | 1 |
| **P6** | 호텔리어 접수화면 대수술 (3→1단계) | 높음 | 6 |
| **P7** | 메일/문자 발송 (툴 박스 신규 메뉴) | 높음 | 11 |

순서 근거: 저위험·독립 항목(P1·P2) 먼저로 빠른 효과 → 어드민/호텔리어 화면 개선(P3·P4) → 데이터 모델 변경(P5)은 P6 접수화면이 의존하므로 선행 → 접수화면 대수술(P6) → 신규 기능(P7).

---

## Phase 1 — 명칭/용어 정리 + 로그인 (항목 3, 5, 9)

### 1-1. 메뉴 명칭 변경 (항목 3)
- `티켓 큐` → `문의 관리` (사이트 전반, 가이드 포함)
- `마스터 데이터` → `마스터DB`
- `공지 관리` → `공지`
- **주 파일**: `app/(admin)/admin/_data/nav-items.ts` (L55, L70, L114)
- **산재 위치** (grep 결과 반영): tickets/page.tsx, kanban, [id], new-by-phone, list-kanban-toggle, role-scope.tsx, auth-landing.ts, user-nav.tsx, master/*/page.tsx breadcrumb·metadata, notices/* 등
- **주의**: e2e 스펙(`admin-sidebar-layout.spec.ts` 등)에 라벨 하드코딩 → 동시 수정

### 1-2. 접수 용어 변경 (항목 5)
- `대리접수` → `티켓 생성` (강조색)
- `직접접수` → `호텔리어 접수` (무채색)
- **주 파일**: `app/(admin)/admin/tickets/page.tsx` (L127, L133), `kanban/page.tsx` (L87), `new-by-phone/page.tsx` (L54 제목)

### 1-3. 로그인 비밀번호 표시 토글 (항목 9)
- 눈알 버튼(show/hide) 추가
- **주 파일**: `app/(auth)/login/login-form.tsx` (L117-131)
- `useState` showPassword + Eye/EyeOff(lucide) 버튼

---

## Phase 2 — 접근제어 버그 (항목 10)

### 2-1. 마스터 메뉴 매니저 접근 허용 안 됨
- 증상: menu-access에서 매니저 허용 설정해도 매니저가 접근 못 함
- **조사 지점**:
  - `lib/services/master-menu-access.ts` (canAccessMasterMenu, getManagerAccessMap)
  - `lib/services/master-meta.ts` (MASTER_MENUS, hardAdminOnly 플래그)
  - 각 `master/*/layout.tsx` 의 `requireMasterMenuAccess()` 호출
- **가설**: ① 오버라이드 저장/읽기 키 불일치, ② hardAdminOnly 판정 오류, ③ requireMasterMenuAccess가 manager를 notFound 처리하는 로직 결함 중 하나. 실제 재현 후 원인 확정.

---

## Phase 3 — 어드민 티켓 관리 화면 (항목 4, 8)

### 3-1. 상태 카드 바로가기 + 탭 삭제 (항목 4)
- 상태 카드(미처리/처리중/보류/완료/전체) 클릭 → 해당 상태 목록으로 이동
- 상태 필터 탭 삭제 (카드와 중복)
- **주 파일**: `_components/tickets-summary-cards.tsx` (현재 4카드, 링크 없음 → 카드 항목 재정의 + `?status=` 링크), `_components/tickets-filters.tsx` (STATUS_TABS 제거)

### 3-2. 어드민 접수/상세 화면 개선 (항목 8)
1. **보류 상태 삭제** — ⚠️ 결정 필요: 시스템 전체에서 제거 vs 특정 화면만 숨김. enum(on_hold)·kanban·필터·hotelier 목록 영향. → 사용자 확인 후 진행
2. **담당/마감일 동선 최적화** — `[id]/_components/admin-ticket-actions.tsx` (L306-359): 미배정 드롭다운 옆 '내가 담당', 일시선택바 옆 '지금 마감' 위치 이동
3. **우상단 숙소 인포에 솔루션 표시 + URL 바로가기** — `[id]/page.tsx` (L268-313). `solution-links` 마스터 + 호텔 사용 솔루션 매핑 활용. 로그인/비번은 호텔 마스터 암호화 PW 연동 (최소 공간, 아웃링크)
4. **에디터 이미지 ctrl+v 붙여넣기** — `components/editor/rich-editor.tsx` paste 핸들러 신규 구현 (S3 업로드 연동). 공개답변·내부메모 양쪽 적용
5. **제품/타입/긴급도 값 입력·수정** — 현재 생성 후 변경 불가 → 상세 화면에서 수정 UI 추가 (마스터 categories 연동)

---

## Phase 4 — 호텔리어 문의현황 + 답변 보완 (항목 2, 7)

### 4-1. 추가답변 → "답변 보완" 개편 (항목 2, 7-1)
- 문구: `추가답변` → `답변 보완`
- 조건: **접수(received) 단계에서만** 가능 (현재 completed 외 전부 허용 → received로 제한)
- 로그 남김 (status_change 또는 별도 metadata)
- **어드민에 '답변 보완' 알림 생성** (슬랙/in-app)
- **주 파일**: `app/tickets/[id]/_components/reply-form.tsx`, `app/actions/ticket-actions.ts` (addPublicMessageAction), `lib/services/tickets.ts` (addMessage)

### 4-2. 접수 취소 버튼 (항목 7)
- 접수 단계 문의에 `답변 보완` + `접수 취소` 버튼 추가
- 접수 취소 = 완료 처리 + 로그
- **주 파일**: reply-form.tsx / 신규 액션 cancelTicketAction

---

## Phase 5 — 마스터 제품 분류 세분화 (항목 1) ⚠️ 데이터 모델 변경

### 5-1. 대/중/소분류 계층 구조 도입
- 현재: `categories` 단일 레벨 (product 6개 평면)
- 목표: 대분류 → 중분류 → 소분류 3계층 (아래 표)
- **설계 결정 필요**: ① 기존 categories에 `parent_id` + `level` 추가 vs ② 신규 `product_taxonomy` 테이블. 기존 티켓의 productCode 마이그레이션 매핑 필요
- 어드민 categories 화면 트리 편집 UI 개편
- 접수폼 제품 선택 = 계단식(cascading) 드롭다운

**목표 분류표:**
| 대분류 | 중분류 | 소분류 |
|--------|--------|--------|
| PMS | PMS / WebPOS / Housekeeper | (PMS: ver·설치형·웹) |
| 홈페이지 | 홈페이지 / 부킹엔진 | |
| CMS | HG CMS / TLL CMS / OA CMS | |
| Keyless | 도어락 / 모바일키 / Keyless / 릴레이보드 | 도어락(빌드원·하이원·모듈ver), 모바일키(와이파이·블루투스·ver), 릴레이보드(4구·1구) |
| Kiosk | 키오스크 | V1·V2 |
| 기타 | 일반 / 메시지 / 알림톡 / Hotel TV / 주차연동 / RMS연동 / PG·VAN | PG·VAN(Payment API) |
- 기타>일반 = 문의 디폴트값

---

## Phase 6 — 호텔리어 접수화면 대수술 (항목 6) ⚠️ P5 의존

### 6-1. 접수화면 개편
1. 제품·요청타입 = 옵션값, 디폴트 `미정`
2. 문의유형별 템플릿 상세화 (계정생성/삭제, 매출수정, 오버부킹)
   - `자세한 내용` 제목 옆 템플릿 버튼 (미니멀 CTA)
   - 마스터 메뉴에서 템플릿 관리 (매니저/어드민) — `quick-reply-templates` 또는 신규 `ticket-templates`
3. **3단계 → 1단계 (1페이지)** — `ticket-create-form.tsx` 전면 재구성
4. 긴급도 삭제
5. 연락방법 = 이메일 디폴트
6. 접수 요약 삭제
7. **AI로 분류명 자동 입력** — `lib/ai` Claude 래퍼로 제목·내용 → 제품/유형 추론

---

## Phase 7 — 메일/문자 발송 (항목 11) ⚠️ 신규 기능

### 7-1. 툴 박스 신규 메뉴
- 사이드바 `인사이트` 그룹 → `툴 박스` 로 명칭 변경
- 신규 메뉴 `메문 발송`, 검색로그 아래 위치 (`nav-items.ts` insight 그룹)
- 탭 2개: 메일 발송 / 문자 발송

### 7-2. 메일 발송 탭 (AWS SES — 기구현 `notifyEmail`)
- 발신자: `as@oapms.com`
- 호텔/호텔리어 선택 → 이메일 선택 or 수기 입력 (hotels.extra_emails, users.email 활용)
- 제목·본문 (기존 RichEditor)
- `AI 작성` 버튼 (본문 최적화, Claude 래퍼)
- 발송 주의사항 표시

### 7-3. 문자 발송 탭 (Solapi — 기구현 `notifySms`)
- 발신번호: (확인 필요)
- 호텔/호텔리어 선택 → 전화번호 선택 or 수기 입력
- 제목·본문 (문자 전용 에디터: 글자수·SMS/LMS 표시·비용표시)
- 발송 주의사항 표시

### 7-4. 공통
- 발송 로그(`notification-logs`) — 사유·티켓연결(옵션) 컬럼 활용 (related_ticket_id 존재)
- 연락처 다중 선택 UI 신규 구현

---

## 결정 사항 (2026-06-08 확정)

- **P3-1 보류 상태**: ✅ 시스템 전체에서 제거 (enum `on_hold`·kanban·필터·hotelier 목록·상태흐름 모두). 기존 on_hold 티켓은 마이그레이션 시 `in_progress`로 이전
- **P5 제품 분류**: ✅ 기존 `categories` 테이블 확장 — `parent_id`(self FK) + `memo`(text) 컬럼 추가. 기존 티켓 productCode는 매핑표로 이전
- **P6 템플릿**: ✅ 기존 `quick-reply-templates` 재사용
- **P7 메뉴명**: ✅ `메일&문자` 확정
- **P7 문자 발신번호**: ⏳ P7 진입 시 확인
