# Implementation Plan — 통합 AS 플랫폼

> 60개 기능 명세 + DB 스키마 + Phase 계획 + 권한 매트릭스.
> 기능/스키마 변경 시 **이 파일 먼저 갱신** 후 코드.

---

## 0. 프로젝트 개요

| 항목 | 값 |
|:-:|:-|
| 서비스명 | 통합 AS 플랫폼 |
| 도메인 | support.oapms.com (예정) |
| 통합 대상 | as.oapms.com (티켓) · help.oapms.com (아티클, 채널.io) · oachat.ai (챗봇) |
| 사용자 3종 | 호텔리어 / 매니저 / 어드민 |
| 기술 스택 | Next.js 15 + TypeScript + Drizzle ORM + Neon (PostgreSQL) + Vercel |
| MVP 범위 | **P1만** (약 35개 기능) |
| 운영 모델 | 무료 내부 서비스 (결제 X) |

---

## 1. 기능 목록 (60개)

> 출처: 기획 스프레드시트. 모든 ID는 코드/문서에서 그대로 참조.

### 0. 랜딩 페이지 (LP) — 진입점 & 탐색 허브

| ID | 기능 | 핵심 동작 | 권한 | 우선순위 |
|:-:|:-|:-|:-:|:-:|
| LP-01 | 통합 홈 화면 | 검색창·인기검색어·카테고리 아이콘·자주찾는작업·역할별 시작·서비스 상태·최근 업데이트·CTA(일반접수/오류접수/내문의) | 전체 | P1 |
| LP-02 | GNB 네비게이션 | 홈·빠른해결·제품별 가이드·서비스 상태·문의 접수·공지/업데이트 + 로그인/내 문의 | 전체 | P1 |
| LP-03 | 서비스 상태 위젯 | 정상/장애 실시간 표시, 공지 최신 2건, 장애 발생 시 자동 배너 전환 | 매니저(편집)·전체(조회) | P2 |
| LP-04 | 최근 업데이트 위젯 | 도움말·공지 최신 3건 (제품태그·제목·날짜) | 매니저(편집)·전체(조회) | P2 |
| LP-05 | 모바일 반응형 | 검색·아이콘메뉴·자주찾는작업·전화문의 CTA 최적화 | 전체 | P2 |

### 1. 셀프 서치 (SS) — 스스로 기능 학습

| ID | 기능 | 핵심 동작 | 권한 | 우선순위 |
|:-:|:-|:-|:-:|:-:|
| SS-01 | 통합 검색 | 키워드 → 도움말/FAQ/공지/업데이트/장애 탭 결과. 제품·문제유형 필터. 건수 표시 | 전체 | P1 |
| SS-02 | 제품별 가이드 (핸드북) | PMS·CMS·Keyless·키오스크·웹서비스·설정 카테고리별 아티클 목록 | 전체 | P1 |
| SS-03 | 도움말 상세 페이지 | 본문 + 목차 + PDF/인쇄/공유 + 30초 요약 + 관련문서 + 도움됨 피드백 | 전체 | P1 |
| SS-04 | 인기검색어·자주찾는작업 | 인기검색어 자동 집계, 자주찾는작업 최대 8개 버튼 | 매니저 | P2 |
| SS-05 | 역할별 시작하기 | 프론트·예약/판매·하우스키핑·관리자·신규오픈 역할별 가이드 매핑 | 전체 | P2 |
| SS-06 | 아티클 게시물 관리 | 생성·수정·삭제·카테고리 이동·공개여부. 마크다운 에디터 | 매니저·어드민 | P1 |
| SS-07 | (AI) 게시물 포맷 최적화 | AI가 초안 가독성·구조 개선안 제안, 담당자 검토 후 반영 | 매니저(검토) | P3 |

### 2. 셀프 픽스 (SF) — 스스로 문제 해결

| ID | 기능 | 핵심 동작 | 권한 | 우선순위 |
|:-:|:-|:-|:-:|:-:|
| SF-01 | FAQ 목록 | 제품·유형 필터, 아코디언 UI | 전체 | P1 |
| SF-02 | 트러블슈팅 체크리스트 | 오류 유형 → 단계별 체크. '해결됨' or '접수하기' 분기 | 전체 | P1 |
| SF-03 | 빠른 해결 가이드 | 30초 요약 카드형 노출 | 전체 | P2 |
| SF-04 | FAQ·체크리스트 콘텐츠 관리 | 추가/수정/삭제/정렬, 단계 편집, 카테고리 연결 | 매니저·어드민 | P1 |
| SF-05 | (AI) 클레임 분석 기반 콘텐츠 보강 | 누적 이슈 데이터 분석 → FAQ/체크리스트 초안 자동 생성 | 매니저(검토) | P3 |

