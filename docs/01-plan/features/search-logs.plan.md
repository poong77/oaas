# search-logs — Plan

> **Feature**: 어드민 > 인사이트 > 검색로그 — 호텔리어 실사용 검색 이력 열람
> **Phase**: Plan (PDCA)
> **작성일**: 2026-06-01
> **상태**: ✅ APPROVED — Design 단계 진입 가능 (Q-1~Q-4 결정 완료)

---

## Executive Summary

| 관점 | 내용 |
|:-|:-|
| **Problem** | 호텔리어가 무엇을 검색하고, 머물렀고, 도움을 받았는지(또는 못 받고 이탈/접수했는지)를 운영팀이 한 화면에서 추적할 방법이 없다. 기존 `/admin/master/search-quality`는 집계 지표(Hit@3·CTR·0건율)는 보여주지만 **개별 검색 1건의 여정**은 보이지 않는다. |
| **Solution** | `search_logs` 테이블(기존)을 1행=1회 검색으로 펼쳐 **유입 키워드·유입일시·세션 체류시간·도움됨 반응표·유출 페이지 URL** 5컬럼으로 나열. 사이드바에 **인사이트** 그룹을 신설하고 **검색로그** 메뉴를 추가한다. |
| **Function UX Effect** | 어제(1일)/최근 7일/최근 30일 KST 기준 기간 필터 + 4개 요약 통계(검색 수·클릭·티켓 전환·결과없음) + 데스크탑 테이블/모바일 카드뷰/EmptyState + 페이지네이션. 클릭해 도착한 아티클·FAQ 하단 "👍/👎" 반응표를 행마다 집계 표시. |
| **Core Value** | 검색 품질 개선의 **정성적 근거**를 제공한다. 어떤 키워드가 0건으로 이탈했는지, 클릭한 콘텐츠가 실제로 도움됐는지(반응표)를 운영팀이 직접 보고 콘텐츠·동의어·라우팅을 개선할 수 있다. |

---

## 1. 배경 (Why)

### 1.1 발견된 문제

- **집계만 있고 개별 여정이 없음**: `/admin/master/search-quality`(커밋 43f0c9c, 5befc88)는 Hit@3/MRR/nDCG + 0건율/CTR/deflection 등 **집계 대시보드**다. 하지만 "어제 누군가 '체크인 안됨'을 검색하고 8초 머문 뒤 이탈했다"는 **개별 행 단위 신호**는 볼 수 없다.
- **반응표 데이터가 검색 맥락과 단절**: 아티클/FAQ 하단의 "도움됐어요/아니예요"(`articles.helpful_yes/no`, `faqs.helpful_yes/no`)는 콘텐츠 페이지에만 표시되고, **어떤 검색을 통해 그 페이지에 도달했는지**와 연결되지 않는다.
- **CLAUDE.md 인사이트 영역 부재**: 사이드바는 tickets/content/org 3그룹뿐. Data Insight를 담을 **인사이트** 그룹이 없다.

### 1.2 데이터 자산 현황 (이미 존재 — 신규 스키마 불필요)

| 자산 | 위치 | 검색로그에서의 용도 |
|:-|:-|:-|
| `search_logs` | `db/schema/search-logs.ts` | 1행=1회 검색. query/createdAt/clicked/clickedKind/clickedRef/ledToTicket/sessionKey/zeroResult |
| `articles.helpful_yes/no` | `db/schema/articles.ts:131-132` | clickedKind='help' → slug 조인 → 반응표 |
| `faqs.helpful_yes/no` | `db/schema/faqs.ts:46-47` | clickedKind='faq' → id 조인 → 반응표 |
| `sessionKey` 인덱스 | `search_logs_session_idx` | 세션 체류시간 LEAD 윈도우 산출 |

→ **DB 스키마 변경 0건**. 기존 자산을 조회 전용으로 펼치는 리드-온리 기능이다.

---

## 2. Goals (G1~G5)

| ID | Goal | 측정 기준 |
|:-:|:-|:-|
| **G1** | 어드민 > 인사이트 > 검색로그 페이지 신설 — 검색 1행=1회 나열 | `/admin/insights/search-logs` 진입 시 5컬럼 테이블 표시 |
| **G2** | 5개 컬럼: 유입 키워드 / 유입일시 / 세션 체류시간 / 도움됨 여부 / 유출 채널(페이지 URL) | 각 컬럼 정의대로 표시 |
| **G3** | 기간 필터 3종: 어제(1일) / 최근 7일 / 최근 30일 — 모두 "어제"가 끝(오늘 제외, KST) | `?period=` 토글 + KST 자정 정렬 [start,end) |
| **G4** | "도움됨" = 클릭해 도착한 아티클/FAQ 하단 반응표(👍/👎) 집계 표시 | clickedKind별 배치 조인으로 helpful_yes/no 표시 |
| **G5** | 사이드바 "인사이트" 그룹 신설 + "검색로그" 메뉴 등록 | nav-items 'insight' 그룹 + GROUP_ORDER/LABEL 갱신 |

---

## 3. Non-Goals (이번 Phase에서 안 함)

