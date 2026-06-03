# ai-reply-assist — Plan

> **Feature**: AI 답변 어시스트 — 티켓 처리자(매니저)의 답변 효율·정확성 향상
> **Phase**: Plan (PDCA)
> **작성일**: 2026-06-03
> **선행 결정**: 추천 + RAG 초안 + 유사 과거 티켓 풀스택 / **멀티 프로바이더(Anthropic + OpenAI)** 모델 선택 모달 + 어드민 모델 마스터 / 초안 기본 모델 결정 대기(§10 비용효과) / 검수 강제(human-in-the-loop)
> **상태**: ✅ APPROVED — Design 참조용 (2026-06-03 확정: 4모델 전체 활성화·기본 Haiku 4.5·나머지 권장값)
> **참여**: CTO(풀스택 설계) + frontend-architect(UX/UI)

---

## Executive Summary

| 관점 | 내용 |
|:-:|:-|
| **Problem** | 시맨틱 검색 인프라(articles/faqs `embedding` + HNSW)가 이미 구축됐지만, 정작 매니저가 답변을 작성하는 화면(`admin-reply-form`)에는 연결돼 있지 않다. 매니저는 기억에 의존해 관련 도움말을 찾고 빈 에디터에 직접 타이핑한다 → 답변 시간↑, 일관성·정확성↓, 재문의(원콜 실패)↑. |
| **Solution** | 답변 폼 옆에 ① 관련 도움말(articles/FAQs 시맨틱 추천) ② 유사 과거 티켓 ③ AI 답변 초안 생성(RAG) 어시스트 패널을 붙인다. 초안은 근거 문서에 한정해 생성하고, 출처 표시 + 검수 강제로 환각을 차단한다. |
| **Function UX Effect** | 매니저는 추천 도움말을 1클릭 인용하고, 모델을 고른 뒤 근거 기반 초안을 받아 검수·편집만 하면 된다. 모바일 Accordion·데스크톱 인라인 패널로 답변 공간을 침범하지 않는다. |
| **Core Value** | **답변 작성 시간 단축 + 답변 정확성·일관성 향상 + 원콜 해결률(DI-01) 개선**. 이미 보유한 임베딩 자산을 처음으로 처리자 워크플로우에 활용. |

---

## 1. 배경 (Why)

### 1.1 발견된 문제

- **준비된 자산 미활용**: `articles.embedding`, `faqs.embedding` + HNSW 인덱스 + 동의어 확장 키워드 검색이 모두 구축돼 있으나(Phase 2 / FAQ v1.7), 검색 품질 대시보드·호텔리어 검색에만 쓰이고 **매니저 답변 작성 화면엔 연결 안 됨**.
- **답변이 기억·수기 의존**: 매니저가 티켓을 읽고 머릿속으로 관련 도움말을 떠올려 빈 RichEditor에 직접 작성 → 처리자별 답변 편차, 누락, 오안내 가능성.
- **과거 처리 이력 사장**: 같은 호텔이 3주 전 동일 이슈로 접수한 이력, 유사 이슈의 해결책이 `tickets`에 쌓여 있지만 검색·재활용 수단 없음.
- **정적 빠른답변의 한계**: `quick_reply_templates`는 고정 템플릿이라 티켓 맥락에 맞는 추천 불가.
- **원콜 실패 비용**: 부정확·불충분한 답변 → 재문의 → `oneCallResolved`(DI-01 지표) 하락.

### 1.2 핵심 통찰

티켓 답변은 본질적으로 **검색(관련 지식 찾기) + 작문(맥락에 맞춰 답변)**의 결합 작업이다. 검색 인프라는 이미 있으니, 그것을 답변 작성 흐름에 직접 붙이고(추천), 작문을 RAG 초안으로 보조하면 **효율과 정확성을 동시에** 끌어올릴 수 있다. 단, AI 초안은 환각 위험이 있으므로 **근거 한정 + 출처 표시 + 검수 강제**를 설계의 1순위로 둔다.

---

## 2. Goals (G1~G7)