### 2-b. 챗봇 (CB) — 대화형 셀프 서비스

| ID | 기능 | 핵심 동작 | 권한 | 우선순위 |
|:-:|:-|:-|:-:|:-:|
| CB-01 | 챗봇 임베드 (oachat.ai) | 전 페이지 우하단 플로팅 버튼 | 전체 | P1 |
| CB-02 | 핸드북·FAQ 기반 답변 | 색인 기반 AI 답변 + 출처 아티클 링크 | 전체 | P1 |
| CB-03 | 체크리스트 안내 | 증상 설명 → 관련 체크리스트 단계 제시 | 전체 | P1 |
| CB-04 | 이슈 접수 연결 | 미해결 시 접수폼으로 전환, 대화 자동 pre-fill | 전체 | P2 |

### 3. 이슈 클레임 (IC) — 문제 접수

| ID | 기능 | 핵심 동작 | 권한 | 우선순위 |
|:-:|:-|:-|:-:|:-:|
| IC-01 | 접수 폼 — 기본 정보 | 제품·호텔/장애명·유형(오류/장애/기능문의/기능개발/데이터수정/기타)·영향범위·제목·내용. 3단계 스텝퍼 | 호텔리어 | P1 |
| IC-02 | 접수 폼 — 멀티미디어 첨부 | 이미지·비디오·로그파일 (최대 50MB) | 호텔리어 | P1 |
| IC-03 | 접수 폼 — 연락 수단 선택 | SMS(솔라피)·이메일(SES) 선택. 접수확인 자동 발송 | 호텔리어 | P1 |
| IC-04 | 전화 접수 (관리자 수기) | 통화 중 직접 작성. AI 작성 보조. 체크리스트 자동 제안. 유입채널='전화' 자동 태깅 | 매니저 | P1 |
| IC-05 | 챗봇 경유 접수 | 챗봇 대화 기반 자동 접수. 호텔 매핑(매니저 수동). 대화내용 첨부 | 매니저 | P2 |
| IC-06 | 티켓 자동 생성 & 번호 발급 | 티켓번호 자동, 접수확인 SMS/이메일 즉시, Slack `#as-new` 알림. P1 긴급은 `#as-urgent` | — (시스템) | P1 |
| IC-07 | 내부 메모 | 티켓별 비공개 메모. Slack 스레드 양방향 연동 | 매니저 | P1 |
| IC-08 | Dev 에스컬레이션 | Slack 통한 개발팀 에스컬. 티켓 ↔ Slack 스레드 연결 | 매니저 | P1 |
| IC-09 | (AI) 작성 보조 | 맞춤법·명확성 실시간 보조, 누락 정보 자동 감지 | — | P2 |
| IC-10 | (AI) 정보칩 추출 & 예상 답변 | 제품·오류유형·긴급도·키워드 자동 추출. 유사 사례 기반 답변 제안 | 매니저 | P2 |
| IC-11 | (AI) 체크리스트 자동 추출 | 접수 내용 기반 체크리스트 자동 제안. 담당자가 이용자에게 발송 | 매니저 | P2 |

### 4. 이슈 현황 (IS) — 처리 추적

| ID | 기능 | 핵심 동작 | 권한 | 우선순위 |
|:-:|:-|:-|:-:|:-:|
| IS-01 | 내 문의 목록 | 본인 접수 티켓 전체. 상태(접수/처리중/완료/보류) 색상 표시. 최신순 | 호텔리어 | P1 |
| IS-02 | 티켓 상세 보기 | 접수내용·첨부·처리이력·공개메모. 이용자 추가 답변 (답신자 정보 포함) | 호텔리어·매니저 | P1 |
| IS-03 | 상태 3단계 알림 | 접수확인→처리중→완료 SMS/이메일 자동 | — | P1 |
| IS-04 | 티켓 큐 & 상태 업데이트 | 칸반/리스트 뷰. 상태 드래그/드롭. 담당자·마감일 | 매니저 | P1 |
| IS-05 | 엑셀 다운로드 | 필터(기간·제품·상태·담당자) → xlsx | 매니저·어드민 | P2 |
| IS-06 | SMS/이메일 수동 발송 | 티켓 상세에서 개별 발송. 템플릿 or 직접 입력 | 매니저 | P2 |

