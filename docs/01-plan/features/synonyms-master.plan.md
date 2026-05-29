# synonyms-master — Plan

> **Feature**: 동의어 사전 마스터 (호텔업계 용어 검색 보강)
> **Phase**: Plan (PDCA)
> **작성일**: 2026-05-29
> **선행 결정 (사용자 확정)**:
> - 통합AS 마스터 데이터 확장으로 진행 (별도 신규 PDCA 아님)
> - 사용 범위 3종: ① 호텔리어 셀프서치, ② 매니저 AS 티켓 검색, ③ 카테고리/태그 자동 매칭
> - 데이터 모델: 대표어(canonical) + 동의어 그룹 (term_groups + term_synonyms)
> **상태**: ✅ APPROVED (2026-05-29) — Q-1~Q-6 결정 완료. Design 단계 진입 가능

---

## 1. 배경 (Why)

### 1.1 발견된 문제

- **검색이 문자열 일치에만 의존** — SS-01 통합 검색·매니저 티켓 검색 모두 `ILIKE '%keyword%'` 기반. 호텔업계는 약어/한영혼용/외래어 표기 차이가 극심한데 이를 흡수할 장치가 없음.
  - 예: "CI" 검색 → "체크인" 아티클 못 찾음
  - 예: "하우스키핑" 검색 → "객실 청소" FAQ 못 찾음
  - 예: "F&B" 검색 → "식음료" 공지 못 찾음
- **카테고리/태그 자동 추천 불가** — 티켓 접수 시 본문에서 "PMS 예약 안 잡혀요" 입력해도 issue_type을 자동 매칭할 근거가 없음 (IC-10 (AI) 정보칩 추출의 비-AI fallback 부재).
- **CLAUDE.md 8번 원칙 미준수** — 마스터 데이터인데 어드민에서 편집할 메뉴가 없음. 코드 상수로 박혀있는 동의어가 전무.
- **외부 의존 위험** — oachat.ai 챗봇이 사용자 표현을 자체 학습한다 해도, 통합AS 내부 검색·자동 매칭은 별도 사전이 필요. 챗봇이 죽으면 셀프 검색도 빈약해짐.

### 1.2 현재 구조 진단

| 영역 | 현재 검색 방식 | 한계 |
|:-|:-|:-|
| 호텔리어 셀프서치 (`/search`, `/help`) | `articles.title/body ILIKE %kw%` | 약어/외래어 미흡수 |
| 매니저 티켓 검색 (`/admin/tickets`) | `tickets.title/body ILIKE %kw%` | 매니저가 "조식" 쳐도 "breakfast"로 들어온 티켓 못 찾음 |
| 카테고리 자동 매칭 | 없음 (수동 선택만) | 접수자 부담 |

→ **공통 인프라(동의어 사전)** 하나로 3종 검색을 모두 보강하는 것이 합리적.

---

## 2. Goals (G1~G6)

| ID | Goal | 측정 기준 |
|:-:|:-|:-|
| **G1** | `term_groups` + `term_synonyms` 마스터 테이블 신설 — 어드민에서 그룹/동의어 추가·수정·비활성 가능 | `/admin/master/synonyms` CRUD 동작 + 시드 50개 이상 그룹 |
| **G2** | 호텔리어 셀프서치(`/search`) 결과에 동의어 확장 적용 — "CI" 검색 시 "체크인" 결과 포함 | E2E: "CI" 검색 → 체크인 아티클 노출 |
| **G3** | 매니저 티켓 검색(`/admin/tickets?q=`)에 동의어 확장 적용 | E2E: "하우스키핑" 검색 → "객실 청소" 본문 티켓 노출 |
| **G4** | 카테고리/태그 자동 매칭 헬퍼 제공 — 본문에서 매칭된 그룹의 `suggested_category` 반환 | `suggestCategoriesFromText(text)` 함수가 그룹의 카테고리 매핑 반환 |
| **G5** | `/admin` 사이드바 master 메뉴에 "동의어 사전" 추가 + 메뉴 내 카테고리별 필터 | 어드민 메뉴 클릭 → 그룹 목록 로딩 |
| **G6** | 호텔업계 핵심 용어 50+ 그룹 시드 — 약어/한영/직무용어 포괄 | `db/seed.ts`에 카테고리별 시드 포함 |

