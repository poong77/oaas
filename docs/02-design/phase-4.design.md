# Phase 4 Design — 셀프 픽스 (SF)

> **범위**: SF-01 FAQ 목록, SF-02 트러블슈팅 체크리스트, SF-04 어드민 콘텐츠 관리.
> **선행 Phase**: Phase 3 (셀프 서치 — 아티클·도움말·검색 통합) 완료.
> **다음 Phase**: Phase 5 (이슈 클레임 — Slack 연동 본격 사용).

---

## 1. 목표

호텔리어가 OA 운영팀에 접수하기 전에 **스스로 문제를 해결**할 수 있는 셀프 픽스 경로를 완성한다.

- **FAQ (SF-01)**: 짧은 질문 → 답변. 아코디언으로 빠르게 탐색.
- **트러블슈팅 (SF-02)**: 다단계 분기 진단. "해결됨" / "접수 필요" 결과 도출.
- **어드민 (SF-04)**: 매니저+어드민이 FAQ·체크리스트를 추가/편집/정렬.

---

## 2. DB 스키마

### 2.1 `faqs`

| 컬럼 | 타입 | 기본값 | 비고 |
|:-|:-|:-:|:-|
| `id` | uuid | gen_random_uuid() | PK |
| `product_code` | text | — | NOT NULL. `categories(type='product').code` 참조 (FK 없음, 카테고리 마스터 변경 유연성) |
| `issue_type` | text | NULL | `categories(type='issue_type').code` (nullable) |
| `question` | text | — | NOT NULL |
| `answer_markdown` | text | — | NOT NULL. react-markdown 렌더 |
| `sort_order` | integer | 0 | 작을수록 위 |
| `view_count` | integer | 0 | 펼침 시 +1 (fire-and-forget) |
| `helpful_yes` | integer | 0 | 도움됨 counter |
| `helpful_no` | integer | 0 | 도움 안 됨 counter |
| `created_at`, `updated_at`, `is_active` | — | — | 공통 컬럼 |

**인덱스**
- `faqs_product_sort_idx` on `(product_code, sort_order)`
- `faqs_active_product_idx` on `(is_active, product_code)`

> `faq_feedback` 테이블은 Phase 4에서는 생략. 단순 counter만 유지. Phase 6+ 데이터 분석 시 필요해지면 추가.

### 2.2 `checklists`

| 컬럼 | 타입 | 기본값 | 비고 |
|:-|:-|:-:|:-|
| `id` | uuid | gen_random_uuid() | PK |
| `product_code` | text | — | NOT NULL |
| `issue_type` | text | NULL | nullable |
| `title` | text | — | NOT NULL |
| `description` | text | NULL | 한 줄 요약 |
| `sort_order` | integer | 0 | — |
| `view_count` | integer | 0 | 진입 시 +1 |
| `resolved_count` | integer | 0 | "해결됨"으로 끝까지 도달 횟수 |
| `escalated_count` | integer | 0 | "접수하기" 분기 횟수 |
| 공통 컬럼 | — | — | — |

**인덱스**
- `checklists_product_sort_idx` on `(product_code, sort_order)`
- `checklists_active_product_idx` on `(is_active, product_code)`

### 2.3 `checklist_steps`

| 컬럼 | 타입 | 기본값 | 비고 |
|:-|:-|:-:|:-|
| `id` | uuid | gen_random_uuid() | PK |
| `checklist_id` | uuid | — | FK → `checklists.id` ON DELETE CASCADE |
| `step_no` | integer | — | 1, 2, 3, ... 같은 체크리스트 내 unique |
| `title` | text | — | 단계 질문/제목 |
| `body_markdown` | text | NULL | 부가 설명 (선택) |
| `condition_yes_action` | enum | — | `'next' \| 'resolved' \| 'escalate'` |
| `condition_no_action` | enum | — | 동일 |
| `yes_label` | text | '예' | 버튼 라벨 |
| `no_label` | text | '아니오' | 버튼 라벨 |
| 공통 컬럼 | — | — | — |

**enum 이름**: `checklist_step_action_kind` (테이블 이름과 충돌 회피)

**인덱스**
- `checklist_steps_unique_idx` UNIQUE on `(checklist_id, step_no)` — 같은 체크리스트에 step_no 중복 방지

---

## 3. 페이지 구조

### 3.1 공개 페이지

| 라우트 | 역할 | 비고 |
|:-|:-|:-|
| `/faq` (교체) | FAQ 목록 (아코디언) | 제품·유형 필터, view_count +1, 도움됨 위젯 |
| `/troubleshoot` (신규) | 트러블슈팅 허브 | 체크리스트 카드 리스트 |
| `/troubleshoot/[id]` (신규) | 체크리스트 진행 | 단계별 분기 진행, 결과 페이지 |

### 3.2 어드민 페이지