### 5. Data Insight (DI) — 데이터 시각화

| ID | 기능 | 핵심 동작 | 권한 | 우선순위 |
|:-:|:-|:-|:-:|:-:|
| DI-01 | AS 현황 대시보드 | P1긴급/P2대기/오늘완료/AI자동해결 카드. 제품·유형·채널별 추이 차트 | 매니저·어드민 | P2 |
| DI-02 | 담당자별 처리 현황 | 처리건수·평균해결시간·미처리건수 테이블 | 어드민 | P3 |
| DI-03 | AI 자동해결률 트래킹 | AI/셀프 해결 비율, 목표치 설정 | 매니저·어드민 | P2 |
| DI-04 | (AI) 정보칩 기반 인사이트 | 반복 이슈·빈출 키워드·미해결 다발 제품 자동 분석 리포트 | 어드민 | P3 |
| DI-05 | 월간 리포트 자동 발송 | 월 1회 Slack 자동 발송 | — | P3 |

### 6. 공지/업데이트 (NT)

| ID | 기능 | 핵심 동작 | 권한 | 우선순위 |
|:-:|:-|:-|:-:|:-:|
| NT-01 | 공지사항 목록·상세 | 점검·장애·업데이트. 제품 태그 필터. 상단 고정 | 매니저·어드민 | P1 |
| NT-02 | 릴리즈 노트 | 제품별 업데이트 내역 | 매니저 | P2 |
| NT-03 | 긴급 공지 배너 | 장애 발생 시 홈 최상단 자동 배너. 정상화 시 자동 해제 | 매니저(설정) | P1 |

### 7. 권한 관리 (PM)

| ID | 기능 | 핵심 동작 | 권한 | 우선순위 |
|:-:|:-|:-|:-:|:-:|
| PM-01 | 호텔리어 | 로그인 후 모든 정보 열람, 본인 티켓 조회·추가답변, 셀프서비스 이용 | 호텔리어 | P1 |
| PM-02 | 매니저 | 콘텐츠 편집·발행, 이슈 처리·상태 변경·담당자 배정, SMS/이메일 발송 | 매니저 | P1 |
| PM-03 | 어드민 | 카테고리 구조·상태값 강제 변경·계정·Data Insight 전체 | 어드민 | P1 |
| PM-04 | SSO / 계정 연동 | `*.oapms.com` SSO 로그인. 별도 가입 불필요 | — | P1 |

### 8. 프로필 & 계정 관리 (AC)

| ID | 기능 | 핵심 동작 | 권한 | 우선순위 |
|:-:|:-|:-|:-:|:-:|
| AC-01 | 호텔 프로필 — 기본 정보 | 호텔명·담당자·직책·연락처·이메일 조회/수정 | 호텔리어 | P1 |
| AC-02 | 호텔 프로필 — 솔루션 링크 | PMS(SSO 자동)·Keyless·홈페이지·기타 5개 항목 추가 | 호텔리어 | P1 |
| AC-03 | 비밀번호 변경 | 현재 비번 확인 → 신규 2회. 변경 시 SMS 알림 | 호텔리어 | P1 |
| AC-04 | 직원 계정 추가 | 본인 숙소 직원 추가 (이름·직책·연락처·이메일·권한=호텔리어). 초대 SMS 자동 | 호텔리어 | P2 |
| AC-05 | 직원 계정 편집·비활성화 | 정보 수정, 비활성화 (이력 유지), 재활성화 | 호텔리어 | P2 |
| AC-06 | 사용자 리스트 조회 | 전체 계정: 호텔명·담당자·이메일·권한·가입일·최근로그인·상태. 검색·필터 | 어드민 | P1 |
| AC-07 | 사용자 계정 생성 | 어드민 직접 생성: 호텔 매핑·권한(호텔리어/매니저/어드민). 초대 SMS/이메일 | 어드민 | P1 |
| AC-08 | 사용자 계정 편집 | 호텔 매핑·권한·직책·연락처. 권한 변경 시 확인 팝업 | 어드민 | P1 |
| AC-09 | 비밀번호 초기화 | 임시 비번 SMS/이메일 자동 발송. 첫 로그인 시 변경 강제 | 어드민 | P1 |
| AC-10 | 계정 활성·비활성 | 비활성 시 로그인 차단. 이력·메모 보존. 완전 삭제 불가 | 어드민 | P1 |