| ID | Goal | 측정 기준 |
|:-:|:-|:-|
| **G1** | 답변 폼 옆 관련 도움말 추천 (articles/FAQs top-5) | 티켓 임베딩 기반 시맨틱 추천 노출, [인용 삽입] 동작 |
| **G2** | 유사 과거 티켓 추천 (같은 호텔/유사 이슈) | `tickets.embedding` 기반 top-3, [열기] 동작 |
| **G3** | RAG 답변 초안 생성 (근거 문서 한정) | 선택 문서 컨텍스트로 Claude 초안 생성 → 에디터 채움 |
| **G4** | AI 모델 선택 모달 + 어드민 모델 마스터 | 활성 모델만 노출, 기본값/ON·OFF 어드민 편집, localStorage 기억 |
| **G5** | 환각 차단 — 근거 한정·출처 표시·검수 강제 | 출처 칩 + amber 검수 배너 + 미수정 발송 시 ConfirmDialog 게이트 |
| **G6** | 답변 공간 비침범 UX | 데스크톱 인라인 패널 / 모바일 Accordion, 패널 내부 스크롤 |
| **G7** | AI 사용량·비용 추적 | `activity_logs`에 `ai.draft_generated { model, modified }` 기록 |

---

## 3. Non-Goals (이번 Phase에서 안 함)

- **자동 발송** — 초안은 에디터 채움까지만. 발송은 항상 매니저 수동.
- **티켓 자동 분류·메타 제안** (productCode/issueType 자동 추천) — P2로 분리.
- **자동 상태 전이·담당 배정 제안** — P2+.
- **스레드 자동 요약, 에스컬레이션 사유 자동 초안** — P3.
- **oachat.ai 연동 / 호텔리어 측 AI 노출** — 이번 범위 아님. AI 어시스트는 매니저·어드민 전용.
- **임베딩 모델 멀티화** — 임베딩은 `text-embedding-3-small`(1536) **단일 고정**(articles/faqs/tickets 동일 벡터공간 필수). 단, **초안 생성(챗) 모델은 멀티 프로바이더**(Anthropic + OpenAI)로 일반화 — 임베딩과 챗을 혼동하지 말 것.

---

## 4. Scope — 작업 항목 (P1)

| ID | 항목 | 영향 파일(제안) |
|:-:|:-|:-|
| **P1-A** | `tickets.embedding` 컬럼 `vector(1536)` + HNSW 코사인 인덱스 | `db/schema/tickets.ts` 수정 |
| **P1-B** | 티켓 생성/본문 수정 시 임베딩 갱신 (fire-and-forget) | `lib/services/tickets.ts` (createTicket/updateTicket 훅) |
| **P1-C** | 기존 티켓 임베딩 백필 스크립트 | `scripts/backfill-ticket-embeddings.ts` + `db:backfill-ticket-embeddings` |
| **P1-D** | 어시스트 검색 서비스 (articles/faqs/tickets 병렬 코사인 + 임계값 컷) | `lib/services/ticket-assist.ts` 신규 |
| **P1-E** | RAG 초안 Server Action (`generateReplyDraftAction(ticketId, docIds[], model)`) | `app/actions/ticket-assist-actions.ts` 신규 |
| **P1-F** | 활성 AI 모델 조회 서비스 + 어드민 모델 마스터 CRUD | `lib/services/ai-models.ts`, `app/actions/master-ai-models-actions.ts` |
| **P1-G** | 어드민 모델 마스터 화면 (목록/기본값/ON·OFF) | `app/(admin)/admin/master/ai-models/` |
| **P1-H** | AI 어시스트 패널 (블록 ①②③) | `_components/ai-assist/AiAssistPanel.tsx` 외 |
| **P1-I** | AI 모델 선택 모달 | `_components/ai-assist/AiModelSelectModal.tsx` |
| **P1-J** | 초안 적용 오버레이 (검수 배지 + 출처 칩) | `_components/ai-assist/AiDraftOverlay.tsx` |
| **P1-K** | `admin-reply-form.tsx` 통합 (인용 삽입 콜백 + 초안 주입 + 검수 게이트) | `_components/admin-reply-form.tsx` 수정 |
| **P1-L** | AI 사용량 로깅 (`activity_logs`) | 액션 내 fire-and-forget |

---

## 5. DB 스키마

### 5.1 `tickets` 변경 (컬럼 1개 + 인덱스)

```
tickets.embedding   vector(1536)   -- text-embedding-3-small (articles/faqs와 동일 모델 필수)
INDEX  tickets_embedding_hnsw  USING hnsw (embedding vector_cosine_ops)
```

