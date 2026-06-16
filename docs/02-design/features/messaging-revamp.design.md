# 메일&문자 — MSG-15~20 개편 설계서

- 기능명: messaging-revamp (변수값 입력·템플릿 탭·엑셀 업로드·호텔리어 일괄·발신자명·문자제목)
- 메뉴: 어드민 > 메일&문자 (`/admin/insights/messaging`)
- 역할: manager, admin
- 와이어프레임: `docs/dev-logs/2026-06-16-messaging-wireframe.html`
- 상위 문서: `docs/IMPLEMENTATION_PLAN.md` §5-1 (MSG-15~20), 선행 설계 `messagebox.design.md`
- Plan 도출 보고서: `docs/dev-logs/2026-06-16-messaging-improvements.html`

## 1. 목표

기존 메일/문자 발송 화면(3탭)에 다음 6개 필수 항목을 반영한다.

| ID | 적용 | 항목 |
|:-:|:-:|:-|
| MSG-15 | 공통 | 변수 값 입력 필드(버그수정) — 변수 선택 시 값 패널 노출 |
| MSG-16 | 공통 | 같은 페이지 내 "템플릿" 탭 신설(팝업 모달 에디터) |
| MSG-17 | 공통 | 연락처 엑셀 업로드(업체명·연락처·변수명1~7) |
| MSG-18 | 공통 | 호텔리어 전체 불러오기(이메일/문자) |
| MSG-19 | 문자 | 제목 필수화 + 기본값 `[오아테크]` |
| MSG-20 | 메일 | 발신자명 입력창(기본값 `오아테크`) |
| MSG-21 | 공통 | 발송 미리보기(변수 치환 적용 실물) |
| MSG-22 | 공통 | 테스트 발송(테스트 번호/이메일 1건) |

## 2. 확정 결정사항 (2026-06-16 사용자 승인)

1. **변수 값 UX = 본문 하단 "변수 값" 패널 방식** (수신자표 통합 아님). 본문에 변수 토큰이 존재할 때만 패널 노출.
2. **변수 값 소스 3종**: `연락처 자동주입` / `직접입력`(전 수신자 공통 고정값) / `엑셀열`(MSG-17 매핑). 기본 = 자동주입.
3. **템플릿 편집 = 팝업 모달 에디터** (별도 페이지 아님). 메일/문자 탭의 RichEditor·변수칩 재사용.
4. **탭 4개**: 메일 / 문자 / 템플릿 / 메시지함.
5. **갭 분석 목표 100%** — 빌드 후 본 설계서 항목 1:1 대조, iterate.
6. 운영DB는 `db:migrate` 불가 → `CREATE TABLE IF NOT EXISTS` 멱등 DDL. `drizzle-kit push` 금지(검색 인덱스 DROP 위험).

## 3. 데이터

### 3-1. 신규 테이블 `manual_message_templates` (MSG-16)

| 컬럼 | 타입 | 설명 |
|:-|:-|:-|
| id | uuid PK defaultRandom | |
| is_active | boolean default true | 소프트 삭제 |
| created_at / updated_at | timestamptz | 공통 |
| channel | text NOT NULL | `'email'` \| `'sms'` |
| title | text NOT NULL | 템플릿 제목 (리스트 표시) |
| memo | text | 메모/요약 (리스트 1줄) |
| subject | text | 메일 제목 / 문자 제목 |
| body | text NOT NULL | 메일=markdown, 문자=plain |
| from_name | text | 메일 발신자명 (MSG-20) |
| from_local | text | 메일 발신자 local part |
| variables | jsonb default '[]' | 커스텀 변수 정의 `[{name, source}]` (변수명1~7) |
| sort_order | integer default 0 | 드래그앤드롭 정렬 |

- 인덱스: `(channel, sort_order)`, `(is_active)`.
- DDL: `CREATE TABLE IF NOT EXISTS ...` + drizzle 스키마 파일 `db/schema/manual-message-templates.ts` 동시 추가(타입 일치).

### 3-2. 변수 모델 (MSG-15 / MSG-17 연동)

기존 `lib/messaging/format.ts`의 `MESSAGE_VARIABLES`(4 고정)는 **기본 변수**로 유지하되, 발송 페이로드에 변수별 **값 소스 + 직접값**을 추가한다.