---

## 2. 사용자 흐름 (User Journey)

| ① 랜딩 진입 | ② 셀프 서치 | ③ 셀프 픽스 | ④ 챗봇 | ⑤ 이슈 클레임 | ⑥ 이슈 현황 | ⑦ 피드백 |
|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 검색·카테고리 | 핸드북 열람 | FAQ·체크리스트 | oachat.ai 대화 | 3단계 접수폼 | 상태 추적·답변 | 만족도 3단계 |
| → ② or ③ | 해결 → 종료 / 부족 → ③ | 해결 → 종료 / 미해결 → ④ | 해결 → 종료 / 미해결 → ⑤ | 티켓 발급 + SMS | 완료 확인 → ⑦ | 미해결 시 재접수 |

## 3. 관리자 흐름

| ① 콘텐츠 관리 | ② 티켓 수신·배정 | ③ 처리 | ④ 이용자 응대 | ⑤ 리포트 | ⑥ 계정·권한 |
|:-:|:-:|:-:|:-:|:-:|:-:|
| 아티클·FAQ·체크리스트·공지 발행 | Slack 알림 → 티켓 큐 → AI 태깅 → 담당자 지정 | 처리내용·내부메모·체크리스트 발송·Dev 에스컬 | 상태 업데이트·SMS/이메일 발송·공개메모 | 대시보드·엑셀·월간 리포트 | (어드민) 계정 생성·권한·카테고리 |

---

## 4. 외부 연동 매트릭스

| 시스템 | 역할 | 연동 방식 | 우선순위 | 비고 |
|:-:|:-:|:-:|:-:|:-:|
| support.oapms.com | 통합 AS 허브 (신규, 본 프로젝트) | 자체 개발 | P1 | as+help 통합 진입점 |
| as.oapms.com | 현재 AS 접수 사이트 | 점진적 통합 또는 리다이렉트 | P1 | 레퍼런스 |
| help.oapms.com | 아티클·핸드북 (채널.io) | API 색인 연동 or 마이그레이션 | P1 | **이관 정책 결정 필요** |
| oachat.ai | AI 챗봇 (OA Chat) | iframe 임베드 | P1 | 외부 장애 대비 fallback |
| Slack | 내부 알림·Dev 에스컬 | Webhook | P1 | `#as-new`/`#as-urgent`/`#dev-escalation` |
| 솔라피 (SMS) | 고객 자동 문자 | 솔라피 API | P1 | 접수·처리중·완료 3단계 |
| AWS SES | 이메일 알림 | SES API | P1 | 이용자 선택 시 |
| AWS S3 | 첨부파일 저장 | Presigned URL | P2 (P1으로 격상 권장) | 이미지·비디오·로그 |
| oapms.com SSO | 계정·인증 | OAuth/OIDC | P1 | 별도 가입 불필요 |
| Monday.com | 현재 AS 이력 | Zapier or DB 이관 | P2 | 이관 로드맵 필요 |

---

## 5. 권한 매트릭스 (요약)

| 기능군 | 호텔리어 | 매니저 | 어드민 |
|:-|:-:|:-:|:-:|
| 셀프서치·핸드북 열람 | ● | ● | ● |
| 셀프픽스·FAQ·체크리스트 | ● | ● | ● |
| 챗봇 | ● | ● | ● |
| 본인 이슈 접수·조회·추가답변 | ● | ● | ● |
| 전체 티켓 조회 | ✕ | ● | ● |
| 티켓 상태·담당자·마감일 | ✕ | ● | ● |
| 내부 메모·SMS/이메일 발송·Dev 에스컬 | ✕ | ● | ● |
| 엑셀 다운로드 | ✕ | ● | ● |
| 아티클·FAQ·공지 편집·발행 | ✕ | ● | ● |
| Data Insight 대시보드 | ✕ | ● | ● |
| 상태값 강제 변경·카테고리 구조 변경 | ✕ | ✕ | ● |
| 계정 생성·권한 설정·비번 초기화·활성 토글 | ✕ | ✕ | ● |
| AI 인사이트 리포트 | ✕ | ✕ | ● |
| 본인 호텔 프로필·솔루션 링크·비번 변경 | ● | ● | ● |
| 본인 숙소 직원 계정 추가·편집·비활성 | ● | ● | ● |
| 전체 사용자 리스트·전체 계정 관리 | ✕ | ✕ | ● |