---

## 3. Non-Goals (이번 Phase에서 안 함)

- **AI 기반 의미 검색 (벡터 임베딩)** — IC-10/DI-04로 분리. 본 Phase는 사전 매칭만.
- **다국어 동의어** — 한국어 + 영어(약어) 2개 언어만. 일본어/중국어는 P2 이후.
- **챗봇(oachat.ai) 연동** — 외부 챗봇 학습 데이터 export는 별도 Phase. 내부 검색만 우선.
- **인기 검색어(`popular_keywords`) 자동 동의어 등록** — 운영자 수동 등록만. 자동화는 P3.
- **검색 결과 랭킹/스코어링** — 단순 OR 확장만. 가중치 기반 정렬은 후속.
- **형태소 분석 (mecab, nori 등)** — 단순 토큰 매칭. 한글 형태소는 P2.

---

## 4. Scope — 작업 항목 (P0/P1)

### 4.1 P0 (필수)

| ID | 항목 | 영향 파일 |
|:-:|:-|:-|
| **P0-A** | `db/schema/term-groups.ts` + `db/schema/term-synonyms.ts` 신규 스키마 | 신규 2개 |
| **P0-B** | `db/seed.ts` 호텔업계 용어 50+ 그룹 시드 | 수정 1개 |
| **P0-C** | `lib/services/master-synonyms.ts` CRUD 서비스 (그룹 CRUD + 그룹 내 동의어 N개 관리) | 신규 1개 |
| **P0-D** | `lib/services/synonym-expander.ts` 검색 확장 헬퍼 — `expandKeywords(kw)` 가 동의어 배열 반환 | 신규 1개 |
| **P0-E** | `app/actions/master-synonyms-actions.ts` Server Actions | 신규 1개 |
| **P0-F** | `/admin/master/synonyms` 페이지 3종 (목록·신규·상세 — 상세에서 동의어 N개 편집) | 신규 4개 |
| **P0-G** | 호텔리어 셀프서치(`/search`) 동의어 확장 적용 | 수정 1개 |
| **P0-H** | 매니저 티켓 검색(`/admin/tickets`) 동의어 확장 적용 | 수정 1~2개 |
| **P0-I** | `/admin` 사이드바 master 메뉴에 "동의어 사전" 추가 | 수정 1개 |

### 4.2 P1 (권장)

| ID | 항목 |
|:-:|:-|
| **P1-J** | `lib/services/category-suggester.ts` — 본문 → 카테고리 추천 함수 (티켓 접수 폼에서 사용) |
| **P1-K** | 티켓 접수 폼(`/tickets/new`) 본문 입력 시 추천 카테고리 칩 자동 노출 (DEBOUNCE 500ms) |
| **P1-L** | 어드민 동의어 화면에 "검색 미스 키워드" 패널 — 검색 후 결과 0건 키워드 자동 수집 (popular_keywords 활용) |
| **P1-M** | CSV 일괄 업로드 — 그룹+동의어 일괄 등록 (어드민 운영 효율) |
| **P1-N** | `IMPLEMENTATION_PLAN.md` 갱신 — SS-01 부속 마스터로 명시 |

---

## 5. DB 설계 (예비)

### 5.1 `term_groups` 테이블 (대표어/그룹)

```ts
// db/schema/term-groups.ts
import { integer, pgEnum, pgTable, text, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';

/** 동의어 그룹 분류 — 어드민 필터/검색 용도 */
export const termGroupCategoryEnum = pgEnum('term_group_category', [
  'operation',     // 운영: 체크인/체크아웃/예약/객실/요금 등 일반 호텔 운영
  'housekeeping',  // 청소: 하우스키핑/객실 청소/턴다운/린넨
  'fnb',           // 식음료: F&B/조식/룸서비스/미니바
  'frontdesk',     // 프런트: FD/리셉션/컨시어지
  'pms',           // PMS 관련 용어: 룸 차지/배정/오버부킹
  'product',       // OA 제품명/모듈 (PMS/CMS/Keyless/Kiosk)
  'issue',         // 장애 유형: 결제 실패/네트워크 끊김/카드 미인식
  'role',          // 직무: 매니저/객실팀장/F&B팀장
  'misc',          // 기타
]);

export const termGroups = pgTable(
  'term_groups',
  {
    ...commonColumns(),
    /** 대표어 (사용자 노출용 표준 한글 표현) */
    canonicalTerm: text('canonical_term').notNull(),
    /** 분류 (필터·관리용) */
    category: termGroupCategoryEnum('category').notNull().default('misc'),
    /** 설명 (운영자 메모) */
    description: text('description'),
    /** 카테고리 자동 매칭 시 추천할 categories.id (issue_type/product 등) — nullable */
    suggestedCategoryId: text('suggested_category_id'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    uniqueIndex('term_groups_canonical_uq').on(table.canonicalTerm),
    index('term_groups_category_idx').on(table.category),
  ],
);

export type TermGroup = typeof termGroups.$inferSelect;
export type NewTermGroup = typeof termGroups.$inferInsert;
```