```ts
type VarSource = 'auto' | 'manual' | 'excel';
type VarBinding = { token: string; label: string; source: VarSource; value?: string; excelCol?: string };
```

- `auto`: 수신자별 호텔 메타에서 치환(기존 `substituteVars` 경로).
- `manual`: 전 수신자 공통 `value` 치환.
- `excel`: 수신자 행의 `excelCol` 값 치환.
- 커스텀 변수(엑셀 변수명1~7)는 토큰 `#{변수명1}` … 동적 등록. `VAR_RE` 정규식을 **동적 토큰 허용**으로 확장(`#{...}` 일반 매칭 + 화이트리스트 검증).

### 3-3. 발송 페이로드 확장

- `notification_logs.payload`에 `fromName`(메일, MSG-20), `varBindings`(치환 근거) 추가 보존(이력 추적).

## 4. 화면 설계 (탭별)

### 4-1. 메일 탭

- **(MSG-20) 발신자 줄**: `[발신자명: 오아테크] [로컬: as] @oapms.com` 한 줄. 미리보기 `오아테크 <as@oapms.com>`.
  - 발신자명 기본값 `오아테크`, 빈값 허용(빈값이면 주소만 발신).
  - SES 발신: `From: =?UTF-8?B?..?= <as@oapms.com>` (한글 표시명 RFC 2047 인코딩).
- 수신자 선택기(공통, 4-4) → 제목(필수, 200자) → 본문 RichEditor → 변수칩 →
- **(MSG-15) 변수 값 패널**: 본문에 토큰 존재 시 노출. 행 = `[변수명] [소스 select] [값 input(manual)/엑셀열 select(excel)/안내(auto)]`.
- AI작성 → 푸터 미리보기 → 발송 사유 → 경고박스 → [메일 발송].

### 4-2. 문자 탭

- 발신번호 배지(고정) → 수신자 선택기 →
- **(MSG-19) 제목**: 라벨 `제목 *`(필수), 기본값 `[오아테크]`, 40자. 빈값이면 발송 차단.
  - 제목 존재 → 항상 LMS 이상(기존 `classifySms` 로직 유지: subject 있으면 LMS).
- **(MSG-21) 본문 영역 좌우 분할**: 좌측 = 본문 textarea + 변수칩 + **(MSG-15) 변수 값 패널**, 우측 = 실시간 휴대폰 말풍선 미리보기(바이트수·유형 배지 포함). 모바일은 상하 스택.
- 우측 미리보기 하단 → 수신자수·예상비용 → 경고박스 → `[테스트 발송]`(보조) · [문자 발송].

### 4-3. 템플릿 탭 (MSG-16, 신규)

- 헤더: `[+ 새 템플릿]`.
- 리스트(행/카드): `⠿(드래그핸들)` · 채널배지(메일/문자) · 제목 · 메모(1줄 truncate) · 우측 `사용`·수정(아이콘)·삭제(아이콘).
  - 드래그앤드롭 정렬 → `reorderManualTemplatesAction`(sort_order 일괄 갱신).
  - `사용` 클릭 → 해당 채널 탭으로 전환 + 제목/본문/from/변수바인딩 주입(수신자·변수값만 교체 발송).
- **팝업 모달 에디터**(`[+ 새 템플릿]`/수정):
  - 필드: 채널 select(email/sms) · 제목 · 메모 · 본문(RichEditor+변수칩, 채널별) · **변수명 추가**(커스텀 변수명1~7 등록, 소스 기본 excel) · 저장/취소.
  - 모달은 ConfirmDialog와 별개의 폼 모달(shadcn Dialog). `window.confirm/alert` 금지 준수.

### 4-4. 수신자 선택기 (공통, MSG-17/18)

기존 호텔 검색 + 연락처 칩 + textarea 유지. 하단 액션바 추가:
- **(MSG-17) [엑셀 업로드]**: 드롭존/파일선택 → 클라이언트 파싱(SheetJS) 또는 `parseRecipientsExcelAction`.
  - 컬럼: `업체명 | 연락처(필수: 이메일 또는 휴대폰) | 변수명1 ~ 변수명7`.
  - 미리보기 표(상위 N행) + 오류행 표시(연락처 누락/형식오류). [템플릿 다운로드] 링크.
  - 파싱 결과 → 수신자 + 행별 변수값(excel 소스) 주입.