> 상세 권한 룰은 `lib/permissions.ts`에 코드로 명세.

---

## 6. 어드민 마스터 데이터 편집 메뉴 (`/admin/master`)

> 핵심 요구사항: **대부분의 DB 항목을 어드민이 별도 메뉴와 세부 탭에서 편집 가능**.

| 메뉴 | 편집 대상 (테이블) | 세부 탭 | 우선순위 |
|:-|:-|:-|:-:|
| 카테고리 관리 | `categories` | 제품(PMS/CMS/Keyless/키오스크/웹서비스/설정) · 문제유형(오류/장애/기능문의/기능개발/데이터수정/기타) · 영향범위 · 긴급도 | P1 |
| 이슈 접수 폼 필드 | `ticket_form_fields` | 제품별 동적 필드 (JSONB), 표시순서, 필수여부 | P1 |
| 알림 템플릿 | `notification_templates` | SMS 템플릿 / 이메일 템플릿 / 이벤트별(접수/처리중/완료/초대/비번초기화) | P1 |
| 빠른 응대 템플릿 | `quick_reply_templates` | 매니저 수동 발송용 텍스트 (카테고리별) | P2 |
| 자주찾는작업 | `quick_actions` | 홈 상단 8개 버튼 (라벨·아이콘·링크·순서·노출여부) | P2 |
| 역할별 시작하기 | `role_starters` | 프론트·예약/판매·하우스키핑·관리자·신규오픈 → 가이드 매핑 | P2 |
| 인기검색어 | `popular_keywords` | 자동 집계 + 수동 큐레이션 + ON/OFF | P2 |
| 솔루션 링크 마스터 | `solution_link_presets` | 호텔 프로필 기본값 (Keyless·홈페이지 등) | P2 |
| 시스템 설정 | `system_settings` | 첨부 사이즈 · Rate Limit · SSO · 외부키 마스킹 · 슬랙 채널 | P1 |
| 호텔 마스터 | `hotels` | 호텔명·OA PMS 매핑 ID (어드민만 편집) | P1 |

---

## 7. DB 스키마 (Drizzle ORM)

> 모든 테이블에 공통 컬럼 `id (uuid)`, `created_at`, `updated_at`, `is_active`.
> 외래키는 `references()` 명시. JSONB는 동적 데이터에만 사용.

### 7.1 핵심 도메인 테이블

#### `hotels` (호텔 마스터)
```ts
id, name, oa_pms_hotel_id (unique, nullable),
business_no, address, phone, manager_name,
note, created_at, updated_at, is_active
```

#### `users` (계정)
```ts
id, hotel_id (FK hotels, nullable for 매니저/어드민),
email (unique), name, title, phone, password_hash,
role enum('hotelier' | 'manager' | 'admin'),
last_login_at, sso_subject (OA SSO 식별자),
created_at, updated_at, is_active
```

#### `categories` (제품·유형·긴급도·영향범위)
```ts
id, type enum('product' | 'issue_type' | 'urgency' | 'impact'),
code (unique within type), label, icon, sort_order,
meta jsonb, created_at, updated_at, is_active
```

#### `ticket_form_fields` (어드민 편집 동적 폼 필드)
```ts
id, product_code (FK categories.code where type=product, nullable for 공통),
field_key, label, input_type enum('text'|'textarea'|'select'|'number'|'date'|'file'),
options jsonb, required, sort_order, help_text,
created_at, updated_at, is_active
```

#### `tickets` (이슈 클레임)
```ts
id, ticket_no (unique, e.g. 'AS-2026-000123'),
hotel_id (FK), reporter_id (FK users),
product_code, issue_type, impact_scope, urgency,
title, content, custom_fields jsonb,
status enum('received' | 'in_progress' | 'on_hold' | 'completed'),
assignee_id (FK users, nullable),
due_date timestamp,
channel enum('web' | 'phone' | 'chatbot'),
slack_thread_ts varchar, monday_item_id varchar,
created_at, updated_at, is_active
```

#### `ticket_messages` (공개 답변 + 내부 메모)
```ts
id, ticket_id (FK), author_id (FK users),
kind enum('public' | 'internal_memo' | 'status_change' | 'system'),
content text, attachments jsonb,
created_at, updated_at, is_active
```

#### `ticket_attachments`
```ts
id, ticket_id (FK), message_id (FK nullable),
s3_key, original_name, mime_type, size_bytes,
uploader_id (FK users), created_at, is_active
```

