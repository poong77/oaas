# ai-reply-assist — Design

> **Feature**: AI 답변 어시스트 — 추천 + RAG 초안 + 유사 과거 티켓 (멀티 프로바이더)
> **Phase**: Design (PDCA)
> **선행 문서**: [docs/01-plan/features/ai-reply-assist.plan.md](../../01-plan/features/ai-reply-assist.plan.md)
> **작성일**: 2026-06-03
> **상태**: 🟡 DRAFT — 구현 착수 전 검토
> **핵심 전제**: 기존 AI 인프라(`lib/ai/*`, `lib/services/embeddings.ts`, `lib/services/llm.ts`) **재사용**

---

## 0. 개요

Plan 확정 사항(G1~G7, P1-A~L, §12 결정)의 구현 명세를 확정한다. **이 프로젝트는 이미 Anthropic·OpenAI 양 클라이언트와 임베딩 파이프라인을 보유**하고 있으므로, 신규 SDK 도입 없이 기존 모듈 위에 ① 티켓 임베딩 ② 추천 검색 ③ 프로바이더 추상화 ④ RAG 초안 ⑤ 어드민 모델 마스터 ⑥ 어시스트 UI를 얹는다.

| 결정 | 선택 | Design 반영 |
|:-|:-|:-|
| 챗 프로바이더 | anthropic + openai 멀티 | §5 `draft-provider.ts` 라우팅 |
| Anthropic 호출 | 기존 `runClaudeText` 재사용 | §5.1 |
| OpenAI 호출 | 기존 `llm.ts` 패턴 확장(`runOpenAIText`) | §5.2 |
| 임베딩 | 기존 `embedText`(text-embedding-3-small) 재사용 | §3 |
| 모델 목록 | DB `ai_models` (env는 fallback) | §8.1 |
| 비용/레이트 | 기존 `cost-tracker.ts`/`rate-limiter.ts` 재사용 | §11.2 |
| 초안 저장 | 안 함 — 에디터 주입 전용 | §7.2 |
| 검수 강제 | amber 배너 + 미수정 발송 ConfirmDialog | §9.4 |

---

## 1. 파일 변경 요약

### 1.1 신규 파일 (DB·도메인·서비스)

| 경로 | 역할 | P |
|:-|:-|:-:|
| `db/schema/ai-models.ts` | 모델 마스터 (provider/code/label/tier/is_default) | P1-F |
| `scripts/backfill-ticket-embeddings.ts` | 기존 티켓 임베딩 일괄 생성 | P1-C |
| `lib/services/ticket-assist.ts` | 추천 검색(articles/faqs/tickets 병렬 코사인 + 임계값) | P1-D |
| `lib/services/ai-models.ts` | 모델 마스터 CRUD + 활성/기본 조회 | P1-F |
| `lib/ai/draft-provider.ts` | 프로바이더 추상화 `generateDraft()` | P1-E |
| `lib/ai/prompts/ticket-reply-drafter.ts` | RAG 초안 시스템 프롬프트 + 컨텍스트 빌더 | P1-E |
| `app/actions/ticket-assist-actions.ts` | `generateReplyDraftAction` 외 | P1-E |
| `app/actions/master-ai-models-actions.ts` | 모델 마스터 액션(zod) | P1-F |

### 1.2 신규 파일 (UI)

| 경로 | 역할 | P |
|:-|:-|:-:|
| `app/(admin)/admin/tickets/[id]/_components/ai-assist/AiAssistPanel.tsx` | 패널 컨테이너(Accordion) | P1-H |
| `.../ai-assist/RelatedDocsBlock.tsx` + `DocRecommendItem.tsx` + `DocEmptyState.tsx` | 블록 ① | P1-H |
| `.../ai-assist/SimilarTicketsBlock.tsx` + `SimilarTicketItem.tsx` + `TicketEmptyState.tsx` | 블록 ② | P1-H |
| `.../ai-assist/GenerateDraftButton.tsx` | 블록 ③ 트리거 | P1-H |
| `.../ai-assist/AiModelSelectModal.tsx` + `ModelRadioItem.tsx` + `DocCheckboxItem.tsx` | 모델/문서 선택 | P1-I |
| `.../ai-assist/AiDraftOverlay.tsx` + `AiDraftBadge.tsx` + `AiSourceChips.tsx` | 검수 배지·출처 | P1-J |
| `.../ai-assist/AiAssistSkeleton.tsx` | 로딩 | P1-H |
| `app/(admin)/admin/master/ai-models/page.tsx` + `_components/*` | 모델 마스터 화면 | P1-G |