- **(MSG-18) [호텔리어 전체 불러오기]**: 채널(이메일/문자) 선택 confirm → `listHoteliersAsRecipientsAction` → 전체 호텔리어 추가. 예상 인원 배지.
  - 이메일 채널: `users.email IS NOT NULL`만. 문자 채널: 휴대폰 보유분만. 비활성 계정 제외(`is_active=true`).

### 4-5. 발송 미리보기 + 테스트 발송 (MSG-21·22, 메일/문자 공통)

- **(MSG-21) 문자 미리보기 = 에디터 좌우 분할(split pane)** — *모달 아님*:
  - 문자 탭 본문 영역을 **2단 레이아웃**으로: **좌측 = 입력 에디터**(본문 textarea·변수칩·변수값 패널), **우측 = 실시간 미리보기**.
  - 우측 미리보기 = **휴대폰 말풍선 UI**: 발신번호·제목(LMS 시)·치환된 본문·바이트수·SMS/LMS/MMS 유형 배지를 입력과 동시에 실시간 갱신.
  - 샘플 수신자 1명 기준 변수 치환(`auto/manual/excel`) 적용. 우측 상단 드롭다운으로 다른 수신자 미리보기 전환.
  - 모바일(sm 미만)에서는 상하 스택(입력 위, 미리보기 아래)으로 폴백.
  - 미치환 변수(빈값) 발견 시 미리보기 패널에 경고 강조.
- **(MSG-21) 메일 미리보기**: 메일은 본문이 길어 분할 대신 `[미리보기]` 버튼 → 모달로 발신자명/주소(`오아테크 <as@oapms.com>`)·제목·본문 HTML + 자동 푸터 렌더(샘플 1명 치환).
- **(MSG-22) 테스트 발송**: 테스트 대상 입력(문자=휴대폰, 메일=이메일, 기본값 = 로그인 매니저 연락처 자동) → 변수는 **샘플 수신자 1명 기준 치환**으로 1건 실발송.
  - 실제 SES/Solapi 발송이므로 `notification_logs` 기록하되 `payload.isTest=true` 표식, `batch_id` 미부여(메시지함 미노출).
  - `activity_logs` action `messaging.{email|sms}.test`.
  - 테스트 발송 버튼은 본 발송과 시각적으로 구분(보조 톤), confirm 1단계.

### 4-6. 메시지함 탭 — 컬럼 점검 개편 (MSG-23)

기존 컬럼 `발송일시·유형·총발송·성공·실패·본문`은 숫자 3컬럼이 공간을 과점하고 수신 대상이 노출되지 않음. 개편:

| # | 컬럼 | 내용 | 비고 |
|:-:|:-|:-|:-|
| 1 | 발송일시 | `YYYY-MM-DD HH:mm` | 유지 |
| 2 | 유형 | 메일/문자(SMS·LMS·MMS) 배지 | 유지 |
| 3 | **제목** | subject (없으면 본문 첫 줄) ellipsis | 클릭 → 본문 모달 |
| 4 | **수신** | `업체 요약 · N명` (`그랜드호텔 외 2 · 3명`, 엑셀/호텔리어전체는 출처 표기) | 클릭 → 수신자 목록 모달 |
| 5 | **결과** | `성공 N / 실패 M` **1칸 통합**, 실패>0 강조 | 기존 3칸→1칸 (공간 효율 원칙) |
| 6 | **발송자** | 발송 매니저명 | 감사 추적 |

- 수신 요약은 batch payload의 `company`/출처 메타로 구성. 단일 호텔이면 호텔명, 복수면 `대표 외 N`, 엑셀/전체불러오기는 해당 출처 라벨.
- 모바일 카드뷰: 제목 + 유형배지 상단, 발송일시·수신·결과 하단 메타.
- payload에 `fromName`(MSG-20) 보존. 테스트 발송분(`isTest=true`)은 메시지함 제외.

> ※ 메일 발신자명/주소는 작성 화면에서 **한 줄 처리**(공간 효율 원칙, 4-1) — 발신자명 input + local input + `@oapms.com` 동일 행.