#### `articles` (도움말 아티클, SS-02/03/06)
```ts
id, product_code, category_path text[], slug (unique),
title, summary_30s text, body_markdown text,
toc jsonb, related_article_ids uuid[],
author_id (FK users), published_at,
view_count, helpful_yes, helpful_no,
created_at, updated_at, is_active
```

#### `faqs`
```ts
id, product_code, issue_type, question, answer_markdown,
sort_order, created_at, updated_at, is_active
```

#### `checklists`
```ts
id, product_code, issue_type, title, description,
created_at, updated_at, is_active
```

#### `checklist_steps`
```ts
id, checklist_id (FK), step_no, title, body_markdown,
condition_yes_action enum('next' | 'resolved' | 'escalate'),
condition_no_action enum('next' | 'resolved' | 'escalate'),
created_at, updated_at, is_active
```

#### `notices` (공지·릴리즈·긴급)
```ts
id, kind enum('notice' | 'release' | 'incident'),
product_code (nullable), title, body_markdown,
pinned bool, banner bool, banner_until timestamp,
published_at, author_id (FK users),
created_at, updated_at, is_active
```

### 7.2 시스템·운영 테이블

#### `notification_templates`
```ts
id, channel enum('sms' | 'email'),
event_key (unique, e.g. 'ticket.received', 'ticket.completed', 'user.password_reset'),
subject (email), body text (with {{변수}} 치환),
created_at, updated_at, is_active
```

#### `notification_logs` (발송 이력)
```ts
id, template_event_key, channel, to_address,
payload jsonb, status enum('sent' | 'failed' | 'retry'),
attempts, error_message, related_ticket_id (FK nullable),
sent_at, created_at
```

#### `quick_actions` (자주찾는작업, LP-01)
```ts
id, label, icon, link_url, sort_order, visible,
created_at, updated_at, is_active
```

#### `role_starters` (역할별 시작하기, SS-05)
```ts
id, role_key (front/sales/housekeeping/manager/new_open),
label, description, article_ids uuid[], sort_order,
created_at, updated_at, is_active
```

#### `popular_keywords`
```ts
id, keyword, source enum('auto' | 'manual'), hit_count,
sort_order, visible, created_at, updated_at, is_active
```

#### `solution_link_presets` (AC-02 기본값)
```ts
id, label (e.g. 'PMS', 'Keyless', '홈페이지'),
default_url_template, icon, sort_order,
created_at, updated_at, is_active
```

#### `system_settings` (key-value)
```ts
id, key (unique), value jsonb, description,
updated_by (FK users), updated_at
// 예: max_upload_mb, rate_limit_login_per_min, slack_channels, ...
```

#### `activity_logs` (감사)
```ts
id, user_id (FK), action, target_type, target_id,
payload jsonb, ip, user_agent, created_at
```

#### `ticket_feedback` (피드백 ⑦)
```ts
id, ticket_id (FK), rating enum('resolved' | 'partial' | 'unresolved'),
comment text, created_at
```

#### `service_status` (LP-03)
```ts
id, status enum('normal' | 'degraded' | 'incident' | 'maintenance'),
message text, started_at, ended_at,
created_by (FK users), created_at, is_active
```

### 7.3 챗봇 연동 (CB)

#### `chatbot_sessions` (CB-04 pre-fill 용)
```ts
id, external_session_id (oachat.ai 식별자),
user_id (FK nullable), hotel_id (FK nullable),
transcript jsonb, converted_ticket_id (FK nullable),
created_at, is_active
```

---

## 8. Phase 계획 (MVP = P1만)

> 각 Phase 완료 시 사용자 승인 받고 다음 진행. Phase 0은 필수 선행.

### Phase 0 — 프로젝트 셋업 (1~2일)
- [ ] Next.js 15 + TypeScript 프로젝트 생성
- [ ] Tailwind 4 + shadcn/ui 초기화 (메인 컬러는 우선 indigo, 추후 확정)
- [ ] Drizzle ORM + Neon 연결 (DATABASE_URL)
- [ ] Vercel 프로젝트 연동
- [ ] 폴더 구조 골격 (`/app`, `/db`, `/lib`, `/components`, `/docs`)
- [ ] `.env.example`, `.gitignore`, ESLint, Prettier
- [ ] 다크모드 토글, ConfirmDialog 전역, Toaster 셋업
- [ ] 헤더/GNB 레이아웃 골격 (LP-02 기준)
- [ ] `.env`로 환경변수 정리, GitHub 저장소 연결