### 5.2 `term_synonyms` 테이블 (그룹 내 동의어 N개)

```ts
// db/schema/term-synonyms.ts
import { integer, pgTable, text, uuid, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { termGroups } from './term-groups';

export const termSynonyms = pgTable(
  'term_synonyms',
  {
    ...commonColumns(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => termGroups.id, { onDelete: 'cascade' }),
    /** 동의어 원본 (대소문자/공백 보존). 검색 시 lower() + trim() 비교 */
    term: text('term').notNull(),
    /** 'ko' | 'en' (P0). 'ja'/'zh' 는 P2 */
    language: text('language').notNull().default('ko'),
    /** 검색 가중치 (0~10). 미사용 시 5 기본. 현재는 보관만, 랭킹은 후속 */
    weight: integer('weight').notNull().default(5),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    // 같은 그룹 안에서는 (term, language) 중복 불가
    uniqueIndex('term_synonyms_group_term_uq').on(
      table.groupId,
      table.term,
      table.language,
    ),
    // 전체 검색용 — 동일 term이 여러 그룹에 등록될 수 있음 (다의어). 그룹별로만 unique.
    index('term_synonyms_term_idx').on(table.term),
    index('term_synonyms_group_idx').on(table.groupId),
  ],
);

export type TermSynonym = typeof termSynonyms.$inferSelect;
export type NewTermSynonym = typeof termSynonyms.$inferInsert;
```

**비고**:
- `canonical_term` 자체는 `term_synonyms`에 자동 INSERT 하지 않음. 대신 검색 헬퍼에서 항상 canonical을 포함하여 확장 (`[canonical, ...synonyms]`).
- `term`은 lowercase 비교를 위해 인덱스에 `lower(term)`을 사용할지 결정 필요 → **Q-4 참고**
- `language` 컬럼은 enum 대신 text — 향후 'ja'/'zh' 추가 시 마이그레이션 부담 줄임
- 그룹 간 다의어 허용: "CI"가 'check-in' 그룹과 'continuous integration' 그룹에 각각 등록 가능. 검색 시 양쪽 모두 확장 (도메인이 호텔이라 후자는 거의 없겠지만 구조적으로 막지 않음)

### 5.3 검색 확장 헬퍼 (P0-D)

```ts
// lib/services/synonym-expander.ts
/**
 * 입력 키워드를 동의어 그룹으로 확장.
 *
 * 1. 입력 키워드를 모든 그룹의 canonical/synonym에서 매칭 (lowercase 비교)
 * 2. 매칭된 모든 그룹의 canonical + 모든 synonym 수집
 * 3. 중복 제거 후 배열 반환 (입력 키워드는 항상 포함)
 *
 * @example
 *   await expandKeywords('CI') // → ['CI', '체크인', 'check-in', '입실']
 *   await expandKeywords('하우스키핑') // → ['하우스키핑', '객실 청소', 'housekeeping', 'HK']
 *   await expandKeywords('전혀 모르는 단어') // → ['전혀 모르는 단어'] (확장 없음)
 */
export async function expandKeywords(input: string): Promise<string[]>;
```

호출처:
- `app/search/page.tsx` (셀프서치) — `expandKeywords(q)` 후 articles/faqs/notices 검색에 OR 적용
- `app/(admin)/admin/tickets/page.tsx` — 매니저 티켓 검색에 OR 적용