- 검색로그 **편집/삭제** — 읽기 전용. 로그는 불변 이력(soft delete 컬럼은 `is_active=true` 필터로만 사용).
- 키워드/세션/도움됨 기준 **정렬·검색 필터** — 기간 필터 + createdAt DESC 고정. (정렬 옵션은 후속 Phase)
- CSV/엑셀 **내보내기** — 후속 Phase.
- 검색어별 집계·차트 — 이미 `/admin/master/search-quality`가 담당. 본 기능은 **개별 행 나열**에 집중.
- 실시간(오늘) 집계 — 정의상 "어제"까지만. 오늘은 진행 중이라 제외.
- 호텔리어/매니저별 필터 — 후속 Phase.

---

## 4. Scope — 작업 항목 (P0/P1)

### 4.1 P0 (필수)

| ID | 항목 | 영향 파일 |
|:-:|:-|:-|
| **P0-A** | `listSearchLogs({period,page,pageSize})` 서비스 함수 추가 | `lib/services/search-logs.ts` 수정 |
| **P0-B** | 기간 → KST 자정 [start,end) 경계 헬퍼 (`kstPeriodRange`) | 위 동일 |
| **P0-C** | 세션 체류시간 — 같은 sessionKey 내 LEAD 윈도우로 다음 활동까지 간격(초) | 위 동일 |
| **P0-D** | 도움됨 반응표 — clicked + clickedKind('help'/'faq') 배치 조인 집계 | 위 동일 |
| **P0-E** | 유출 URL 복원 — clickedKind/clickedRef → 페이지 경로 역산 (`buildOutflow`) | 위 동일 |
| **P0-F** | 요약 통계 — total/clicks/ticket/zero | 위 동일 |
| **P0-G** | 검색로그 페이지 (서버 컴포넌트, requireRole) | `app/(admin)/admin/insights/search-logs/page.tsx` 신규 |
| **P0-H** | 기간 필터 클라이언트 컴포넌트 (?period= 토글) | `_components/search-logs-filters.tsx` 신규 |
| **P0-I** | 리스트 클라이언트 — 테이블 + 모바일 카드뷰 + 반응표 + 페이지네이션 | `_components/search-logs-list-client.tsx` 신규 |
| **P0-J** | 사이드바 인사이트 그룹 + 검색로그 메뉴 | `app/(admin)/admin/_data/nav-items.ts` 수정 |

### 4.2 P1 (권장)

| ID | 항목 |
|:-:|:-|
| **P1-K** | `IMPLEMENTATION_PLAN.md`에 검색로그 기능/인사이트 그룹 반영 |
| **P1-L** | 4개 StatCard 요약 통계 (검색 수·클릭+CTR·티켓 전환·결과없음) |
| **P1-M** | 유출 URL 외부 링크(target=_blank) + 이탈/티켓 전환 라벨 구분 |

---

## 5. 컬럼 정의 (요구사항 정밀화)

| 컬럼 | 데이터 소스 | 산출 규칙 | null 처리 |
|:-|:-|:-|:-|
| **유입 키워드** | `search_logs.query` | 원본 검색어 그대로 | — |
| **유입일시** | `search_logs.created_at` | KST 포맷(`formatDateTimeKst`) | — |
| **세션 체류시간** | `sessionKey` + LEAD(`created_at`) | 같은 세션 내 다음 활동까지 간격(초). 다음 없으면 `updated_at`까지 | sessionKey null → "—", 음수 → null |
| **도움됨 여부** | `articles/faqs.helpful_yes/no` | clickedKind='help'→slug, 'faq'→id 조인. 👍N 👎N | 미클릭/반응표 없는 대상 → "—" 또는 "반응 없음" |
| **유출 채널(URL)** | clickedKind/clickedRef/ledToTicket | help→`/help/{product}/{slug}`, faq→`/faq#faq-{id}`, notice→`/notices/{id}`, incident→`/status`, 티켓→`/tickets/new` | 미클릭·미접수 → "— (이탈)" |

---

## 6. 리스크 (사전 식별)

| ID | 카테고리 | 리스크 | 완화책 |
|:-:|:-|:-|:-|
| **C1** | 시간대 | Vercel(UTC)에서 "어제" 경계가 KST와 어긋나 하루가 밀림 | `kstPeriodRange`가 KST 자정 기준 [start,end) 경계 계산 (`Asia/Seoul` toLocaleString) |
| **C2** | 성능 | 행마다 반응표 조회 시 N+1 | clicked help/faq의 ref를 모아 `inArray` 배치 조인 1회씩 (페이지당 2쿼리) |
| **C3** | 정확성 | 윈도우 함수(LEAD)가 페이지 경계(LIMIT/OFFSET)에서 끊겨 체류시간 오류 | LEAD는 WHERE 통과 전체 집합에 LIMIT 이전 평가 — 페이지 경계 무관 |
| **C4** | 데이터 무결성 | clickedRef가 가리키는 아티클/FAQ가 삭제됨 | 조인 결과 Map에서 미존재 → helpful null fallback (UI "—") |
| **E1** | 권한 | 검색로그는 운영 데이터 — 호텔리어 노출 금지 | `requireRole(['manager','admin'])` 페이지 가드 |
| **E2** | 일관성 | 리스트 쿼리 `is_active=true` 누락 | WHERE에 `eq(searchLogs.isActive, true)` 포함 (CLAUDE.md 원칙) |
| **R1** | 회귀 | 기존 search-logs.ts 집계 함수(getUsageStats 등) 영향 | 신규 함수만 추가, 기존 함수 무변경 |
| **R2** | 회귀 | 사이드바 그룹 추가로 기존 메뉴 순서/렌더 깨짐 | GROUP_ORDER 배열에 'insight'를 content와 org 사이 삽입, 기존 항목 무변경 |