### 1.3 수정 파일

| 경로 | 변경 |
|:-|:-|
| `db/schema/tickets.ts` | `embedding vector(1536)` + HNSW 인덱스 |
| `lib/services/tickets.ts` | 생성/본문수정 시 임베딩 갱신 훅(fire-and-forget) |
| `lib/services/embeddings.ts` | `buildTicketEmbeddingInput()` 추가 |
| `lib/services/llm.ts` | `runOpenAIText({system,user,model})` 추가(범용 텍스트) |
| `app/(admin)/admin/tickets/[id]/_components/admin-reply-form.tsx` | 인용 삽입 콜백 + 초안 주입 + 검수 게이트 + 패널 마운트 |
| `app/(admin)/admin/tickets/[id]/page.tsx` | `getTicketAssist()` SSR → 패널에 props 주입 |
| `.env.example` | `ANTHROPIC_API_KEY`(확인) 표기 |
| 어드민 사이드바 메뉴 | `master/ai-models` 항목 추가(menu-access 연동) |

---

## 2. DB 스키마

### 2.1 `tickets.embedding` (수정)

```sql
ALTER TABLE tickets ADD COLUMN embedding vector(1536);   -- text-embedding-3-small
CREATE INDEX tickets_embedding_hnsw
  ON tickets USING hnsw (embedding vector_cosine_ops);
```

Drizzle:
```ts
embedding: vector('embedding', { dimensions: 1536 }),   // articles/faqs와 동일 패턴
// index: hnsw, vector_cosine_ops  (articles 스키마 참조)
```
- ⚠️ `drizzle-kit push` 금지 → `drizzle-kit generate` + `migrate`.

### 2.2 `ai_models` (신규)

```ts
export const aiProviderEnum = pgEnum('ai_provider', ['anthropic', 'openai']);
export const aiTierEnum = pgEnum('ai_tier', ['economy', 'balanced', 'premium']);

export const aiModels = pgTable('ai_models', {
  id: uuid('id').defaultRandom().primaryKey(),
  provider: aiProviderEnum('provider').notNull(),
  code: text('code').notNull(),            // 'claude-haiku-4-5', 'gpt-4.1-mini' ...
  label: text('label').notNull(),          // 금액 명시 포함
  description: text('description'),
  tier: aiTierEnum('tier').notNull().default('balanced'),
  isDefault: boolean('is_default').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
// 제약: is_default=true 행은 0 또는 1개 (service에서 강제 — 새 default 지정 시 기존 false)
```

**시드(4개, Plan §5.2 확정)**

| sort | provider | code | label (건당만) | description (1M 단가) |
|:-:|:-:|:-|:-|:-|
| 1 | openai | `gpt-4.1-mini` | `GPT-4.1 mini · 약 2.6원/건` | `입$0.40·출$1.60/1M · 빠름·저비용` |
| 2 | anthropic | `claude-haiku-4-5` | `Claude Haiku 4.5 · 약 7원/건` ✅default | `입$1·출$5/1M · 한국어 CS 균형` |
| 3 | openai | `gpt-4o` | `GPT-4o · 약 16원/건` | `입$2.50·출$10/1M · 고품질` |
| 4 | anthropic | `claude-sonnet-4-6` | `Claude Sonnet 4.6 · 약 21원/건` | `입$3·출$15/1M · 복잡 이슈` |

> 결정 B: 리스트/모달은 `label`(건당만), 1M 단가는 `description`. `약 N원/건` = 입력 ~3K+출력 ~400토큰, 1,400원/USD.

---

## 3. 임베딩 파이프라인 (기존 재사용)