- **임베딩 본문**: `title + content` (1차). 공개답변 누적 반영은 재임베딩 비용 때문에 보류(추후 검토).
- **갱신 시점**: 생성/본문 수정 시. 실패해도 접수는 성공(fire-and-forget). 누락분은 백필로 보강.
- ⚠️ **마이그레이션**: `drizzle-kit push` 금지(검색 tsv/인덱스 DROP 이슈) → **`generate` + `migrate`** 사용.

### 5.2 AI 모델 마스터 (어드민 편집)

기존 `system_settings` 확장 vs 신규 테이블 — **신규 `ai_models` 테이블 권장**(목록·기본값·ON/OFF를 행 단위로 관리).

```
ai_models
  id            uuid (공통)
  provider      text   -- 'anthropic' | 'openai'  ← 멀티 프로바이더 라우팅 키
  code          text   -- 'claude-haiku-4-5', 'gpt-4.1-mini', 'gpt-4o' ...
  label         text   -- 'Claude Haiku 4.5'
  description    text   -- '빠름 · 저비용 · 일반 CS 처리에 적합'
  tier          text   -- 'economy' | 'balanced' | 'premium' (UI 그룹/배지)
  is_default    boolean
  sort_order    integer
  is_active     boolean (공통, 리스트 필터)
  created_at / updated_at (공통)
```

- **시드(확정 — 4개 전체 `is_active=true`)**: 모델명에 단가/건당비용 명시. `label`에 금액 포함하여 모달·어드민에서 그대로 노출.

| sort | provider | code | label (건당만 노출) | description (어드민 상세/툴팁) | tier | default |
|:-:|:-:|:-|:-|:-|:-:|:-:|
| 1 | openai | `gpt-4.1-mini` | **GPT-4.1 mini · 약 2.6원/건** | 입$0.40·출$1.60/1M · 빠름·저비용 | economy | |
| 2 | anthropic | `claude-haiku-4-5` | **Claude Haiku 4.5 · 약 7원/건** | 입$1·출$5/1M · 한국어 CS 균형 | balanced | ✅ |
| 3 | openai | `gpt-4o` | **GPT-4o · 약 16원/건** | 입$2.50·출$10/1M · 고품질 | premium | |
| 4 | anthropic | `claude-sonnet-4-6` | **Claude Sonnet 4.6 · 약 21원/건** | 입$3·출$15/1M · 복잡 이슈 | premium | |

> **표기(결정 B)**: 모달·마스터 리스트는 `label`(건당만) 노출. 1M 단가는 `description`으로 분리 → 어드민 편집/툴팁에서 확인. `약 N원/건` = 초안 1건(입력 ~3,000 + 출력 ~400 토큰, 1,400원/USD) 실비용.

- 금액은 시드 시점 표기. 가격 변동 시 어드민에서 `label`/`description` 직접 수정(하드코딩 아님).
- `provider`로 SDK 분기 → 모델 하드코딩 없음. 신모델 출시·비용 변경 시 어드민 토글·라벨 수정만으로 대응(CLAUDE.md 8번 원칙).
- **API 키**: `ANTHROPIC_API_KEY`(신규) + `OPENAI_API_KEY`(임베딩으로 이미 사용 중). `.env.example` 반영.

---

## 6. 서비스 / API 설계

### 6.1 추천 검색 — `lib/services/ticket-assist.ts`

```
getTicketAssist(ticketId) →
  1. ticket.embedding 로드 (없으면 즉석 생성)
  2. 병렬 코사인 검색:
       - articles  (status='published', embedding <=> q)  LIMIT 5
       - faqs       (embedding <=> q)                       LIMIT 5
       - tickets    (id != self, embedding <=> q)           LIMIT 3
  3. 유사도 임계값(초기 cosine ≥ 0.78) 미만 컷 → 억지 추천 금지
  4. return { docs: DocItem[], tickets: SimilarTicketItem[] }  // 각 항목 score 포함
```

- 호출: 페이지 로드 시 1회(추천은 정적) → 패널 SSR. 기존 `articles.ts`/`faqs.ts` 시맨틱 헬퍼 재사용.
- 임계값은 백필 후 실데이터로 튜닝.

### 6.2 RAG 초안 — `generateReplyDraftAction(ticketId, docIds[], model)`