---

## 7. 검증 기준 (Acceptance Criteria)

### 7.1 기능

- [ ] `/admin/insights/search-logs` 진입 시 5컬럼 테이블 표시
- [ ] 기간 버튼 어제/7일/30일 토글 시 `?period=` 갱신 + 데이터 변경
- [ ] 모든 기간이 "어제 00:00 KST"를 end로 — 오늘 검색은 제외
- [ ] 세션 체류시간이 같은 sessionKey 내 다음 활동까지 간격(초)으로 표시
- [ ] 클릭해 도착한 아티클/FAQ 행에 👍/👎 반응표 집계 표시
- [ ] 유출 URL이 clickedKind별 규칙대로 복원되어 외부 링크로 표시
- [ ] 미클릭·미접수 행은 "— (이탈)" 표시
- [ ] 4개 StatCard(검색 수/클릭+CTR/티켓 전환/결과없음) 표시
- [ ] 페이지네이션 동작 (30건/페이지)
- [ ] 빈 기간 시 EmptyState 표시

### 7.2 코드 품질

- [ ] 리스트 쿼리에 `is_active=true` 포함
- [ ] 반응표 조회 N+1 없음 (배치 inArray)
- [ ] DB 스키마 변경 0건
- [ ] `npx tsc --noEmit` 0 에러

### 7.3 디자인 (CLAUDE.md 4번)

- [ ] Card 래퍼 + PageHeader
- [ ] 데스크탑 테이블 + 모바일 카드뷰
- [ ] EmptyState
- [ ] 다크모드 대응
- [ ] window.confirm/alert 미사용 (읽기 전용이라 해당 없음)

### 7.4 회귀

- [ ] 기존 search-quality 대시보드 영향 0
- [ ] 사이드바 기존 메뉴 순서/렌더 정상

---

## 8. 전략 결정 사항 (2026-06-01 사용자 확정)

| ID | 결정 | 적용 |
|:-:|:-|:-|
| **Q-1** | ✅ **기간 필터는 "어제"가 항상 끝** (오늘 제외) | 오늘은 집계 진행 중 → KST 자정 정렬 end. 어제(1일)/어제~7일/어제~30일. |
| **Q-2** | ✅ **"도움됨" = 도착 페이지의 반응표(👍/👎) 집계** (사용자 정정) | clicked 페이지의 `articles/faqs.helpful_yes/no`를 집계 표시. 검색 1건 자체의 helpful 플래그가 아님. |
| **Q-3** | ✅ **사이드바 인사이트 그룹 신설** | nav-items에 'insight' TabGroup 추가, content와 org 사이. 라벨 '인사이트'. |
| **Q-4** | ✅ **읽기 전용** (편집/삭제/내보내기 없음) | 본 Phase는 조회만. 정렬·필터·CSV는 후속 Phase. |

---

## 9. 일정 추정

| 단계 | 작업 | 추정 |
|:-|:-|:-:|
| Plan | 본 문서 + Q-1~Q-4 | 즉시 |
| Design | 서비스 시그니처·SQL·UI 와이어프레임 | 20분 |
| Do — 서비스 | listSearchLogs + kstPeriodRange + buildOutflow | 40분 |
| Do — UI | 페이지 + 필터 + 리스트 클라이언트 | 40분 |
| Do — 사이드바 | nav-items 인사이트 그룹 | 10분 |
| Check | gap 분석 | 20분 |
| Report | 보고서 + Executive Summary | 20분 |
| **합계** | | **약 2.5시간** |

---

## 10. 다음 단계

1. ✅ Q-1~Q-4 결정 + 본 Plan 승인
2. → `/pdca design search-logs` (서비스 시그니처 + SQL + 와이어프레임)
3. → 구현 (P0 → P1)
4. → Check (gap-detector)
5. → Report

---

## 부록 A. 영향 받는 파일

### 신규 (4개)
- `app/(admin)/admin/insights/search-logs/page.tsx`
- `app/(admin)/admin/insights/search-logs/_components/search-logs-filters.tsx`
- `app/(admin)/admin/insights/search-logs/_components/search-logs-list-client.tsx`
- (서비스는 기존 파일에 함수 추가)

### 수정 (2개)
- `lib/services/search-logs.ts` (`listSearchLogs`·`kstPeriodRange`·`buildOutflow`·타입 추가)
- `app/(admin)/admin/_data/nav-items.ts` ('insight' 그룹 + 검색로그 NavItem + GROUP_ORDER/LABEL)