`lib/services/embeddings.ts`에 추가:
```ts
export function buildTicketEmbeddingInput(t: {
  title: string; content: string;
}): string {
  return [t.title, t.content].filter(Boolean).join('\n\n').slice(0, 8000);
}
```

`lib/services/tickets.ts` 생성/수정 경로:
```ts
// createTicket / updateTicket 본문 변경 후 — fire-and-forget
void (async () => {
  const vec = await embedText(buildTicketEmbeddingInput({ title, content }));
  if (vec) await db.update(tickets)
    .set({ embedding: toVectorLiteral(vec) as any })
    .where(eq(tickets.id, ticketId));
})().catch((e) => console.error('[ticket-embed] 실패(무시):', e));
```
- `embedText` 실패(키 없음/한도)시 `null` → 임베딩 생략, 접수는 정상(graceful degrade, articles와 동일 정책).
- 누락분은 백필 스크립트로 보강.

---

## 4. 추천 검색 — `lib/services/ticket-assist.ts`

```ts
export type AssistDoc = {
  type: 'article' | 'faq'; id: string; title: string;
  url: string; snippet: string; score: number;
};
export type AssistTicket = {
  id: string; ticketNo: string; title: string;
  status: TicketStatus; resolutionSnippet: string; score: number;
};
export type TicketAssist = { docs: AssistDoc[]; tickets: AssistTicket[] };

const THRESHOLD = 0.78;  // cosine 유사도 하한 (백필 후 튜닝)

export async function getTicketAssist(ticketId: string): Promise<TicketAssist> {
  const t = await getTicketRaw(ticketId);
  let vec = t.embedding;
  if (!vec) {                                   // 임베딩 누락 시 즉석 생성
    const v = await embedText(buildTicketEmbeddingInput(t));
    if (!v) return { docs: [], tickets: [] };   // graceful degrade
    vec = toVectorLiteral(v);
    void db.update(tickets).set({ embedding: vec as any }).where(eq(tickets.id, ticketId));
  }
  const lit = sql`${vec}::vector`;
  // 코사인 거리: 1 - distance = similarity
  const [arts, fqs, tks] = await Promise.all([
    db.select(/* title, slug, summary, 1-(embedding<=>lit) AS score */)
      .from(articles).where(and(eq(articles.status,'published'), isNotNull(articles.embedding)))
      .orderBy(sql`${articles.embedding} <=> ${lit}`).limit(5),
    db.select(/* question, answer, score */)
      .from(faqs).where(isNotNull(faqs.embedding))
      .orderBy(sql`${faqs.embedding} <=> ${lit}`).limit(5),
    db.select(/* ticketNo, title, status, score */)
      .from(tickets).where(and(ne(tickets.id, ticketId), isNotNull(tickets.embedding)))
      .orderBy(sql`${tickets.embedding} <=> ${lit}`).limit(3),
  ]);
  return {
    docs: [...mapArticles(arts), ...mapFaqs(fqs)].filter(d => d.score >= THRESHOLD)
            .sort((a,b)=>b.score-a.score).slice(0,5),
    tickets: mapTickets(tks).filter(t => t.score >= THRESHOLD),
  };
}
```
- `articles.ts:630~641` 패턴 그대로 차용(`<=> ::vector`).
- 유사 티켓 `resolutionSnippet`: 해당 티켓의 마지막 `kind='public'` 메시지 일부(없으면 상태 라벨).

---

## 5. 프로바이더 추상화 — `lib/ai/draft-provider.ts`

```ts
export type DraftProviderInput = {
  provider: 'anthropic' | 'openai';
  model: string;             // ai_models.code
  system: string;
  user: string;              // 컨텍스트 + 지시
  stream?: boolean;
};
export async function generateDraft(i: DraftProviderInput): Promise<string> {
  if (i.provider === 'anthropic')
    return runClaudeText({ system: i.system, user: i.user, model: i.model, bucket: 'ticket-draft' });
  return runOpenAIText({ system: i.system, user: i.user, model: i.model });
}
```

### 5.1 Anthropic — 기존 `runClaudeText` 재사용
`lib/ai/anthropic-client.ts`의 `runClaudeText({system,user,model,bucket})` 그대로. cost-tracker·rate-limiter 내장. **프롬프트 캐싱**: system 블록에 `cache_control` 적용(반복 시스템 프롬프트 -90%).