### 5.4 시드 후보 (G6 — 호텔업계 핵심 용어)

> 정확한 단어는 Design 단계에서 운영팀 검수 후 확정. 아래는 초안 카테고리별 그룹 예시.

```
[operation]
- 체크인 ← CI, check-in, 입실
- 체크아웃 ← CO, check-out, 퇴실
- 예약 ← reservation, booking, 부킹
- 객실 ← room, 룸, 호실, 방
- 요금 ← rate, 가격, ADR, 단가
- 노쇼 ← no-show, 미투숙
- 워크인 ← walk-in, 현장 투숙
- 얼리 체크인 ← early CI, ECI, 조기 입실
- 레이트 체크아웃 ← late CO, LCO, 늦은 퇴실

[housekeeping]
- 객실 청소 ← 하우스키핑, housekeeping, HK, 청소
- 턴다운 ← turn-down, 야간정리
- 린넨 ← linen, 침구
- 객실 점검 ← inspection, 인스펙션, 룸체크
- 미니바 ← minibar, MB

[fnb]
- 조식 ← breakfast, BF, 아침
- 룸서비스 ← room service, RS, 인룸 다이닝, in-room dining
- 식음료 ← F&B, FB, food and beverage
- 라운지 ← lounge, 라운지바

[frontdesk]
- 프런트 ← FD, front desk, 리셉션, reception
- 컨시어지 ← concierge
- 벨맨 ← bellman, bell, 벨보이
- 게스트 ← guest, 고객, 손님, 투숙객

[pms]
- 룸 배정 ← room assignment, 배방
- 룸 차지 ← room charge, 룸챠지, 객실 청구
- 오버부킹 ← overbooking, OB, 초과예약
- 객실 등급 ← room type, RT, 룸타입
- 점유율 ← occupancy, OCC, 객실 점유율
- 객단가 ← ADR, average daily rate
- 매출/객실 ← RevPAR, 레브파

[product]
- PMS ← Property Management System, 자산관리시스템, OA PMS
- CMS ← Channel Manager, 채널매니저, 채널관리시스템
- Keyless ← 키리스, 모바일키, mobile key, 무인체크인
- Kiosk ← 키오스크, 무인 단말
- 웹서비스 ← booking engine, 부킹엔진, BE

[issue]
- 결제 실패 ← payment failed, 결제 오류, 결제 안됨, 카드 거절
- 네트워크 끊김 ← network down, 인터넷 끊김, 통신 장애, 망 장애
- 카드 미인식 ← card not detected, 키카드 인식 안됨, 키 인식 오류
- 동기화 오류 ← sync error, 싱크 오류, 동기화 실패
- 로그인 안됨 ← login failed, 로그인 오류, 로그인 안 됨

[role]
- 매니저 ← MGR, manager, 책임자
- 객실팀장 ← housekeeping manager, HKM, 하우스키핑 매니저
- F&B 매니저 ← FBM, 식음료 매니저
- 총지배인 ← GM, general manager, 지배인
```

→ **약 50개 그룹 × 평균 3개 동의어 = 약 150~200 row** 수준.

---

## 6. 리스크 (사전 식별)

