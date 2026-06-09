# 메일&문자 — 메시지함 + 발송 개편 설계서

- 기능명: messagebox (메일&문자 발송 묶음 조회 + 발송 화면 개편)
- 메뉴: 어드민 > 메일&문자 (`/admin/insights/messaging`)
- 역할: manager, admin
- 와이어프레임: `docs/dev-logs/2026-06-09-messagebox-wireframe.html`

## 1. 목표

기존 '지난 이력' 탭(수신자별 카드)을 **'메시지함' 탭(발송 묶음 테이블)**으로 대체하고,
메일/문자 작성 화면에 발신자 편집·제목·변수 치환·푸터를 추가한다.

## 2. 확정 결정사항

1. **발송 그룹핑**: 신규 발송부터 `batch_id`(uuid) 부여 → 1발송 = 1행. batch_id 없는 기존 이력은 메시지함 미표시.
2. **업체명**: 발송 시점에 수신자별 업체(호텔)명을 batch에 저장(변수 자동 치환과 동일 매핑). 복수 호텔이면 `호텔명(+N)`, 직접 입력분은 `직접입력`.
3. **메시지함이 '지난 이력' 탭 대체**.
4. **변수 자동 치환**: `#{업체명}`,`#{담당자명}`,`#{연락처}`,`#{호텔명}` → 수신자별 실제 값. 직접 입력분은 빈 문자열.
5. **메일 발신자**: 앞부분(local part)만 입력, `@oapms.com` 고정. 기본 `as`. SES 프로덕션 검증 완료.
6. **문자 제목(선택)**: 입력 시 LMS 자동 전환.
7. **메일 푸터**: 발송 시 본문 하단 회사 푸터 자동 첨부((주)오아테크).
8. **문자 유형**: SMS/LMS/MMS 구분(제목·90byte·이미지첨부 기준). MMS 이미지 첨부 UI는 차기(분류·표시는 지원).

## 3. 데이터

`notification_logs` 컬럼 추가: `batch_id uuid` + 인덱스 `(batch_id, created_at)`.
payload(jsonb) 보존 필드: `subject`(템플릿), `body`/`text`(템플릿), `reason`, `company`(업체명 표시), `msgType`('email'|'sms'|'lms'|'mms'), `from`(메일).

## 4. 서버 액션 (`app/actions/messaging-actions.ts`)

- `sendBulkEmailAction({recipients[], fromLocal?, subject, markdown, reason?})` — 구조화 수신자, 발신자 local, 변수 치환, 푸터 첨부, batchId, company 보존.
- `sendBulkSmsAction({recipients[], subject?, text, reason?})` — 제목 선택, 변수 치환, SMS/LMS 판정, batchId, company 보존.
- `listMessageBatchesAction({type,dateFrom,dateTo,company,email,phone,page,pageSize})` — batch group by 집계(총발송/성공/실패), 검색, 페이지네이션(20/50/100).
- `getBatchRecipientsAction(batchId)` — 수신자 목록(업체명/주소/상태).
- `getHotelContactsAction`, `aiWriteEmailAction` 유지.

## 5. UI (`messaging-client.tsx`)

- 탭: 메일 / 문자 / **메시지함**.
- 메일 탭: 발신자(앞부분+@oapms.com), 수신자(메타 보관), 제목, 본문(RichEditor + 변수칩 + 푸터 미리보기 + AI), 사유.
- 문자 탭: 발신번호, 수신자, **제목(선택)**, 본문(변수칩 + byte/SMS·LMS), 사유.
- 메시지함 탭: 검색(발송일·유형·업체명·메일주소·문자번호), 페이지당 20/50/100, 테이블(발송일시초·유형·총발송팝업·성공·실패·본문팝업), 모바일 카드뷰, 페이지네이션, 수신자 팝업·본문 팝업.

## 6. Acceptance Criteria

- AC1 메시지함 탭이 '지난 이력'을 대체하고 발송 묶음 테이블 표시.
- AC2 발송일시는 초 단위(YYYY-MM-DD HH:mm:ss).
- AC3 유형: 메일 / 문자 SMS / 문자 LMS / 문자 MMS 구분.
- AC4 총발송 클릭 → 수신자 목록 팝업(업체명/주소/성공·실패).
- AC5 본문 클릭 → 제목+본문 팝업(파라미터 칩, 복사).
- AC6 페이지당 20/50/100, 페이지네이션.
- AC7 검색 5종(발송일·유형·업체명·메일주소·문자번호).
- AC8 메일 발신자 앞부분 입력 + @oapms.com 고정.
- AC9 메일/문자 본문 변수 칩 클릭 삽입(메일 4종, 문자 4종).
- AC10 변수 발송 시 수신자별 치환.
- AC11 메일 본문 하단 회사 푸터 자동 첨부 + 미리보기.
- AC12 문자 제목(선택) → LMS 전환.