```
1. requireRole(['manager','admin'])
2. 활성 모델 검증 (ai_models.is_active) → provider/code 로드
3. 컨텍스트 수집: 선택 문서(기본 top-3)의 본문 (articles/faqs/유사티켓)
4. 프로바이더 라우팅 (7절 프롬프트 공유):
     - provider='anthropic' → @anthropic-ai/sdk (messages.create)
     - provider='openai'    → openai SDK (chat.completions / responses)
5. return { draft: string, citations: [{type,id,title,url}] }   // DB 저장 안 함
6. activity_logs: ai.draft_generated { provider, model, ticketId, docIds }  (fire-and-forget)
```

- **프로바이더 추상화**: `lib/ai/draft-provider.ts`에 `generateDraft({provider, model, system, context})` 단일 인터페이스 → SDK 분기 캡슐화. 동일 프롬프트를 양 프로바이더에 적용해 A/B·교체 용이.
- 초안은 **에디터 주입 전용** — `ticket_messages` 삽입은 매니저가 발송할 때만.
- 스트리밍 적용 검토(체감 지연 완화).

---

## 7. RAG 초안 — 정확성 가드레일 (설계 1순위)

| 가드레일 | 방법 |
|:-|:-|
| **근거 한정** | 프롬프트: "제공된 도움말 문서에 있는 내용만 사용. 없으면 '확인 후 안내드리겠습니다'로 처리. 추측·창작 금지." |
| **출처 표기** | 초안 적용 시 사용 문서 칩(`AiSourceChips`) 노출 → 매니저 즉시 근거 검증 |
| **검수 강제(이중)** | ① 시각: 에디터 상단 amber `⚠️ AI 생성 — 검수 후 발송` 배너 고정 ② 기술: 초안 미수정 발송 시 ConfirmDialog 게이트("검수하셨나요?") |
| **컷오프** | 추천 유사도가 임계값 미만이면 초안 버튼 비활성 + "관련 문서 부족" 안내 |
| **톤·형식** | 프롬프트에 존댓말/호텔리어 대상/한국어/SMS 길이 고려 명시 |
| **모델 제어** | 모달에서 선택, 어드민이 활성 모델·기본값 관리. 기본 Haiku 4.5 |
| **추적** | `activity_logs`에 `model`, `modified`(발송 시 초안 대비 수정 여부) 기록 → 추후 "AI 초안 수정률" 지표(인사이트 대시보드 통합 여지) |

---

## 8. UX/UI 설계 (frontend-architect)

### 8.1 핵심 결정 3가지

1. **레이아웃**: 4번째 컬럼 추가 대신 **메인 컬럼(답변 폼 하단) 인라인 패널**. 현재 `lg:grid-cols-3`(메인 2 / 사이드 1) 그리드를 깨지 않음.
2. **모바일 패턴**: **Accordion(기본 닫힘)** 채택. Sheet는 전체 화면을 덮어 에디터와 추천을 동시 참조 불가 → 기각.
3. **검수 강제**: 시각(amber 배너) + 기술(ConfirmDialog 게이트) **이중 레이어**. CS 업무 특성상 단일 레이어로는 실수 차단 불충분.

### 8.2 컴포넌트 트리

```
_components/
├── admin-reply-form.tsx                 (수정: 인용 콜백 + 초안 주입 + 검수 게이트)
└── ai-assist/                           (신규)
    ├── AiAssistPanel.tsx
    │   ├── AiAssistSkeleton.tsx
    │   ├── RelatedDocsBlock.tsx          (블록 ①)
    │   │   ├── DocRecommendItem.tsx
    │   │   └── DocEmptyState.tsx
    │   ├── SimilarTicketsBlock.tsx       (블록 ②)
    │   │   ├── SimilarTicketItem.tsx
    │   │   └── TicketEmptyState.tsx
    │   └── GenerateDraftButton.tsx       (블록 ③ 트리거)
    ├── AiModelSelectModal.tsx            (모델/문서 선택)
    │   ├── ModelRadioItem.tsx
    │   └── DocCheckboxItem.tsx
    └── AiDraftOverlay.tsx                (검수 배지 + 출처 칩)
        ├── AiDraftBadge.tsx
        └── AiSourceChips.tsx
```

### 8.3 shadcn/ui 매핑