**완료 기준**: `npm run dev` → 빈 홈 + 다크모드 토글 + 헬스체크 API

### Phase 1 — 인증·권한·프로필 (3~4일)
- [ ] NextAuth + OA SSO Provider 구현 (PM-04)
- [ ] 역할 미들웨어 + `requireRole()` helper
- [ ] `users`, `hotels`, `categories` 스키마 + 시드
- [ ] 호텔리어 프로필 페이지 (AC-01, AC-02, AC-03)
- [ ] 직원 계정 관리 (AC-04, AC-05)
- [ ] 어드민 사용자 관리 (AC-06~10): 리스트·생성·편집·비번초기화·활성토글
- [ ] 호텔 마스터 어드민 (Phase 7 마스터 일부 선행)
- [ ] 솔라피·SES 연동 (초대·비번초기화 SMS/이메일)
- [ ] `activity_logs` 기본 셋업

**리스크**: OA PMS 호텔 계정 매핑 정책 — 시작 전 사용자와 확정 필요

### Phase 2 — 랜딩 (2~3일) — **완료 2026-05-28**
- [x] LP-01 통합 홈 (검색창·카테고리 아이콘·자주찾는작업·역할별·서비스상태·최근 업데이트·CTA)
- [x] LP-02 GNB (활성메뉴·검색·세션·어드민 진입)
- [x] LP-03 서비스 상태 위젯 (`service_status` 테이블 + `/admin/service-status` + `/status`)
- [x] LP-05 모바일 반응형 (sm/md/lg/xl 그리드 · iOS 줌 방지 · 햄버거 메뉴)
- [x] NT-03 긴급 배너 (incident 상태 자동 노출 RSC · XSS-safe)
- [x] placeholder: `/help`, `/help/[product]`, `/notices`, `/role/[key]`, `/search`, `/faq`, `/tickets`, `/tickets/new`

### Phase 3 — 셀프 서치 (3~4일)
- [ ] `articles` 스키마 + 어드민 편집 (SS-06, 마크다운 에디터)
- [ ] SS-02 제품별 가이드 (핸드북) 목록
- [ ] SS-03 도움말 상세 (목차·30초 요약·PDF/인쇄/공유·관련문서·도움됨 피드백)
- [ ] SS-01 통합 검색 (탭별 결과·필터)
- [ ] **help.oapms.com (채널.io) 마이그레이션 방안 결정** — API 색인 vs DB 이관

### Phase 4 — 셀프 픽스 (2일)
- [ ] `faqs`, `checklists`, `checklist_steps` 스키마
- [ ] SF-01 FAQ 목록 (아코디언)
- [ ] SF-02 트러블슈팅 체크리스트 (단계별 분기)
- [ ] SF-04 어드민 편집

### Phase 5 — 이슈 클레임 (4~5일)
- [ ] `tickets`, `ticket_messages`, `ticket_attachments`, `ticket_form_fields` 스키마
- [ ] S3 Presigned URL API + 업로드 컴포넌트
- [ ] IC-01 3단계 접수폼 (제품·유형·영향범위·제목·내용)
- [ ] IC-02 첨부 (최대 50MB)
- [ ] IC-03 연락수단 선택
- [ ] IC-06 티켓 자동 생성 + 솔라피/SES 접수확인 + Slack `#as-new` 알림 (P1은 `#as-urgent`)
- [ ] IC-04 전화 접수 (관리자 수기 입력)
- [ ] IC-07 내부 메모
- [ ] IC-08 Dev 에스컬레이션 (Slack `#dev-escalation`)

### Phase 6 — 이슈 현황 (2~3일)
- [ ] IS-01 내 문의 목록
- [ ] IS-02 티켓 상세 (처리이력·공개메모·추가 답변)
- [ ] IS-03 상태 3단계 알림 (SMS/이메일 자동)
- [ ] IS-04 어드민 티켓 큐 (칸반/리스트, 상태 변경, 담당자 배정, 마감일)
- [ ] ⑦ 피드백 (`ticket_feedback`)

### Phase 7 — 공지·릴리즈 (1~2일)
- [ ] `notices` 스키마
- [ ] NT-01 공지 목록·상세 (제품 태그, 상단 고정)
- [ ] NT-03 긴급 배너 자동 노출/해제