### 5.2 OpenAI — `llm.ts`에 `runOpenAIText` 추가
기존 `chatJson` 패턴 확장(같은 ENDPOINT, `messages: [{role:'system'},{role:'user'}]`, JSON 강제 없이 텍스트 반환). 캐싱은 OpenAI 자동 프리픽스 캐시 활용.

### 5.3 스트리밍
1차 구현은 액션이 완성 텍스트 반환(단순). 스트리밍은 `streamReplyDraftAction`(RSC streaming/SSE)로 2차 — UI는 동일 오버레이 재사용. (Plan §12-5 적용, 단계적)

---

## 6. RAG 프롬프트 — `lib/ai/prompts/ticket-reply-drafter.ts`

기존 `article-assistant.ts` 모듈 패턴(시스템/유저 빌더 분리) 따름.

```ts
export const TICKET_DRAFT_SYSTEM = `
당신은 OA 솔루션(PMS·키리스 등) 호텔 고객지원 담당자입니다.
규칙:
1) 제공된 [참고 문서]에 있는 사실만 사용하세요. 문서에 없는 내용은
   "확인 후 안내드리겠습니다"로 처리하고 추측·창작하지 마세요.
2) 호텔리어 대상 공식 답변입니다. 정중한 한국어 존댓말로 작성하세요.
3) 간결하게. 핵심 해결 단계를 번호로 안내하세요.
4) 처리 일정/추가 확인이 필요하면 명시하세요.
5) 답변 본문만 출력하세요(머리말/메타설명 금지).
`.trim();

export function buildTicketDraftUser(p: {
  ticket: { title: string; content: string; productLabel?: string };
  docs: { title: string; body: string; source: string }[];
}): string {
  const refs = p.docs.map((d,i)=>`[문서 ${i+1}] ${d.title} (${d.source})\n${d.body}`).join('\n\n---\n\n');
  return [
    `[티켓] 제품: ${p.ticket.productLabel ?? '-'}`,
    `제목: ${p.ticket.title}`,
    `내용: ${p.ticket.content}`,
    ``,
    `[참고 문서] (이 안의 내용만 사용)`,
    refs || '(관련 문서 없음 — 일반 안내 + 확인 약속으로 작성)',
    ``,
    `위 참고 문서를 근거로 호텔리어에게 보낼 공개 답변 초안을 작성하세요.`,
  ].join('\n');
}
```
- 인용 출처(citations)는 액션이 입력 `docs` 메타에서 그대로 구성(LLM이 만들지 않음 → 출처 신뢰성 보장).

---

## 7. Server Actions

### 7.1 `ticket-assist-actions.ts`

```ts
'use server';
export async function generateReplyDraftAction(input: {
  ticketId: string; docIds: { type:'article'|'faq'|'ticket'; id:string }[]; modelId: string;
}): Promise<{ ok: true; draft: string; citations: Citation[] } | { ok:false; message:string }> {
  const viewer = await requireRole(['manager','admin']);
  const model = await getActiveModelById(input.modelId);   // ai_models, is_active 검증
  if (!model) return { ok:false, message:'비활성 모델입니다.' };

  const ticket = await getTicketRaw(input.ticketId);
  const docs = await loadDocBodies(input.docIds);          // 선택 문서 본문 로드
  const system = TICKET_DRAFT_SYSTEM;
  const user = buildTicketDraftUser({ ticket, docs });

  let draft: string;
  try {
    draft = await generateDraft({ provider: model.provider, model: model.code, system, user });
  } catch (e) {
    return { ok:false, message:'초안 생성 실패. 잠시 후 다시 시도해주세요.' };
  }
  void logActivity({ action:'ai.draft_generated', actorId: viewer.id,
    meta: { provider: model.provider, model: model.code, ticketId: input.ticketId,
            docCount: docs.length } });                    // fire-and-forget
  return { ok:true, draft, citations: docs.map(toCitation) };
}
```
- **초안은 DB 저장 안 함.** `ticket_messages` 삽입은 기존 `addAdminPublicMessageAction`(발송 시).
- 발송 시 `modified` 여부(`content !== 원본초안`)를 메시지 메타/로그에 기록 → "AI 초안 수정률" 지표 기반.