| ID | 카테고리 | 리스크 | 완화책 |
|:-:|:-|:-|:-|
| **C1** | 성능 | 모든 검색마다 `term_synonyms` 전체 스캔 시 느려짐 | (1) `unstable_cache` 5분 TTL로 in-memory 사전 캐싱, (2) 전체 row 1000개 이하일 때는 메모리 매칭으로 충분 |
| **C2** | 정확도 | 동의어 OR 확장이 검색 결과를 오히려 노이즈로 채움 | (1) 그룹별 동의어 수 제한 권고 (10개 이하), (2) 단어 길이 2자 이상만 매칭 — 1자 토큰("CI"가 "Ci"와 우연 매칭) 회피는 Q-3 |
| **C3** | 다의어 충돌 | "키" → 모바일 키 vs 키워드 vs 키 자재 — 의도 분리 어려움 | 그룹은 도메인별로 분리(`category` 필터). 검색 시 카테고리 컨텍스트 있을 때 같은 카테고리만 우선 확장 (P1 이후) |
| **D1** | UX | 어드민이 그룹/동의어 두 단계 편집을 번거로워함 | 그룹 상세 페이지에서 inline으로 동의어 N개 입력 (tags input 컴포넌트) — Design 단계 확정 |
| **D2** | UX | 동의어 중복 입력 (그룹A에 "CI" + 그룹B에 "CI") 의도/실수 구분 | 동일 term이 여러 그룹에 존재 시 어드민 화면에서 경고 토스트 (저장은 허용) |
| **E1** | 보안 | 일반 사용자가 동의어 사전을 직접 조회/수정 가능하면 SQL 인젝션 등 우려 | 어드민 권한만 CRUD, 일반은 read-only 검색 헬퍼만 사용. 입력은 Zod (length ≤ 60자) |
| **E2** | 데이터 정합성 | `suggestedCategoryId`가 `categories.id` FK가 없으므로 삭제된 카테고리 가리킬 수 있음 | (a) FK 검 (단 categories는 soft delete만 사용) 또는 (b) 조회 시 join으로 검증. **Q-5** |
| **E3** | 운영 | 동의어 사전 운영 책임자 미정 — 누가 시드 검수/운영하나? | Plan 승인 시 사용자(또는 OA 운영팀)에게 책임자 지정 요청 |
| **R1** | 회귀 | 기존 검색 결과가 동의어 확장으로 갑자기 늘어 사용자가 혼란 | 검색 결과 헤더에 "동의어 포함" 토글 (기본 ON) — P1-J 검토 |
| **R2** | 회귀 | E2E 검색 테스트(있다면)가 깨질 수 있음 | 시드 동의어로 인한 결과 증가는 정상 동작. 테스트 기대치 조정 |

---

## 7. 검증 기준 (Acceptance Criteria)

### 7.1 기능

- [ ] 어드민이 `/admin/master/synonyms`에서 그룹 신규 추가 가능 (대표어 + 카테고리 + 추천 카테고리)
- [ ] 그룹 상세에서 동의어 N개 inline 추가/수정/삭제 가능
- [ ] 그룹 비활성(soft delete) — 비활성 그룹은 검색 확장에서 제외
- [ ] 호텔리어가 `/search?q=CI`로 검색 → 체크인 관련 아티클 결과 노출
- [ ] 매니저가 `/admin/tickets?q=하우스키핑` 검색 → 본문에 "객실 청소" 들어간 티켓 노출
- [ ] `expandKeywords('CI')` → `['CI', '체크인', 'check-in', '입실']` 반환 (순서 무관, set 비교)
- [ ] 매칭 없는 키워드 입력 시 입력 키워드만 반환 (확장 없이도 정상 동작)
- [ ] 시드 50개 그룹 이상 + 카테고리별 분포 골고루

### 7.2 코드 품질

- [ ] `expandKeywords` 호출 시 단일 DB 조회 또는 캐시 사용 (페이지 1회 호출 = N+1 없음)
- [ ] grep `ILIKE '%${q}%'` 호출처 — 검색 페이지에서 동의어 확장 거치도록 통일
- [ ] TypeScript 에러 0건
- [ ] Lint 통과

### 7.3 회귀

- [ ] 기존 E2E (`ticket-channels-master`, `role-mode-ui`) 영향 없음 — 검색 로직 변경분에 한정
- [ ] 통합 홈(`/`) 등 검색 외 페이지 동작 변경 없음

---

## 8. 전략 결정 사항 (2026-05-29 사용자 확정)

| ID | 결정 | 적용 |
|:-:|:-|:-|
| **Q-1** | ✅ **정확 일치 (token == term)** | 검색어를 공백/구두점으로 분리 후 각 토큰이 lower(term)과 정확 매칭될 때만 확장. `expandKeywords` 구현 시 partial match 금지. |
| **Q-2** | ✅ **lower() + trim() 비교** | 그룹/동의어 저장 시 원본 보존, 매칭 시점에 lowercase + trim. "CI" == "ci", " 체크인 " == "체크인" 동일시. |
| **Q-3** | ✅ **2자 이상 토큰만 매칭** | `expandKeywords` 시 1자 토큰은 확장에서 제외. 'FD'/'GM'/'CI'(2자) 약어는 정상 허용. |
| **Q-4** | ✅ **raw text 인덱스 + 메모리 캐시** | `term_synonyms.term` 일반 btree 인덱스 + `unstable_cache` 5분 TTL. row 1000개 이하 가정. 향후 함수 인덱스로 전환 여지 명시. |
| **Q-5** | ✅ **FK 없이 nullable text** | `term_groups.suggested_category_id` 는 text. categories.id 참조만, FK 제약 없음. 조회 시 join으로 정합성 보강. |
| **Q-6** | ✅ **Claude 초안 → 사용자 검수** | 5.4 시드 후보를 Design 단계에서 확정안으로 정리 → 사용자 검수 → seed.ts 반영. 운영 중 추가는 어드민 UI. |