### Phase 8 — 챗봇 임베드 (1일)
- [ ] CB-01 oachat.ai iframe 임베드 (전 페이지 우하단 플로팅)
- [ ] 장애 시 fallback (직접 접수 CTA)

### Phase 9 — 어드민 마스터 데이터 (3~4일)
- [ ] `/admin/master` 라우트 그룹
- [ ] 카테고리 관리 (제품/유형/긴급도/영향범위 탭)
- [ ] 이슈 접수 폼 필드 (제품별 동적 필드)
- [ ] 알림 템플릿 (SMS/이메일, 이벤트별)
- [ ] 시스템 설정 (key-value)
- [ ] 호텔 마스터 (이미 Phase 1에서 일부)

### Phase 10 — 배포·검증 (1~2일)
- [ ] Vercel 프로덕션 환경변수 설정
- [ ] 커스텀 도메인 연결 (`support.oapms.com`)
- [ ] 보안 헤더·Rate Limit 적용 확인
- [ ] E2E 테스트 (Playwright) — 사용자 요청 시
- [ ] 운영 매뉴얼 작성 (`docs/dev-logs/`)

---

## 9. MVP 완료 기준 (P1)

> 아래 항목이 모두 충족되면 MVP 출시 가능.

- [ ] 호텔리어가 SSO로 로그인 → 본인 호텔 프로필 확인·수정
- [ ] 호텔리어가 통합 검색·핸드북·FAQ·체크리스트로 자가 해결 가능
- [ ] 호텔리어가 챗봇으로 대화 가능 (oachat.ai 임베드)
- [ ] 호텔리어가 3단계 폼으로 이슈 접수, 첨부파일 업로드, SMS/이메일 접수확인 수신
- [ ] 호텔리어가 내 문의에서 처리 상태 확인, 추가 답변 작성
- [ ] 매니저가 슬랙 알림 받고, 티켓 큐에서 상태 변경·담당자 배정·내부 메모·Dev 에스컬
- [ ] 상태 전환 시 호텔리어에게 SMS/이메일 자동 발송
- [ ] 어드민이 사용자 계정 생성·권한 변경·비번 초기화
- [ ] 어드민이 카테고리·폼 필드·알림 템플릿·시스템 설정 편집
- [ ] 모바일에서 모든 화면이 정상 작동 (날것의 페이지 없음)
- [ ] `activity_logs`에 주요 액션 기록
- [ ] Vercel 프로덕션 배포, `support.oapms.com` 접속 가능

---

## 10. P2/P3 백로그 (MVP 이후)

- LP-03/04 서비스상태·최근업데이트 위젯 고도화
- SS-04 인기검색어·자주찾는작업 자동 집계
- SS-05 역할별 시작하기
- SS-07 (AI) 게시물 포맷 최적화
- SF-03 빠른 해결 가이드 30초 카드
- SF-05 (AI) 클레임 분석 기반 콘텐츠 보강
- CB-04 챗봇 → 접수 pre-fill
- IC-05 챗봇 경유 접수 (호텔 매핑)
- IC-09~11 (AI) 작성보조·정보칩·체크리스트 추출
- IS-05 엑셀 다운로드
- IS-06 SMS/이메일 수동 발송
- DI-01~05 Data Insight 전체
- NT-02 릴리즈 노트
- Monday.com 과거 이력 이관

---

## 11. 결정 대기 사항 (사용자 확인 필요)

| # | 항목 | 영향 Phase | 비고 |
|:-:|:-|:-:|:-|
| 1 | OA 메인 컬러 (브랜드) | Phase 0 | 우선 indigo로 시작, 추후 교체 |
| 2 | OA PMS 호텔 계정 매핑 정책 (SSO claim 구조) | Phase 1 | SSO Provider 응답 명세 필요 |
| 3 | help.oapms.com 마이그레이션 방식 | Phase 3 | API 색인 vs 전체 이관 vs 하이브리드 |
| 4 | 발신 이메일 주소 (`support@oapms.com`?) | Phase 1 | SES 도메인 검증 필요 |
| 5 | 솔라피 발신번호 | Phase 1 | 사전 등록된 번호 |
| 6 | Slack Webhook URL 3개 | Phase 5 | `#as-new`, `#as-urgent`, `#dev-escalation` |
| 7 | oachat.ai 임베드 URL 및 인증 방식 | Phase 8 | 외부 도구 연동 |
| 8 | Neon 프로젝트/브랜치 분리 정책 (dev/preview/prod) | Phase 0 | Vercel preview마다 별도 브랜치? |