| 요소 | 컴포넌트 |
|:-|:-|
| 패널 접이식 | `Accordion` (모바일 기본 닫힘 / 데스크톱 열림) |
| 모델 선택 모달 | `Dialog`(Sheet 대신 — 닫기 빠르고 옵션 한눈에) |
| 모델 라디오 | `RadioGroup` + `Label` |
| 문서 체크박스 | `Checkbox` + `Label` |
| 유사도/타입 배지 | `Badge` (색상+숫자 병기, 색맹 고려) |
| 로딩 | `Skeleton` (레이아웃 시프트 방지, 결과와 동일 높이) |
| 빈 상태 | 기존 `EmptyState` |
| 출처 칩 | `Badge variant=outline` + 제거 버튼 |
| 검수 경고 | `Alert` (amber + `AlertTriangle`) |

### 8.4 상호작용 요지

- **인용 삽입**: 클릭 → 부모 콜백 → content에 인용 블록 append → 항목 "삽입됨" 토글(중복 방지) → 에디터 포커스 복구.
- **초안 생성**: 버튼 → 모델 모달 → (기억 시 다음부터 스킵, 버튼에 "✨ Haiku로 초안 생성" + 설정 아이콘 재진입) → 생성 중 스피너 → 성공 시 기존 작성분 있으면 ConfirmDialog 후 교체 → 오버레이 표시.
- **검수 게이트**: 발송 시 `content === 생성초안`(미수정)이면 ConfirmDialog, 수정했으면 통과.
- **상태 전이**: loading(Skeleton) → 결과 / EmptyState / ErrorState(재시도). 모델 0개 시 "어드민에서 모델 활성화" 안내.

### 8.5 접근성·모바일

- Accordion `aria-expanded`, RadioGroup 키보드 탐색·`aria-checked`(Radix 자동).
- Dialog 포커스 트랩 + 닫을 때 트리거로 포커스 복귀.
- 유사도 `aria-label="유사도 93퍼센트"`, `AiDraftBadge` `role=status aria-live=polite`.
- 터치 타겟 `min-h-[48px]`, 모달 `max-h-[85vh] overflow-y-auto`, 패널 `max-h-[400px]` 내부 스크롤(+데스크톱 sticky 검토).

### 8.6 UX 리스크 & 완화

| 리스크 | 완화 |
|:-|:-|
| **AI 초안 맹신** | amber 배너 고정 + 미수정 발송 ConfirmDialog + `activity_logs` 수정여부 기록 + 향후 "수정률" 지표 |
| **패널이 답변 공간 침범** | 패널 내부 스크롤 분리 + 데스크톱 sticky + 스켈레톤 동일 높이 + 닫힘 상태 localStorage 유지 |
| **모달 피로** | "이 모델 기억" 체크 → 이후 스킵, 버튼에 선택 모델 표시 + 설정 재진입, 스킵 후 실패 시 모달 자동 재표시 |

---

## 9. 권한 / 보안

- 어시스트 패널·모달·초안 액션 모두 `requireRole(['manager','admin'])`. **호텔리어 노출 절대 없음**(기존 권한 분리 유지).
- 어드민 모델 마스터는 `requireRole(['admin'])`.
- 프롬프트 인젝션 방어: 티켓 본문·문서는 컨텍스트로만 제공, 시스템 프롬프트 우선. 출력은 답변 텍스트로만 사용(코드 실행·도구 호출 없음).

---

## 10. 비용 대비 효과 (멀티 프로바이더)

### 10.1 모델별 단가 & 초안 1건 비용

> 가격: 2026-06 기준(1M 토큰당 input/output, USD). 초안 1건 가정 = **입력 ~3,000 토큰(근거 문서) + 출력 ~400 토큰**. 환율 ~1,400원/USD.

| 모델 | Provider | input/output ($/1M) | **초안 1건** | 200건/일 시 월비용(22일) | 적합 |
|:-|:-:|:-:|:-:|:-:|:-|
| **GPT-4.1 mini** | openai | $0.40 / $1.60 | **~2.6원** | ~1.1만원 | economy — 일반·정형 문의 |
| **Claude Haiku 4.5** | anthropic | $1 / $5 | **~7원** | ~3.1만원 | balanced — 한국어 CS 기본값 후보 |
| **GPT-4.1** | openai | $2.00 / $8.00 | **~13원** | ~5.7만원 | premium — 복잡 이슈 |
| **GPT-4o** | openai | $2.50 / $10 | **~16원** | ~7.0만원 | premium |
| **Claude Sonnet 4.6** | anthropic | $3 / $15 | **~21원** | ~9.2만원 | premium — 복잡 기술이슈·뉘앙스 |