## 5. 서버 액션 (`app/actions/messaging-actions.ts`)

| 액션 | 입력 | 반환 | 항목 |
|:-|:-|:-|:-:|
| `listManualTemplatesAction` | `{channel?}` | `Template[]` (sort_order ASC) | MSG-16 |
| `saveManualTemplateAction` | `{id?, channel, title, memo?, subject?, body, fromName?, fromLocal?, variables}` | `{ok, id}` | MSG-16 |
| `deleteManualTemplateAction` | `{id}` | `{ok}` (soft: is_active=false) | MSG-16 |
| `reorderManualTemplatesAction` | `{orderedIds[]}` | `{ok}` | MSG-16 |
| `parseRecipientsExcelAction` | `{fileBase64}` | `{ok, rows[], errors[]}` | MSG-17 |
| `listHoteliersAsRecipientsAction` | `{channel}` | `{ok, recipients[], count}` | MSG-18 |
| `sendBulkEmailAction`(확장) | `+ fromName, + varBindings` | `{ok, sent, failed}` | MSG-20·15 |
| `sendBulkSmsAction`(확장) | `subject 필수, + varBindings` | `{ok, sent, failed}` | MSG-19·15 |

- 전부 `requireRole(['manager','admin'])`. 변경 액션은 `activity_logs` 기록(fire-and-forget).
- 엑셀 파싱은 서버 권장(파일 검증·시트 제한·행수 상한 200). 라이브러리 `xlsx` 서버 전용(`server-only`), 클라 번들 누수 방지(`serverExternalPackages`).

## 6. 검증 규칙

- 메일: 발신자명 0~64자, 로컬 `^[a-zA-Z0-9._-]{1,64}$`, 제목 필수, 수신자 이메일 정규식.
- 문자: 제목 필수(빈값 차단), 발신번호 고정, 수신자 휴대폰 9~11자리 + **010 시작 권장 경고**.
- 엑셀: 연락처 필수, 이메일 또는 휴대폰 형식 판별 후 채널 자동분류, 최대 200행.
- 변수: `manual` 소스인데 값 미입력 시 발송 전 경고(빈 문자열 치환 방지 — MSG-15 취지).

## 7. 엣지 케이스

1. 엑셀에 이메일/휴대폰 혼재 → 행별 채널 분류, 현재 탭 채널과 불일치 행은 제외+경고.
2. 커스텀 변수(`#{변수명3}`)가 본문엔 있는데 엑셀열 미매핑 → 발송 전 차단.
3. 템플릿 `사용` 시 현재 작성 중 내용 존재 → 덮어쓰기 confirm.
4. 호텔리어 전체 불러오기 후 200명 초과 → 상한 안내, 분할 발송 권고.
5. 발신자명 한글 → SES RFC 2047 인코딩 누락 시 깨짐 → 인코딩 유닛 검증.
6. 드래그 정렬 중 다른 매니저가 동시 수정 → sort_order 멱등 갱신(updated_at 비교 생략, 마지막 저장 우선).

## 8. 구현 순서 (Do)

1. **MSG-15** 변수 값 패널 + 모델 확장(format.ts) — 변수 기능 복구(선결)
2. **MSG-19·20** 문자 제목 필수/기본값 + 메일 발신자명(소필드)
3. **MSG-21** 문자 미리보기 분할(좌 입력/우 말풍선) + 메일 미리보기 모달, **MSG-22** 테스트 발송
4. **MSG-17·18** 엑셀 업로드 + 호텔리어 전체(수신자 경로)
5. **MSG-16** 템플릿 탭 + 모달 + CRUD/정렬(최대 작업)

각 단계 빌드 → 갭 대조 → 다음 단계. 전체 완료 후 통합 갭 분석 100% 확인.

## 9. 영향 파일

- 신규: `db/schema/manual-message-templates.ts`, 템플릿 탭/모달 컴포넌트
- 수정: `messaging-client.tsx`(4탭·변수패널·수신자액션·발신자명·문자제목), `messaging-actions.ts`(액션 8종), `lib/messaging/format.ts`(변수 모델)
- 마이그레이션: 멱등 DDL 스크립트 1건