| 라우트 | 역할 | 권한 |
|:-|:-|:-:|
| `/admin/faqs` | FAQ 리스트 (필터·정렬·페이징) | 매니저+어드민 |
| `/admin/faqs/new` | FAQ 생성 폼 | — |
| `/admin/faqs/[id]` | FAQ 편집 폼 | — |
| `/admin/checklists` | 체크리스트 리스트 | 매니저+어드민 |
| `/admin/checklists/new` | 체크리스트 + 단계 일괄 편집 | — |
| `/admin/checklists/[id]` | 체크리스트 메타데이터 + 단계 편집 | — |

### 3.3 기존 페이지 보강

- `/search` — `tab=faq` 활성화 (faqs.question/answer ILIKE)
- `/` — `RecentUpdates` 또는 인기 FAQ 작은 보강 (큰 작업은 Phase 9에서)
- `/admin/*` 헤더 — admin-nav에 "FAQ", "체크리스트" 탭 추가

---

## 4. UI / UX 디테일

### 4.1 `/faq` (FAQ 목록)

- **아코디언 UI**: `<details><summary>` 활용 (서버 렌더 친화적). 동적 펼침 시 view counter는 client-side fetch.
- **URL 해시 자동 펼침**: `/faq#faq-{id}` 진입 시 해당 FAQ 자동 펼침 + 스크롤.
- **도움됨 위젯**: 펼침 후 표시. 로컬스토리지 `faqVoted:{id}` 키로 1회 차단.
- **EmptyState**: "조건에 맞는 FAQ가 없습니다 — [문의 접수](/tickets/new)"
- **필터**: 제품 (드롭다운) + 문제유형 (드롭다운).

### 4.2 `/troubleshoot` (허브)

- 카드 그리드 (sm: 1열, md: 2열, lg: 3열)
- 각 카드: 제품 뱃지, 제목, 설명, 단계 수, 해결률(%)
- 검색·필터·정렬

### 4.3 `/troubleshoot/[id]` (진행)

- 상단 progress bar: `현재 단계 / 전체 단계`
- 현재 단계 카드: title + body_markdown + yes/no 버튼
- 버튼 클릭 → client-side state 진행
  - `next` → 다음 step_no 카드로 전환
  - `resolved` → "🎉 해결되었습니다!" 결과 화면 (다시하기·홈으로 버튼 + Server Action으로 `resolved_count +1`)
  - `escalate` → "이슈 접수가 필요해요" 안내 화면 (접수 폼 안내 + `escalated_count +1`)
- 진입 시 `view_count +1` (fire-and-forget)
- Server Action은 `resolved_count` / `escalated_count` 카운터 업데이트만 담당

### 4.4 어드민 `/admin/faqs/*`

- 리스트: 질문(클릭→편집), 제품, 유형, 정렬순, 조회수, 도움됨 yes/no, 마지막 수정.
- 모바일: 카드뷰.
- 액션: 수정 / 비활성 / 복구 / 정렬순 위·아래 이동 (Server Action).
- 폼: 마크다운 split view 재사용 (article-editor 스타일).

### 4.5 어드민 `/admin/checklists/*`

- 리스트는 FAQ와 유사.
- `/admin/checklists/new` & `/admin/checklists/[id]`:
  - **상단**: 체크리스트 메타데이터 폼 (제목/설명/제품/유형/정렬).
  - **하단**: 단계 리스트 (CRUD). step_no 위/아래 화살표로 순서 변경. 단계별 제목/본문/yes-no action 편집 inline form.
  - 신규 체크리스트는 메타 저장 후 단계 편집 화면으로 전환.

---

## 5. Service / Server Actions

### 5.1 `lib/services/faqs.ts`

```ts
listFaqs({ productCode?, issueType?, q?, isActive?, sortBy?, sortOrder?, page?, pageSize? })
getFaqById(id)
incrementFaqView(id)                   // fire-and-forget
recordFaqHelpful(id, helpful: boolean) // counter only
// admin CRUD
createFaq, updateFaqById, archiveFaqById, restoreFaqById, moveFaqOrder(id, direction)
```

### 5.2 `lib/services/checklists.ts`

```ts
listChecklists({ ... })
getChecklistWithSteps(id)             // steps step_no 오름차순 포함
incrementChecklistView(id)
incrementChecklistResolved(id)
incrementChecklistEscalated(id)
// admin CRUD
createChecklist, updateChecklistById, archiveChecklistById, restoreChecklistById
// 단계 CRUD (트랜잭션)
upsertStep(checklistId, input)        // step_no 자동 할당
updateStep(stepId, input)
deleteStep(stepId)                    // 물리 삭제 불가 — is_active=false
moveStepOrder(stepId, direction)
```

### 5.3 Server Actions

- `app/actions/faq-actions.ts`
  - `submitFaqHelpfulAction(faqId, helpful)` — public
  - `bumpFaqViewAction(faqId)` — public
  - `createFaqAction / updateFaqAction / archiveFaqAction / restoreFaqAction / moveFaqOrderAction` — 매니저+어드민