### 7.2 발송 검수 게이트 (reply-form 내)
```
[공개답변 등록] 클릭 && draftMeta 존재 && content === 원본초안
  → ConfirmDialog("AI 초안을 수정 없이 발송합니다. 검수하셨나요?")
     확인 → addAdminPublicMessageAction (meta.aiModel, meta.aiModified=false)
     취소 → 에디터 포커스
content !== 원본초안 → 바로 발송 (meta.aiModified=true)
```

### 7.3 `master-ai-models-actions.ts`
`createModel / updateModel / toggleActive / setDefault / reorder` — 각 `requireRole(['admin'])` + zod. `setDefault`는 트랜잭션으로 기존 default 해제.

---

## 8. 모델 마스터

### 8.1 `lib/services/ai-models.ts`
```ts
listActiveModels(): Promise<AiModel[]>      // is_active, sort_order — 모달용
getDefaultModel(): Promise<AiModel>          // is_default || 첫 active
getActiveModelById(id): Promise<AiModel|null>
listAllModels(): Promise<AiModel[]>          // 어드민 화면
// CRUD (admin)
```
- env(`ANTHROPIC_MODEL_HAIKU` 등)는 DB 비었을 때만 fallback.

### 8.2 어드민 화면 `/admin/master/ai-models`
- 기존 마스터 페이지(business-hours·synonyms) 패턴: Card + 리스트 + 인라인 편집 + 정렬 + ON/OFF 토글 + 기본값 라디오.
- 컬럼: 순서 / provider 배지 / label(금액) / tier 배지 / 기본값 / 활성 토글 / 편집.
- menu-access 마스터에 항목 등록(매니저 노출 여부 어드민 제어).

---

## 9. 컴포넌트 명세

### 9.1 트리 & props
```
AdminReplyForm (수정)
  props += { assist: TicketAssist, models: AiModel[], defaultModelId: string }
  ├── RichEditor (기존) + AiDraftOverlay (조건부)
  └── AiAssistPanel
        props: { assist, models, defaultModelId, onInsertCitation(text), onDraft(draft, meta) }
        ├── RelatedDocsBlock   { docs, onInsert }
        │     └── DocRecommendItem { doc, inserted, onInsert }
        ├── SimilarTicketsBlock { tickets }
        │     └── SimilarTicketItem { ticket }   // [열기] → /admin/tickets/{id} 새 탭
        └── GenerateDraftButton { models, defaultModelId, remembered, onClick→openModal }

AiModelSelectModal
  props: { models, defaultModelId, docs, open, onClose, onConfirm({modelId, docIds, remember}) }
  // localStorage key: 'ai-reply-model' (modelId), 'ai-reply-remember'

AiDraftOverlay
  props: { model: AiModel, citations: Citation[], onDismiss }
  └── AiDraftBadge "⚠️ AI 생성 — 검수 후 발송" (role=status)
  └── AiSourceChips { citations }  // 칩 클릭 → 문서 새 탭
```

### 9.2 데이터 흐름
- `page.tsx`(서버): `getTicketAssist(id)` + `listActiveModels()` + `getDefaultModel()` → `AdminReplyForm`에 SSR props.
- 추천은 정적(서버) / 초안 생성만 클라이언트 액션.

### 9.3 상태 전이 (요약, Plan §8.4)
- 패널: SSR 데이터 즉시 렌더(추천은 로딩 없음). 빈 결과 → `DocEmptyState`/`TicketEmptyState`.
- 초안: idle → (모달) → drafting(스피너) → success(오버레이+에디터 교체, 기존 작성분 있으면 ConfirmDialog) / error(toast).
- 모델 0개: 모달이 "어드민에서 AI 모델을 활성화하세요" EmptyState.

### 9.4 검수 강제(이중)
- 시각: `AiDraftOverlay` amber `Alert` 고정(에디터 상단), 내용 전체 삭제 시에만 해제.
- 기술: §7.2 ConfirmDialog 게이트.