---

## 9. 일정 추정

| 단계 | 작업 | 추정 시간 |
|:-|:-|:-:|
| Plan 확정 | 본 문서 + Q-1~Q-6 결정 | 사용자 확인 |
| Design | DB 스키마 확정, 페이지 와이어프레임, 검색 통합 지점 명세 | 40분 |
| Do — DB | 스키마 2개 + 마이그레이션 | 20분 |
| Do — 시드 | 50+ 그룹 시드 작성·검수 | 60분 |
| Do — 서비스 | CRUD service + expand 헬퍼 + Server Actions | 60분 |
| Do — 어드민 UI | master/synonyms 4 페이지 (목록·신규·상세·inline 동의어 편집) | 90분 |
| Do — 검색 통합 | 셀프서치 + 매니저 티켓 검색 (2 페이지) | 40분 |
| Do — 사이드바 | master 메뉴 추가 | 10분 |
| Check | gap-detector + 검색 결과 시각 확인 | 30분 |
| Report | 보고서 + Executive Summary | 20분 |
| **합계** | | **약 6~7시간** |

---

## 10. 다음 단계

1. **사용자 확인**: Q-1~Q-6 옵션 결정 + 본 Plan 승인
2. → `/pdca design synonyms-master` (DB 스키마 확정 + UI 와이어프레임 + 시드 초안)
3. → 구현 (P0 → P1 순서)
4. → Check (gap-detector + 시각 회귀)
5. → Report

---

## 부록 A. 영향 받는 파일 (구현 시 변경 예상)

### 신규 (10개)
- `db/schema/term-groups.ts`
- `db/schema/term-synonyms.ts`
- `lib/services/master-synonyms.ts`
- `lib/services/synonym-expander.ts`
- `lib/services/category-suggester.ts` (P1)
- `app/actions/master-synonyms-actions.ts`
- `app/(admin)/admin/master/synonyms/page.tsx`
- `app/(admin)/admin/master/synonyms/new/page.tsx`
- `app/(admin)/admin/master/synonyms/[id]/page.tsx`
- `app/(admin)/admin/master/synonyms/_components/group-form.tsx`
- `app/(admin)/admin/master/synonyms/_components/synonyms-editor.tsx` (inline N개 편집)

### 수정 (5~6개)
- `db/schema/index.ts` (export 추가)
- `db/seed.ts` (시드 추가)
- `app/search/page.tsx` (호텔리어 셀프서치 — 동의어 확장 적용)
- `app/(admin)/admin/tickets/page.tsx` 또는 검색 헬퍼 (매니저 티켓 검색)
- `app/(admin)/admin/_components/sidebar.tsx` (또는 동등 메뉴 파일)
- `docs/IMPLEMENTATION_PLAN.md` (SS-01 부속 마스터 정의 추가)

---

## 부록 B. 다른 마스터와의 관계

| 마스터 | 관계 | 비고 |
|:-|:-|:-|
| `categories` (product/issue_type/urgency/impact) | `term_groups.suggestedCategoryId`로 약 참조 | FK 없음 (Q-5) |
| `ticket_channels` | 무관 | 채널과 검색은 별개 도메인 |
| `popular_keywords` (P2) | 보완 관계 | 인기 검색어 → 동의어 등록 후보 자동 추출 (P1-L) |
| `notification_templates` | 무관 | 알림 본문 내용은 검색 대상 아님 |
| `quick_actions` | 약한 관계 | 자주찾는작업 라벨도 검색에 포함될 수 있음 (P2) |