### 10.2 핵심 결론 — "비용은 결정 요인이 아니다"

- **이 볼륨에선 최고급도 건당 ~21원.** 200건/일 풀가동해도 프리미엄 월 ~9만원, 저가 월 ~1만원. CS 운영에서 **무의미한 차이** → 모델 선택의 기준은 **비용이 아니라 한국어 CS 정확성·존댓말 품질·지연(latency)**.
- **절감 레버는 따로 있음**: Batch API 50%↓(초안은 실시간이라 부적합), **프롬프트 캐싱**(시스템 프롬프트·반복 문서 최대 90%↓ → 캐시 활용 시 input 비용 추가 절감), 근거 문서 토큰 절제(top-3 + 요약 컨텍스트).

### 10.3 멀티 프로바이더를 쓰는 진짜 이유 (비용 외)

| 이유 | 효과 |
|:-|:-|
| **장애 격리(fallback)** | 한 프로바이더 장애 시 다른 쪽으로 즉시 전환 → 초안 기능 가용성↑ |
| **품질 A/B** | 동일 프롬프트로 한국어 CS 답변 품질 실측 비교(수정률 지표와 결합) |
| **벤더 락인 회피** | 가격·정책 변동 시 어드민 토글로 기본 모델 교체 |
| **한계비용 0에 수렴** | OpenAI SDK는 임베딩으로 이미 사용 중 → 챗 추가 구현 부담 작음 |

### 10.4 권장 라인업 & 기본값

- **2-tier 운영**: 일반 문의 = economy/balanced, 복잡 기술이슈 = premium(모달에서 선택).
- **기본값 후보**: ① **Claude Haiku 4.5**(한국어 존댓말·정확성 안정, 건당 7원) ② **GPT-4.1 mini**(최저가 2.6원, 표준 작업서 4o급) — 둘 중 택1, §12 결정.
- 프리미엄은 Sonnet 4.6 / GPT-4o 중 어드민이 활성화.

### 10.5 기타 리스크

- **임베딩 정합성**: 임베딩 모델이 articles/faqs와 다르면 cross 유사도 무의미 → `text-embedding-3-small` 고정 강제.
- **마이그레이션**: push 금지 룰 준수(generate+migrate).
- **키 관리**: `ANTHROPIC_API_KEY` 신규 추가, `.env` 커밋 금지.

---

## 11. 작업 순서 (착수 시)

```
1. 문서 승인 → IMPLEMENTATION_PLAN.md에 P1 반영
2. P1-A 스키마 (generate+migrate)  →  P1-C 백필  →  P1-B 갱신 훅
3. P1-D 추천 서비스  →  P1-F/P1-G 모델 마스터(서비스+어드민 화면)
4. P1-H 어시스트 패널(SSR 추천)  →  P1-K reply-form 통합(인용)
5. P1-E RAG 액션 + 7절 프롬프트  →  P1-I 모델 모달  →  P1-J 초안 오버레이 + 검수 게이트
6. P1-L 로깅  →  임계값·프롬프트 실데이터 튜닝
7. /pdca analyze (Gap 분석) → 90%+ → report
```

---

## 12. 결정 사항 (✅ 2026-06-03 확정)

| # | 항목 | 확정 |
|:-:|:-|:-|
| 1 | 초안 기본 모델 | **Claude Haiku 4.5** (한국어 존댓말·정확성 안정, 건당 ~7원) |
| 2 | 활성 모델 | **4개 전체 활성화** (GPT-4.1 mini / Haiku 4.5 / GPT-4o / Sonnet 4.6) — 운영하며 가감 |
| 3 | 유사티켓 임베딩 본문 | **`title+content`** (권장) |
| 4 | 모델 마스터 | **신규 `ai_models` 테이블** (권장) |
| 5 | 스트리밍 / 캐싱 | **둘 다 적용** — 스트리밍(체감 지연↓) + 프롬프트 캐싱(input 절감) |
| 6 | 유사도 임계값 | **0.78** 시작 → 백필 후 튜닝 |
| + | 모델명 표기 | **label에 금액 명시** (§5.2 시드 표) |

---

> **다음 단계**: ✅ 결정 확정 완료 → `/pdca design ai-reply-assist`로 상세 설계(스키마 DDL·프롬프트 전문·컴포넌트 props·시퀀스) 진행.