### 9.5 반응형/접근성 (Plan §8.5)
- 데스크톱: 답변 폼 하단 인라인 패널(grid 유지) / 모바일: Accordion 기본 닫힘.
- 패널 `max-h-[400px]` 내부 스크롤, 데스크톱 sticky 검토.
- Dialog 포커스 트랩+복귀, RadioGroup 키보드, 유사도 `aria-label`, 배지 색상+숫자 병기.

---

## 10. 시퀀스

### 10.1 초안 생성
```
매니저 → GenerateDraftButton 클릭
  → AiModelSelectModal (models=listActive, default=getDefault, docs=추천)
  → [초안 생성] (modelId, docIds, remember)
     → generateReplyDraftAction
        → getActiveModelById → loadDocBodies → buildTicketDraftUser
        → draft-provider.generateDraft(provider 분기)
             anthropic: runClaudeText(+cache)  |  openai: runOpenAIText
        → logActivity(ai.draft_generated)  // F&F
     ← { draft, citations }
  → (기존 작성분? ConfirmDialog) → 에디터 content 교체 + AiDraftOverlay
```
### 10.2 발송
```
[공개답변 등록] → (미수정? ConfirmDialog 검수)
  → addAdminPublicMessageAction(content, meta{aiModel, aiModified})
  → ticket_messages insert + router.refresh
```

---

## 11. 권한 · 로깅 · 레이트리밋

| 항목 | 처리 |
|:-|:-|
| 어시스트/초안 | `requireRole(['manager','admin'])` — 호텔리어 노출 0 |
| 모델 마스터 | `requireRole(['admin'])` |
| 로깅 | `activity_logs`: `ai.draft_generated`{provider,model,docCount}, 발송 메시지 meta{aiModel,aiModified} |
| 비용 | 기존 `cost-tracker.ts` `trackCost` — provider/model별 누적 |
| 레이트리밋 | 기존 `lib/ai/rate-limiter.ts` 버킷 `ticket-draft` 적용(연타 방지) |
| 인젝션 | 티켓/문서는 user 메시지 컨텍스트로만, system 우선. 출력은 텍스트로만 사용(도구 호출 없음) |

---

## 12. 마이그레이션 · 백필

```bash
# 1) 스키마: tickets.embedding + ai_models
pnpm drizzle-kit generate     # push 금지!
pnpm drizzle-kit migrate
# 2) ai_models 시드 (4개)
pnpm db:seed:ai-models
# 3) 기존 티켓 임베딩 백필
pnpm db:backfill-ticket-embeddings   # embedText 배치, 실패분 로그
```
- 백필 스크립트: `embedding IS NULL` 티켓을 배치(예: 50건)로 `embedText` → 진행률 로그, rate-limit 고려 sleep.

---

## 13. 구현 순서 체크리스트

- [ ] `db/schema/tickets.ts` embedding + HNSW / `ai-models.ts` 스키마 → generate+migrate
- [ ] `embeddings.ts` `buildTicketEmbeddingInput` / `tickets.ts` 갱신 훅
- [ ] `scripts/backfill-ticket-embeddings.ts` + 실행
- [ ] `ai-models.ts` 서비스 + 시드 + `master-ai-models-actions.ts`
- [ ] `/admin/master/ai-models` 화면 + 메뉴 등록
- [ ] `ticket-assist.ts` 추천 검색
- [ ] `llm.ts` `runOpenAIText` / `draft-provider.ts` / `prompts/ticket-reply-drafter.ts`
- [ ] `ticket-assist-actions.ts` `generateReplyDraftAction`
- [ ] `ai-assist/*` 컴포넌트 (패널·모달·오버레이·스켈레톤)
- [ ] `admin-reply-form.tsx` 통합(인용·초안·검수 게이트) / `page.tsx` SSR props
- [ ] 발송 meta(aiModel/aiModified) + 로깅
- [ ] 임계값·프롬프트 실데이터 튜닝 → `/pdca analyze`

---

> **다음 단계**: Design 검토 승인 → 구현 착수(`/pdca do ai-reply-assist`). 구현 순서는 §13.