- `app/actions/checklist-actions.ts`
  - `bumpChecklistViewAction(id)` / `markChecklistResolvedAction(id)` / `markChecklistEscalatedAction(id)` — public
  - `createChecklistAction / updateChecklistAction / archiveChecklistAction / restoreChecklistAction` — 어드민
  - `upsertStepAction / deleteStepAction / moveStepAction` — 어드민

---

## 6. 검색 통합 (SS-01 보강)

`searchArticles`처럼 `searchFaqs(q, productCode?)` 추가.
- `faqs.question ILIKE` OR `faqs.answer_markdown ILIKE`
- 활성 + (옵션) 제품 필터
- 결과 → `/faq#faq-{id}`로 링크 (URL 해시 자동 펼침)

`app/search/page.tsx`의 `tab='faq'`에서 placeholder 제거, 실제 결과 표시.

---

## 7. 감사 로그 (`activity_logs`)

| Action | Target | When |
|:-|:-|:-|
| `faq.create` | faq | 어드민 생성 |
| `faq.update` | faq | 어드민 수정 |
| `faq.archive` / `faq.restore` | faq | 비활성/복구 |
| `faq.move_order` | faq | 정렬순 변경 |
| `checklist.create` | checklist | — |
| `checklist.update` | checklist | — |
| `checklist.archive` / `checklist.restore` | checklist | — |
| `checklist.step.create` | checklist_step | 단계 추가 |
| `checklist.step.update` | checklist_step | 단계 수정 |
| `checklist.step.delete` | checklist_step | 단계 비활성 |
| `checklist.step.move` | checklist_step | step_no 변경 |

모두 fire-and-forget (`logActivity`).

---

## 8. 시드 데이터

### 8.1 FAQ (12개 — 각 제품 × 2개)

- pms × 2, cms × 2, keyless × 2, kiosk × 2, web × 2, config × 2
- idempotent: `(product_code, question)` 중복 시 skip
- 짧은 Q&A 위주, sort_order는 10 간격 (10, 20, ...)

### 8.2 체크리스트 (3개)

| 제목 | 제품 | 단계 수 |
|:-|:-:|:-:|
| PMS 결제 오류 트러블슈팅 | pms | 4 |
| Keyless 카드키 발급 실패 | keyless | 4 |
| 키오스크 화면 멈춤 진단 | kiosk | 3 |

각 단계는 yes/no 분기로 다음/해결/접수 결과 도출.

---

## 9. 권한 매트릭스

| 행위 | 비로그인 | 호텔리어 | 매니저 | 어드민 |
|:-|:-:|:-:|:-:|:-:|
| `/faq` 조회·도움됨 | O | O | O | O |
| `/troubleshoot/*` 진행 | O | O | O | O |
| `/admin/faqs` 관리 | X | X | O | O |
| `/admin/checklists` 관리 | X | X | O | O |

---

## 10. 임시값 & TODO

- `TODO(phase-4-temp)`: `/troubleshoot/[id]` escalate 시 `/tickets/new?from=checklist&...`로 전달하는 컨텍스트는 Phase 5 접수 폼에서 사용. 현재는 query 파라미터만 통과.
- `TODO(phase-4-temp)`: FAQ 도움됨 1회 제약은 localStorage 기반. Phase 6+에서 `faq_feedback` 테이블로 강화.
- `TODO(phase-4-temp)`: `/admin/checklists/new` 신규 작성 시 단계는 메타 저장 후 편집 페이지(`[id]`)에서 추가하도록 단순화. 한 페이지에서 메타+단계 동시 입력은 복잡도 증가 우려.

---

## 11. 빌드/검증 흐름

1. `npx drizzle-kit generate` → `db/migrations/0002_*.sql`
2. `npm run db:migrate` → Neon 적용
3. `npm run db:seed` → 12 FAQ + 3 체크리스트 (idempotent)
4. `npm run build` → 빌드 통과 확인 (라우트 표 6+개 신규)
5. 시연 흐름:
   - `/faq` → PMS 필터 → 아코디언 펼침 → 도움됨 클릭
   - `/troubleshoot` → "PMS 결제 오류" 카드 클릭 → 단계 진행 → "해결됨"
   - `/admin/faqs/new` → 작성 → 발행 → `/faq`에서 확인
   - `/admin/checklists/[id]` → 단계 추가/순서 변경

---

## 12. 다음 Phase 연결

Phase 5에서 `/tickets/new` 접수 폼이 실제 동작하면 `escalate` 결과 페이지의 안내 링크가 실접수 페이지로 자연스럽게 연결된다. 체크리스트의 진행 컨텍스트(`from=checklist&checklist={id}&step={no}`)는 Phase 5 접수 폼에 pre-fill로 활용.
