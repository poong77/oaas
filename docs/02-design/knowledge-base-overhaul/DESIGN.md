# knowledge-base-overhaul — PDCA Design

> **Plan 참조**: [PLAN.md](./PLAN.md) · **Open Questions**: 모두 추천안 채택 확정
> **표기**: [CTO] [UX] [UI] [AS] [CS] 인라인 관점 태그

---

## Executive Summary

| 항목 | 결정 사항 |
|---|---|
| **AI 모델** | Claude **Sonnet 4.6** (`claude-sonnet-4-6`) + prompt caching |
| **호출 한도** | 매니저당 분당 10회 / 일 200회 (메모리 기반 rate limit) |
| **본문 cap** | 입력 본문 5000자 초과 시 truncation + 토스트 알림 |
| **인기치 가중** | `viewCount × 0.7 + helpfulYes × 0.3` |
| **본문 골격** | AS 팀 초안 → `lib/articles/templates.ts` (코드 상수) |
| **content_type 카드** | 호버 시 골격 미리보기 (popover) |
| **덮어쓰기** | 기존 본문 존재 시 `ConfirmDialog`로 의도 확인 |
| **월 예산** | $50 (Sonnet 4.6 기준 약 5,000회) |
| **Stream B (v1.1 추가)** | B1 `/help/[product]` menu_taxonomies 트리 사이드바 · B2 `/role/[key]` role_starters DB 연동 + 어드민 매핑 UI |
| **신규/변경 파일 합계** | **29개** (신규 21, 변경 8) — Drizzle 변경 0 |

### 4-Perspective Value

| 관점 | 내용 |
|---|---|
| **Problem** | Plan과 동일. Design은 "어떻게 만들 것인가"의 구체화 |
| **Solution** | 12개 신규 모듈 + 1개 RichEditor 확장. 기존 article-editor.tsx(519줄)를 5개 컴포넌트로 분리. Drizzle 스키마 변경 없음 |
| **Function · UX** | 좌측 본문(60%) / 우측 사이드바(40%) 레이아웃 — 의도 카드 · 메타 폼 · AI 보조 · 실시간 체크리스트 · 워닝 · 발행 버튼 |
| **Core Value** | 매니저의 작업 동선을 "위→아래" 한 방향 스크롤로 정렬. 결정 지점마다 [추천 적용]/[수동] 양 옵션 유지하여 작성자 자율성 보존 |

---

## 1. Information Architecture

### 1-1. 화면 IA (article editor v2)

```
┌──────────────────────────────────────────────────────────────────────┐
│  PageHeader  ← Breadcrumb (← 아티클 관리)                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─ Left (60%) ──────────────────────┐  ┌─ Right Sidebar (40%) ──┐ │
│  │                                    │  │                        │ │
│  │  [1] IntentSelector                │  │  ChecklistSidebar      │ │
│  │      (content_type 3-card)         │  │  ┌──────────────────┐ │ │
│  │      ↑ hover: popover 미리보기      │  │  │ Phase 진척률 73% │ │ │
│  │                                    │  │  │ ─────────────    │ │ │
│  │  [2] EditorMetaForm                │  │  │ ✓ 의도 선택      │ │ │
│  │      - productCode (select)        │  │  │ ✓ 메뉴 경로      │ │ │
│  │      - MenuPathCascader (3단)      │  │  │ ✓ 제목 200자     │ │ │
│  │      - title                       │  │  │ ✓ slug 사용가능  │ │ │
│  │      - slug ([자동][중복확인])      │  │  │ ✓ summary 200자  │ │ │
│  │      - summary                     │  │  │ ✓ 키워드 7개     │ │ │
│  │      - KeywordRecommender          │  │  │ ⏳ H2 #1 목표    │ │ │
│  │      - RelatedArticleAutocomplete  │  │  │ ⏳ H2 #2 단계    │ │ │
│  │                                    │  │  │ ⏳ H2 #3 결과    │ │ │
│  │  [3] AiAssistantPanel (sticky bar) │  │  │ ⏳ H2 #4 다음    │ │ │
│  │      "✨ AI 보조" 버튼              │  │  └──────────────────┘ │ │
│  │                                    │  │                        │ │
│  │  [4] EditorBody                    │  │  ValidationPanel       │ │
│  │      RichEditor (Tiptap)           │  │  (errors/warnings 카드)│ │
│  │                                    │  │                        │ │
│  │  [5] ActionBar                     │  │                        │ │
│  │      [Draft 저장] [발행하기]        │  │                        │ │
│  └────────────────────────────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

[UX] 좌측은 "지금 무엇을 할 차례인가" 흐름. 위에서 아래로 의도→메타→AI보조→본문→발행 단방향. 우측은 "현재 상태가 어떤가" 거울. 두 영역은 독립적이지만 동기.
[UI] 우측 사이드바는 ≥1024px만 노출. 그 미만은 상단 collapsible 패널로 전환. 모바일에서도 체크리스트는 toggle FAB로 노출.

### 1-2. 데이터 흐름 (의존 그래프)

```
[Master Data]
  menu_taxonomies ──────► getMenuTaxonomyTree(productCode) ─► MenuPathCascader
  term_synonyms ────────► expandKeywords() ────────────────► recommendKeywords()
  articles (자체) ──────► searchArticlesForAutocomplete()  ─► RelatedAutocomplete
  categories ───────────► getProductCategories() ──────────► productCode 옵션
                                                                       │
[Editor State]                                                         ▼
  contentType ──┐                                              KeywordRecommender
  title ────────┼──► recommendKeywords({input}) ──► chips
  body ─────────┤
  productCode ──┴──► recommendRelatedArticles({input}) ─► chips + autocomplete

[AI Assistance]
  (title + body + contentType + productCode + categoryPath + keywords)
    │
    ▼
  aiAssistArticle() ──► AiAssistantPanel (cards)
    │                       │
    │                       ▼
    │                  [Apply] → 해당 필드 setValue + 토스트
    │                       │
    ▼                       ▼
  rate-limiter            ChecklistSidebar 즉시 갱신
    │
    ▼ (실패 시)
  graceful degrade ──► 토스트 "AI 보조 일시 중단, 수동 입력으로 계속"
```

[CTO] 모든 추천/AI 호출은 server action으로만 호출 — 클라이언트에서 직접 Anthropic SDK 호출 금지(키 노출 위험).

---

## 2. Component Inventory & 디렉토리 구조

### 2-1. 신규/변경 파일 (최종 확정)

```
lib/
  articles/
    templates.ts                       [NEW]   content_type별 본문 골격 + placeholder
    recommend.ts                       [NEW]   recommendKeywords/recommendRelatedArticles 로직
    body-validator.ts                  [EDIT]  H2 진척률 + 체크리스트 항목 함수 추가
  ai/
    anthropic-client.ts                [NEW]   Claude SDK wrapper (Sonnet 4.6 + cache)
    prompts/
      article-assistant.ts             [NEW]   system 프롬프트 + JSON 스키마 + zod 검증
    rate-limiter.ts                    [NEW]   메모리 기반 sliding window (호텔리어 식별자별)
    cost-tracker.ts                    [NEW]   토큰 사용량 + 비용 추적 (개발 환경 console)
  services/
    master-menu-taxonomies.ts          [EDIT]  getMenuTaxonomyTree(productCode) 추가
    articles.ts                        [EDIT]  searchArticlesForAutocomplete(q, productCode?) 추가

app/
  actions/
    article-actions.ts                 [EDIT]  4종 server action 추가
                                              - getMenuTaxonomyTreeAction
                                              - recommendKeywordsAction
                                              - recommendRelatedArticlesAction
                                              - aiAssistArticleAction
  (admin)/admin/articles/
    _components/
      article-editor.tsx               [REFACTOR] 519줄 → 100줄(shell만, 5컴포넌트 조합)
      editor/                          [NEW DIR]
        intent-selector.tsx            [NEW]   3-card + hover popover
        editor-meta-form.tsx           [NEW]   product/slug/title/summary/cascader/keywords/related
        editor-body.tsx                [NEW]   RichEditor wrapper + 템플릿 주입
        article-checklist-sidebar.tsx  [NEW]   실시간 체크리스트 (sticky)
        ai-assistant-panel.tsx         [NEW]   AI 보조 sticky bar + 카드 패널
      menu-path-cascader.tsx           [NEW]   3단 캐스케이드 + 수동 fallback
      keyword-recommender.tsx          [NEW]   추천 칩 + 클릭 추가
      related-article-autocomplete.tsx [NEW]   검색 + 추천 칩

components/editor/
  rich-editor.tsx                      [EDIT]  forwardRef + onInsertTemplate prop

tests/e2e/
  knowledge-base/                      [NEW DIR]
    kb-01-howto-create.spec.ts         [NEW]   howto 작성 + 발행
    kb-02-feature-create.spec.ts       [NEW]   feature 작성 + 발행
    kb-03-troubleshoot-create.spec.ts  [NEW]   troubleshoot 작성 + 발행
    kb-04-ai-assist-apply.spec.ts      [NEW]   AI 보조 적용 → 메타 일괄 채움
    kb-05-manual-fallback.spec.ts      [NEW]   AI 거부 → 수동 입력
    kb-06-api-degradation.spec.ts      [NEW]   Anthropic 모의 장애 시 fallback
    kb-07-help-menu-tree.spec.ts       [NEW]   B1: /help/[product] 사이드바 트리 → 아티클 도달
    kb-08-role-starter.spec.ts         [NEW]   B2: /role/[key] 매핑된 아티클 노출 + 어드민 매핑 UI 편집

# Stream B 추가
lib/services/
  role-starters.ts                     [NEW]   getRoleStarterWithArticles(roleKey), updateRoleStarterArticleIds

app/
  actions/
    role-starter-actions.ts            [EDIT]  getRoleStarterWithArticlesAction, updateRoleStarterArticleIdsAction
  help/[product]/
    _components/
      menu-tree-sidebar.tsx            [NEW]   menu_taxonomies 트리 사이드바 (펼침/접힘 + URL 동기)
    page.tsx                           [EDIT]  사이드바 영역을 MenuTreeSidebar로 교체
  role/[key]/page.tsx                  [REWRITE] 정적 ROLE_STARTERS → DB 기반
  (admin)/admin/master/role-starters/
    _components/
      role-starter-mapping-form.tsx    [EDIT]   articleIds 검색 자동완성 + 드래그 정렬
```

[CTO] 전체 변경 파일 약 22개. 신규 17개 + 변경 5개. Drizzle migration 0건.

### 2-2. 컴포넌트 계약 (props 인터페이스)

```ts
// editor/intent-selector.tsx
export interface IntentSelectorProps {
  value: ArticleContentType;
  onChange: (next: ArticleContentType) => void;
  onTemplateRequest: (next: ArticleContentType) => Promise<void>; // confirm dialog 후 호출
  disabled?: boolean;
}

// editor/menu-path-cascader.tsx
export interface MenuPathCascaderProps {
  productCode: string;
  value: string[];            // ['예약 관리', '예약 등록']
  onChange: (path: string[]) => void;
  allowManual?: boolean;      // 기존 데이터 호환 fallback
}

// editor/keyword-recommender.tsx
export interface KeywordRecommenderProps {
  inputContext: { title: string; body: string; productCode: string };
  current: string[];
  onAdd: (keyword: string) => void;
}

// editor/related-article-autocomplete.tsx
export interface RelatedAutocompleteProps {
  inputContext: { productCode: string; categoryPath: string[]; keywords: string[]; body: string };
  current: string[];          // slug or uuid
  onAdd: (slugOrId: string) => void;
  onRemove: (slugOrId: string) => void;
}

// editor/ai-assistant-panel.tsx
export interface AiAssistantPanelProps {
  inputContext: {
    title: string; body: string; contentType: ArticleContentType;
    productCode: string; categoryPath: string[]; existingKeywords: string[];
  };
  onApply: (patch: Partial<ArticleFormState>) => void;
  disabled?: boolean;         // 본문 < 500자 등
}

// editor/article-checklist-sidebar.tsx
export interface ChecklistSidebarProps {
  state: ArticleFormState;
  validation: ValidationResult;        // body-validator 반환
  bodyOutline: BodyOutline;            // H2 진척률
}
```

---

## 3. 데이터 모델 & 타입

### 3-1. 기존 Drizzle 스키마 (변경 없음 — 그대로 사용)

- `articles` 테이블의 `categoryPath: text[]`, `keywords: text[]`, `relatedSlugs: text[]` 그대로
- `menu_taxonomies` 그대로
- `term_synonyms`, `term_groups` 그대로

### 3-2. 신규 TypeScript 타입

```ts
// lib/articles/templates.ts
export interface ArticleTemplate {
  contentType: ArticleContentType;
  outline: TemplateHeading[];          // H2 4개 (정렬 순서)
  bodyMarkdown: string;                // 골격 마크다운 (placeholder 텍스트 포함)
  hoverPreview: string;                // 카드 호버 시 표시 (≤120자 요약)
}
export interface TemplateHeading {
  level: 2 | 3;
  text: string;                        // "목표", "사전 준비" 등
  placeholder: string;                 // "이 작업의 최종 목표를 한 문장으로 적어주세요"
  required: boolean;                   // body-validator REQUIRED_H2_BY_TYPE 와 일치
}

// lib/articles/recommend.ts
export interface KeywordRecommendation {
  term: string;
  source: 'synonym' | 'body-extract' | 'popular';
  groupId?: string;                    // term_groups.id
  weight: number;                      // 정렬용
}
export interface RelatedArticleRecommendation {
  id: string;
  slug: string;
  title: string;
  productCode: string;
  reason: 'same-category' | 'keyword-overlap' | 'body-link';
  weight: number;
}

// lib/ai/prompts/article-assistant.ts
export interface AiAssistOutput {
  slug: string;
  summary: string;
  keywords: string[];
  related_search_hints: string[];
  chatbot_meta: {
    intent: string;
    entities: string[];
    steps?: string[];                  // howto/troubleshoot only
    expected_time_minutes: number;
    prerequisites: string[];
  };
}

// editor 통합 상태 (article-editor.tsx 내부)
export interface ArticleFormState {
  productCode: string;
  contentType: ArticleContentType;
  categoryPath: string[];
  title: string;
  slug: string;
  summary: string;
  keywords: string[];
  related: string[];                   // slug 우선, uuid 호환
  bodyMarkdown: string;
}

// body-validator 확장
export interface BodyOutline {
  totalRequired: number;               // REQUIRED_H2_BY_TYPE.length
  presentRequired: number;             // 본문에 등장한 필수 H2 수
  items: BodyOutlineItem[];
}
export interface BodyOutlineItem {
  text: string;
  present: boolean;
  hasContent: boolean;                 // H2 다음에 비어있지 않은 텍스트가 있는가
}
```

[AS] `chatbot_meta` 스키마는 Stream C(v2)에서 그대로 articles 테이블에 `chatbot_meta JSONB` 컬럼으로 영속화될 형태. v1에서는 화면에서만 표시 + draft에 보관.

---

## 4. Server Actions / API 시그니처

```ts
// app/actions/article-actions.ts (편집 부분)

'use server';

import { requireRole } from '@/lib/permissions';
import { rateLimitOrThrow } from '@/lib/ai/rate-limiter';

export async function getMenuTaxonomyTreeAction(productCode: string): Promise<MenuTreeNode[]> {
  await requireRole(['manager', 'admin']);
  return getMenuTaxonomyTree(productCode);
}

export async function recommendKeywordsAction(input: {
  title: string;
  body: string;
  productCode: string;
  existing: string[];
}): Promise<KeywordRecommendation[]> {
  await requireRole(['manager', 'admin']);
  return recommendKeywords(input);
}

export async function recommendRelatedArticlesAction(input: {
  productCode: string;
  categoryPath: string[];
  keywords: string[];
  body: string;
  excludeId?: string;
}): Promise<RelatedArticleRecommendation[]> {
  await requireRole(['manager', 'admin']);
  return recommendRelatedArticles(input);
}

export async function searchArticlesForAutocompleteAction(
  q: string,
  productCode?: string,
): Promise<Array<{ id: string; slug: string; title: string; productCode: string }>> {
  await requireRole(['manager', 'admin']);
  return searchArticlesForAutocomplete(q, productCode);
}

export async function aiAssistArticleAction(input: {
  title: string;
  body: string;
  contentType: ArticleContentType;
  productCode: string;
  categoryPath: string[];
  existingKeywords: string[];
}): Promise<{ ok: true; data: AiAssistOutput } | { ok: false; reason: 'rate-limit' | 'api-error' | 'parse-error'; message: string }> {
  const user = await requireRole(['manager', 'admin']);
  try {
    await rateLimitOrThrow(user.id, { perMin: 10, perDay: 200 });
    const truncated = truncateBody(input.body, 5000);
    const raw = await callClaudeAssistant({ ...input, body: truncated.text });
    const parsed = AiAssistOutputSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, reason: 'parse-error', message: 'AI 출력 형식이 예상과 달라요. 다시 시도해주세요.' };
    return { ok: true, data: parsed.data };
  } catch (e) {
    if (e instanceof RateLimitExceededError) return { ok: false, reason: 'rate-limit', message: e.message };
    return { ok: false, reason: 'api-error', message: 'AI 보조가 일시적으로 동작하지 않아요. 잠시 후 다시 시도해주세요.' };
  }
}
```

[CTO] 모든 server action은 권한 + rate limit + try-catch + JSON 스키마 검증의 4중 안전망. 클라이언트는 `{ ok, ... }` 디스크리미네이티드 유니온으로 안전하게 분기.

### 4-1. 추천 알고리즘 의사 코드

```ts
// lib/articles/recommend.ts
export async function recommendKeywords({ title, body, productCode, existing }: KeywordInput): Promise<KeywordRecommendation[]> {
  // 1) 본문 토큰 추출 → 동의어 그룹 매칭
  const tokens = tokenizeKorean(title + ' ' + body);
  const synonymHits = await matchSynonymGroups(tokens);        // [{ groupId, terms[] }]

  // 2) 같은 product + content_type 인기 키워드 (viewCount × 0.7 + helpfulYes × 0.3)
  const popular = await getPopularKeywords(productCode, { weights: { view: 0.7, helpful: 0.3 }, limit: 15 });

  // 3) merge + dedup + 기존 제외
  const all = [
    ...synonymHits.flatMap(h => h.terms.map(t => ({ term: t, source: 'synonym' as const, groupId: h.groupId, weight: 10 }))),
    ...extractTopTokens(tokens, 5).map(t => ({ term: t, source: 'body-extract' as const, weight: 7 })),
    ...popular.map(p => ({ term: p.term, source: 'popular' as const, weight: p.score })),
  ];
  const filtered = all
    .filter(r => !existing.includes(r.term))
    .sort((a, b) => b.weight - a.weight);
  return uniqByTerm(filtered).slice(0, 7);
}

export async function recommendRelatedArticles({ productCode, categoryPath, keywords, body, excludeId }: RelatedInput): Promise<RelatedArticleRecommendation[]> {
  // 1) 같은 productCode + categoryPath top 5 (viewCount 기준)
  const sameCategory = await listArticles({ productCode, categoryPath, publishedOnly: true, sortBy: 'view_count', pageSize: 5 });

  // 2) keywords 교집합 ≥ 2 인 아티클 top 5
  const keywordOverlap = await searchByKeywordsOverlap(productCode, keywords, { minOverlap: 2, limit: 5 });

  // 3) 본문 내 마크다운 링크 자동 추출 (이미 참조한 아티클)
  const bodyLinks = extractMarkdownLinks(body).filter(l => l.startsWith('/help/'));
  const linkedArticles = await getArticlesByLinks(bodyLinks);

  // 4) merge + dedup + 자기 자신 제외 + top 7
  const all = [
    ...sameCategory.items.map(a => ({ ...a, reason: 'same-category' as const, weight: 10 })),
    ...keywordOverlap.map(a => ({ ...a, reason: 'keyword-overlap' as const, weight: 8 })),
    ...linkedArticles.map(a => ({ ...a, reason: 'body-link' as const, weight: 9 })),
  ];
  return uniqById(all).filter(a => a.id !== excludeId).sort((a, b) => b.weight - a.weight).slice(0, 7);
}
```

[AS] body 토큰화는 한국어 처리가 까다로움. 1차 구현은 단순 split(/\s+/) + 2자 이상만 + 불용어 제거. 정확도 부족하면 Phase 2 후반에 한국어 형태소 분석기 도입 검토(별도 사이클).

---

## 5. AI 프롬프트 상세

### 5-1. 시스템 프롬프트 (`lib/ai/prompts/article-assistant.ts`)

```ts
export const SYSTEM_PROMPT = `당신은 호텔 OA 솔루션(PMS/CMS/Keyless/키오스크/웹) 도움말 작성 보조입니다.
역할: 매니저가 작성 중인 아티클을 받아 5종 메타데이터를 제안합니다.

원칙:
1. "1아티클=1의도" — 다중 의도가 보이면 가장 우선되는 하나만 채택, chatbot_meta.intent에 그 의도만 한 문장으로.
2. 호텔 현장 어휘 보존 — 약어(CI, CO, OTA, PMS 등)는 본문 그대로 유지하되, keywords에는 한글 풀어쓴 형태와 함께 포함.
3. CS 톤 — 객관·단호·공감. 마케팅 톤(✨엄청난✨) 금지.
4. 자기완결 — summary는 아티클을 읽지 않아도 30초 안에 의미가 통해야 함.
5. 보수성 — 본문에 명시적으로 없는 사실은 추측 금지. 추측한 항목은 빈 배열/null.

출력: 다음 JSON 스키마만 출력. 마크다운/주석/설명 금지.

{
  "slug": string (영문 소문자 + 하이픈, 60자 이내, 핵심 단어 1~3개 결합. 한글은 roman transliteration),
  "summary": string (한국어, 150~200자, 30초 이해 가능),
  "keywords": string[] (7~10개, 호텔리어 현장 어휘 + 공식 어휘 동의어 포함, 약어와 풀이 모두),
  "related_search_hints": string[] (3~5개, 관련 아티클 검색에 쓸 키워드),
  "chatbot_meta": {
    "intent": string (한 문장, "X 작업의 Y 방법" 형식),
    "entities": string[] (이 아티클이 다루는 객체: 예약, 객실, 카드결제 등),
    "steps": string[] | null (howto/troubleshoot 만, 동사구로),
    "expected_time_minutes": number,
    "prerequisites": string[]
  }
}

context: content_type별 본문 골격은 system context로 캐시됩니다(prompt cache).
- howto: 목표 → 사전 준비 → 단계 → 다음 단계
- feature: 개요 → 위치(메뉴 경로) → 항목 설명 → 관련 문서
- troubleshoot: 증상 → 원인 → 해결 단계 → 그래도 안 되면`;
```

### 5-2. 사용자 메시지 템플릿

```ts
export function buildUserMessage(input: AiAssistInput): string {
  return [
    `[contentType] ${input.contentType}`,
    `[productCode] ${input.productCode}`,
    `[categoryPath] ${input.categoryPath.join(' > ') || '(미정)'}`,
    `[existingKeywords] ${input.existingKeywords.join(', ') || '(없음)'}`,
    `[title]\n${input.title}`,
    `[body]\n${input.body}`,
  ].join('\n\n');
}
```

### 5-3. Anthropic SDK 호출 (`lib/ai/anthropic-client.ts`)

```ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function callClaudeAssistant(input: AiAssistInput): Promise<unknown> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }, // 캐시 적용
    ],
    messages: [
      { role: 'user', content: buildUserMessage(input) },
    ],
  });

  // 비용 추적 (cache hit 로 토큰 비용 절감 측정)
  trackCost({ inputTokens: message.usage.input_tokens, cacheReadTokens: message.usage.cache_read_input_tokens ?? 0, outputTokens: message.usage.output_tokens });

  const block = message.content.find(b => b.type === 'text');
  if (!block) throw new Error('AI response missing text block');
  return JSON.parse(block.text);
}
```

[CTO] 모델 ID는 `claude-sonnet-4-6` (System knowledge의 최신 ID). prompt caching은 system 프롬프트 4000자 이상 대상이지만 본 system 프롬프트는 짧음 → 향후 context(content_type 가이드, 호텔리어 어휘 사전 등)를 system에 추가해 4000자 넘기면 cache_control 적용 효과 발생. v1은 cache_control 마킹만 해두고 캐시 효과는 v2에서 측정.

### 5-4. Rate Limiter (메모리 기반)

```ts
// lib/ai/rate-limiter.ts
const windows = new Map<string, { minute: number[]; day: number[] }>();

export async function rateLimitOrThrow(userId: string, opts: { perMin: number; perDay: number }) {
  const now = Date.now();
  const w = windows.get(userId) ?? { minute: [], day: [] };
  w.minute = w.minute.filter(t => now - t < 60_000);
  w.day = w.day.filter(t => now - t < 86_400_000);
  if (w.minute.length >= opts.perMin) throw new RateLimitExceededError('분당 한도 초과 (10회). 1분 후 다시 시도해주세요.');
  if (w.day.length >= opts.perDay) throw new RateLimitExceededError('일일 한도 초과 (200회). 내일 다시 시도해주세요.');
  w.minute.push(now); w.day.push(now);
  windows.set(userId, w);
}
```

[CTO] 메모리 기반은 단일 인스턴스 한정. Vercel 서버리스 환경에서는 instance 별로 분리되니 정확하지 않음 → Upstash Redis로 교체는 v2 검토. v1은 "느슨한" 보호로 충분.

---

## 6. 본문 골격 (AS 팀 초안)

### 6-1. howto (사용방법) — "따라하기"

```markdown
## 목표

> 이 작업을 마쳤을 때 얻는 결과를 한 문장으로 적어주세요. (예: 신규 예약을 5분 안에 등록하고 객실 배정까지 완료한다.)

## 사전 준비

- 필요한 권한/계정/데이터를 항목으로 적어주세요.
- 미리 확인할 메뉴 경로를 함께 적어주세요.

## 단계

1. **첫 번째 단계** — 동사로 시작. 화면 캡처가 있으면 함께.
2. **두 번째 단계** — 한 단계 = 한 동작.
3. **세 번째 단계** — 결과 화면을 보여주는 것까지가 한 단계.

## 다음 단계

작업 후 호텔리어가 자주 묻는 후속 작업을 1~3개 적어주세요. (예: 등록한 예약에 결제 정보 추가하기)
```

### 6-2. feature (기능설명) — "이해하기"

```markdown
## 개요

이 기능이 무엇을 하는지, 어떤 호텔리어가 언제 쓰는지 한 문단으로 적어주세요.

## 위치 (메뉴 경로)

PMS > 예약 관리 > 예약 등록 > "신규" 버튼

## 항목 설명

| 항목 | 설명 |
|---|---|
| (필드명) | (이 필드가 무엇을 의미하는지, 어떤 형식인지, 기본값) |
| (필드명) | … |

## 관련 문서

관련 가이드 1~3개를 자동 추천에서 선택하거나 직접 입력하세요.
```

### 6-3. troubleshoot (문제해결) — "고치기"

```markdown
## 증상

호텔리어가 실제로 보는 증상을 그대로 적어주세요. (예: 카드 결제 시 "승인 거절" 메시지가 뜬다)

## 원인

가능한 원인을 가능성 높은 순으로 1~3개.

## 해결 단계

1. **첫 번째 시도** — 가장 흔한 해결책부터.
2. **두 번째 시도** — 첫 번째로 해결 안 될 때.
3. **확인 사항** — 해결되었는지 확인하는 방법.

## 그래도 안 되면

- 어떤 정보를 모아서 어디로 문의해야 하는지 정확히 적어주세요.
- 관련 솔루션 링크/연락처를 추천 마스터에서 선택할 수 있어요.
```

[CS] 톤 가이드: 명령형(~하세요)보다 청유형(~해주세요)을 기본으로. "안 됩니다"보다 "안 되는 경우가 있어요"가 호텔리어 부담을 줄임.
[AS] 각 골격의 placeholder 텍스트는 발행 시 자동으로 제거 (`> ` blockquote + 안내 패턴 감지).

---

## 7. UX 흐름 (워크플로우)

### 7-1. 신규 작성 황금 경로 (target 8분)

```
T+0:00  매니저 /admin/articles/new 진입
T+0:10  의도 카드 호버 → 미리보기 popover 확인 → "사용방법" 클릭
        → 본문 골격 + 사이드바 체크리스트 4개 추가
T+0:30  productCode 선택 → MenuPathCascader 활성화
T+0:50  메뉴 경로 3단 선택 → categoryPath 직렬화 (체크 ✓)
T+1:00  제목 입력 → slug 자동 제안 (사용자가 [자동] 클릭)
T+1:15  summary 한 줄 입력 → 200자 워닝 없음 (체크 ✓)
T+1:30  KeywordRecommender 자동 노출 → 3개 칩 클릭으로 추가 (체크 ✓)
T+1:45  본문 작성 시작 — 첫 H2 "목표" 작성 (체크 ⏳ → ✓)
T+5:00  본문 H2 4개 모두 작성 완료 (모든 체크 ✓)
T+5:30  RelatedAutocomplete 자동 추천 → 2건 선택
T+6:00  "✨ AI 보조" 클릭 → 5초 → 5종 제안 카드
T+6:30  slug/summary/chatbot_meta 카드 [Apply] (keywords/related는 이미 채워서 [Reject])
T+7:00  검증 패널 ✅ "검증 통과 — 발행 가능"
T+7:30  [발행하기] → ConfirmDialog → 발행 완료
T+8:00  목록 페이지로 redirect
```

### 7-2. 기존 본문 있을 때 의도 변경 (덮어쓰기 시나리오)

```
1. 의도 카드 클릭 (예: howto → troubleshoot)
2. 본문 텍스트가 비어있지 않으면 ConfirmDialog 자동 노출:
   "현재 본문이 있어요. troubleshoot 골격으로 바꾸면 본문이 새 골격으로 덮어쓰여요. 진행할까요?"
   [취소] [덮어쓰기]
3. 취소: 의도는 변경되지만 본문 유지 (사이드바 체크리스트가 새 의도 기준으로 갱신, 일부 ⏳ 표시)
4. 덮어쓰기: 본문이 새 골격으로 교체, 사이드바 체크리스트 동기
```

[UX] 의도 변경 자체는 빈번하지 않지만 일어나면 위험이 큰 액션. 양 선택지를 모두 제공.

### 7-3. AI 보조 호출 실패 (graceful degradation)

```
1. [✨ AI 보조] 클릭
2. 5초 spinner
3. 응답:
   - { ok: false, reason: 'rate-limit' } → 토스트 "분당 한도 초과. 1분 후 다시 시도해주세요." + 버튼 60초 비활성화
   - { ok: false, reason: 'api-error' } → 토스트 "AI 보조가 일시 중단됐어요. 수동으로 계속 작성해주세요." + 버튼은 활성 유지 (재시도 가능)
   - { ok: false, reason: 'parse-error' } → 토스트 "AI 출력이 이상해요. 한 번 더 시도해주세요." + 버튼 유지
```

[UX] 실패 시에도 작성 흐름이 멈추지 않는 게 핵심. 사이드바 체크리스트와 수동 입력은 항상 동작.

---

## 8. UI 디자인 시스템

### 8-1. 색상 토큰 (기존 brand-* 활용)

| 토큰 | 용도 |
|---|---|
| `brand-50/100` | 의도 카드 선택 배경, AI 카드 호버 배경 |
| `brand-500/600` | 강조 액션 (발행, AI 보조 버튼), 진척률 막대 |
| `emerald-500/600` | 체크리스트 완료 ✓, 검증 통과 |
| `amber-500/600` | 워닝, 진행 중 ⏳ |
| `rose-500/600` | errors, 발행 차단 |
| `slate-50/100/200` | 카드 배경, 보더 |

### 8-2. 마이크로 인터랙션

| 컴포넌트 | 인터랙션 |
|---|---|
| 의도 카드 | hover: `scale(1.02)` 150ms · click: `bg-brand-50` transition · 선택 시 ring-2 ring-brand-500 |
| 미리보기 popover | hover 500ms delay 후 노출 · 이탈 시 200ms fade-out |
| 사이드바 체크리스트 | 항목 완료 시 ✓ 0.3s ease-in + 항목 row `bg-emerald-50` 페이드 |
| AI 보조 카드 | 로딩 spinner 360° · 도착 시 카드 stagger 100ms |
| 발행 버튼 | disabled (errors > 0) 시 `opacity-50 cursor-not-allowed` + 호버 시 툴팁 |
| 추천 칩 | 클릭 시 칩 scale(0.95) → 사라지며 위 입력란으로 fly-up 200ms |

[UI] 모든 애니메이션은 `prefers-reduced-motion` 존중. CSS transition으로 처리(JS 의존성 최소화).

### 8-3. 반응형

| 폭 | 레이아웃 |
|---|---|
| ≥ 1280px | 좌(60%) + 우 사이드바(40%) 그리드 |
| 1024 ~ 1279px | 좌(65%) + 우(35%) 그리드, 사이드바 폭 축소 |
| 640 ~ 1023px | 단일 컬럼 + 상단 collapsible "체크리스트" 패널 |
| < 640px | 단일 컬럼 + 우하단 FAB(체크리스트 toggle) · AI 보조 버튼은 본문 위 sticky |

---

## 9. 검증 규칙 확장

### 9-1. body-validator.ts 신규 함수

```ts
// lib/articles/body-validator.ts (편집)

export function extractBodyOutline(body: string, contentType: ArticleContentType): BodyOutline {
  const required = REQUIRED_H2_BY_TYPE[contentType];
  const items: BodyOutlineItem[] = required.map(text => {
    const present = new RegExp(`^##\\s+${escapeRegex(text)}`, 'mu').test(body);
    const hasContent = present && hasContentBelow(body, text);
    return { text, present, hasContent };
  });
  return {
    totalRequired: required.length,
    presentRequired: items.filter(i => i.present).length,
    items,
  };
}

function hasContentBelow(body: string, heading: string): boolean {
  const re = new RegExp(`^##\\s+${escapeRegex(heading)}\\s*\\n([\\s\\S]*?)(?=^##\\s|$)`, 'mu');
  const m = body.match(re);
  if (!m) return false;
  // 위치 표시(>)와 공백·placeholder만 있으면 false
  const stripped = m[1].replace(/^>.*$/gm, '').replace(/^\s*$/gm, '').trim();
  return stripped.length > 20; // 20자 이상이어야 "내용 있음"
}

export function isPlaceholderOnly(body: string): boolean {
  // 골격 주입 직후 상태 감지 — placeholder/blockquote/heading만 있으면 true
  const meaningfulLines = body.split('\n').filter(l =>
    !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('-') && l.trim().length > 0
  );
  return meaningfulLines.length === 0;
}
```

[AS] `hasContent` 가 true이려면 H2 다음에 20자 이상의 실질 텍스트가 있어야 함. 골격에 placeholder만 둔 상태는 ⏳로 표시.

### 9-2. 발행 차단 규칙 (변경 없음)

기존 `validateBody`의 errors 정의 그대로 — 필수 H2 누락만 차단. 자기참조/다중의도는 v1에서도 워닝 유지 (Stream C에서 errors 승격).

---

## 10. e2e 테스트 시나리오

### 10-1. KB-01 howto 신규 작성 + 발행

```ts
// tests/e2e/knowledge-base/kb-01-howto-create.spec.ts
test('howto 작성 8분 황금 경로', async ({ page }) => {
  await login(page, 'manager');
  await page.goto('/admin/articles/new');

  await page.getByRole('button', { name: '사용방법' }).click();
  await page.getByRole('dialog', { name: /본문 골격/ }).getByRole('button', { name: '주입' }).click(); // 빈 본문은 confirm skip
  await expect(page.locator('[data-test=checklist-h2]')).toHaveCount(4);

  await page.getByLabel('제품 *').selectOption('pms');
  await page.getByTestId('cascader-1').selectOption('예약 관리');
  await page.getByTestId('cascader-2').selectOption('예약 등록');

  await page.getByLabel('제목 *').fill('신규 예약 5분 안에 등록하기');
  await page.getByRole('button', { name: '자동 생성' }).click();
  await expect(page.getByLabel('Slug (URL) *')).toHaveValue(/.+/);

  await page.getByLabel(/요약/).fill('PMS에서 신규 예약을 등록하고 객실 배정까지 5분 안에 완료하는 방법');
  // 키워드 추천에서 3개 클릭
  for (const chip of ['예약', '체크인', '객실']) {
    await page.getByTestId('keyword-recommend').getByText(chip).click();
  }
  // 본문 골격 채우기
  await page.locator('[contenteditable]').fill(/* … 4개 H2 + 내용 */);

  await expect(page.getByText('검증 통과 — 발행 가능')).toBeVisible();
  await page.getByRole('button', { name: '발행하기' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '발행' }).click();
  await expect(page).toHaveURL(/\/admin\/articles\/[a-f0-9-]+$/);
});
```

### 10-2 ~ 10-6. 나머지 시나리오

| 시나리오 | 목표 |
|---|---|
| KB-02 feature 작성 + 발행 | feature 골격 + table 작성 + 메뉴 경로 정확성 |
| KB-03 troubleshoot 작성 + 발행 | troubleshoot 골격 + "그래도 안 되면" 솔루션 링크 |
| KB-04 AI 보조 적용 | mock Anthropic → 5종 카드 → 일괄 Apply → 메타 채워짐 |
| KB-05 수동 fallback | AI 거부 + 수동 입력만으로 작성 + 발행 |
| KB-06 API 장애 fallback | Anthropic mock 500 → 토스트 + 수동 흐름 유지 |

[CTO] mock Anthropic은 `tests/e2e/_mocks/anthropic-mock.ts` 모듈로. `process.env.E2E_MOCK_AI=1` 환경변수로 toggle.

---

## 11. 마이그레이션 전략 (기존 데이터 호환)

### 11-1. categoryPath 자유 텍스트 → 마스터 일치 검증

- 기존 발행 아티클의 categoryPath 중 `menu_taxonomies`에 없는 경로 카운트 측정 → 매니저에게 매핑 UI 제공 (별도 어드민 페이지 v2).
- 본 사이클 MVP에서는 편집 시 "마스터에 없는 경로" 노란 배지만 표시. 발행 차단은 안 함 (점진 마이그레이션).
- 신규 작성은 캐스케이더 강제 (수동 입력 fallback은 권한 admin만).

### 11-2. relatedSlugs/relatedArticleIds 통합

- 기존: 양쪽 모두 string 입력 (자유 텍스트)
- 신규: `RelatedArticleAutocomplete`가 둘 다 호환. slug 우선, uuid는 레거시 데이터에만 노출.

---

## 12. 보안 / 권한

- **모든 server action**: `requireRole(['manager', 'admin'])`
- **Rate Limit**: 매니저당 분당 10회, 일 200회 (`lib/ai/rate-limiter.ts`)
- **본문 크기 제한**: 5000자 cap 후 Anthropic에 전송 (PII 우려 시 추가 필터링)
- **API 키 노출 방지**: `process.env.ANTHROPIC_API_KEY`는 server only. `NEXT_PUBLIC_*` 접두어 절대 사용 금지.
- **로그**: AI 호출 시 (userId, contentType, productCode, body length, response status, tokens, latency)만 기록. 본문 내용은 로그에 절대 저장 X.
- **CSP**: 기존 CSP 정책 변경 없음 (Anthropic 호출은 server side).

[CS] 사용자 본문이 챗봇/AI에 전송된다는 사실은 정책 페이지에 명시 (별도 사이클).

---

## 13. 관찰 가능성

### 13-1. activity_logs 신규 이벤트

| event_key | actor | metadata |
|---|---|---|
| `article.template_inserted` | manager | { contentType } |
| `article.ai_assist_called` | manager | { contentType, tokensInput, tokensOutput, latencyMs, ok } |
| `article.ai_assist_applied` | manager | { applied: ['slug', 'summary', ...] } |
| `article.menu_path_set` | manager | { source: 'cascader' \| 'manual', path } |
| `article.keyword_recommended` | manager | { source: 'synonym' \| 'body' \| 'popular', count } |

### 13-2. 개발 환경 cost-tracker

```ts
// lib/ai/cost-tracker.ts
const PRICING = { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000, cacheRead: 0.3 / 1_000_000 };
export function trackCost(usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number }) {
  const cost = usage.inputTokens * PRICING.input + usage.outputTokens * PRICING.output + usage.cacheReadTokens * PRICING.cacheRead;
  if (process.env.NODE_ENV !== 'production') console.log(`[AI cost] $${cost.toFixed(5)} (in=${usage.inputTokens}, out=${usage.outputTokens}, cache=${usage.cacheReadTokens})`);
}
```

[CTO] 프로덕션에서는 별도 메트릭 시스템(Vercel Analytics 또는 자체 DB)으로 누적. v1은 개발 환경 console 로깅으로 충분.

---

## 14. Acceptance Criteria (Design 단계)

- [ ] PLAN.md의 Phase 1~3 작업 항목이 모두 Design에 매핑됨
- [ ] 신규/변경 파일 22개 모두 명세 존재
- [ ] AI 프롬프트 + JSON 스키마 + zod 검증 코드 포함
- [ ] e2e 시나리오 KB-01 ~ KB-06 골격 정의
- [ ] 보안/권한/Rate Limit 규칙 명시
- [ ] 마이그레이션 호환 전략 (categoryPath, relatedSlugs) 명시
- [ ] 5인 팀 [CTO][UX][UI][AS][CS] 관점이 각 섹션에 반영
- [ ] 사용자 검토 + Phase 1 진입 승인

---

## 15. Stream B 세부 설계 (v1.1)

### 15-1. B1 — `/help/[product]` 메뉴 트리 사이드바

#### 15-1-1. 데이터 흐름

```
[Server (page.tsx)]
  ├─ getMenuTaxonomyTree(productCode)   ← Phase 1에서 추가됨, 재사용
  └─ listArticles({ productCode, categoryPath?, q?, publishedOnly: true, ...sp })

[Client (menu-tree-sidebar.tsx)]
  - 트리 노드 클릭 → router.push(`/help/${product}?path=${encodedPath}`)
  - URL ?path= 변경 → server 가 listArticles의 categoryPath 필터로 사용
  - 펼침 상태는 sessionStorage에 저장 (`help-tree-expand-${product}`)
```

#### 15-1-2. 컴포넌트 props

```ts
// app/help/[product]/_components/menu-tree-sidebar.tsx
export interface MenuTreeSidebarProps {
  productCode: string;
  tree: MenuTreeNode[];                       // server에서 fetch
  selectedPath?: string[];                    // URL ?path=
  articleCountsByPath: Record<string, number>;// path string → count
}

type MenuTreeNode = {
  id: string;
  label: string;
  parentId: string | null;
  children: MenuTreeNode[];
};
```

#### 15-1-3. UI 디자인

```
┌─ MenuTreeSidebar ──────────────┐
│ 카테고리 (전체 47건)           │
│ ▾ 예약 관리 (12)               │
│    예약 등록 (5) ◀ selected    │  ← bg-brand-50, font-semibold
│    예약 수정 (4)               │
│    예약 취소 (3)               │
│ ▸ 객실 관리 (8)                │
│ ▾ 결제 (15)                    │
│    카드결제 (10)               │
│    포인트 결제 (5)             │
│ ▸ 정산 (7)                     │
│ ▸ 보고서 (5)                   │
└────────────────────────────────┘
```

[UI] selected는 background + left-border 2px brand-500. hover는 bg-slate-50.

#### 15-1-4. 카테고리 카운트 계산

```ts
// app/help/[product]/page.tsx 내부
const allArticles = await listArticles({ productCode, publishedOnly: true, pageSize: 1000 });
const articleCountsByPath: Record<string, number> = {};
for (const a of allArticles.items) {
  if (!a.categoryPath) continue;
  // 누적 카운트: ['예약 관리', '예약 등록'] → '예약 관리' +1, '예약 관리/예약 등록' +1
  for (let i = 1; i <= a.categoryPath.length; i++) {
    const key = a.categoryPath.slice(0, i).join('/');
    articleCountsByPath[key] = (articleCountsByPath[key] ?? 0) + 1;
  }
}
```

[CTO] 1000건 미만은 메모리 카운트 빠름. 1000건 초과 시 SQL `GROUP BY` 쿼리로 전환.

### 15-2. B2 — `/role/[key]` 마스터 DB 연동

#### 15-2-1. 데이터 흐름

```
[Server (role/[key]/page.tsx — REWRITE)]
  ├─ getRoleStarterWithArticles(key)
  │    └─ SELECT role_starters.*, ARRAY(... articles WHERE id = ANY(articleIds))
  │       발행된 아티클만, articleIds 순서 유지
  └─ Hero (label + description + icon) + Article Card Grid

[Admin (admin/master/role-starters)]
  ├─ 기존 마스터 페이지에 articleIds 매핑 폼 추가
  ├─ RelatedArticleAutocomplete 재사용 (Phase 2 결과)
  └─ DnD 정렬 (dnd-kit 또는 기존 자체 솔루션)
```

#### 15-2-2. server action 시그니처

```ts
// app/actions/role-starter-actions.ts (편집)
export async function getRoleStarterWithArticlesAction(roleKey: string): Promise<{
  starter: { id: string; roleKey: string; label: string; description: string; icon: string };
  articles: Array<{ id: string; slug: string; title: string; summary: string; productCode: string }>;
} | null> {
  // public 접근 — 인증 불필요 (호텔리어 누구나 열람)
  return getRoleStarterWithArticles(roleKey);
}

export async function updateRoleStarterArticleIdsAction(roleKey: string, articleIds: string[]): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireRole(['admin']);
  // articleIds: 발행된 아티클만 허용 검증
  return updateRoleStarterArticleIds(roleKey, articleIds);
}
```

#### 15-2-3. UI 디자인 — `/role/[key]` 페이지

```
┌─ Hero ────────────────────────────────────────────┐
│ 🛎️  프론트 시작하기                                │
│    체크인·체크아웃·키 발급 등 프론트 데스크 업무   │
└───────────────────────────────────────────────────┘

┌─ Article Cards (순서대로) ────────────────────────┐
│ ① ┌────────────────────────────────────────────┐ │
│   │ PMS · howto                                 │ │
│   │ 호텔 PMS 첫 로그인부터 대시보드 익히기      │ │
│   │ 호텔 PMS에 처음 로그인 후 메뉴 구조와...    │ │
│   │ ⏱ 약 8분 · 📂 PMS > 시작하기              │ │
│   └────────────────────────────────────────────┘ │
│ ② ┌────────────────────────────────────────────┐ │
│   │ PMS · howto                                 │ │
│   │ 체크인 등록 — 일반 예약 케이스               │ │
│   │ ...                                          │ │
│   └────────────────────────────────────────────┘ │
│ ③ ...                                            │
└──────────────────────────────────────────────────┘

┌─ 다른 역할도 살펴보기 ───────────────────────────┐
│ [예약·판매] [하우스키핑] [관리자] [신규 오픈]    │
└──────────────────────────────────────────────────┘
```

[UI] 카드 순서는 articleIds 배열 그대로. 번호 ①②③는 ::before 가상요소로.

#### 15-2-4. 어드민 매핑 UI

```
┌─ master/role-starters / [role-key 편집] ──────────┐
│ 역할 정보                                          │
│  ┌─ label: "프론트"                              │
│  │  description: "체크인·체크아웃·키 발급..."     │
│  │  icon: BellRing  [Lucide picker]              │
│  └───────────────────────────────────────────────┘
│                                                    │
│ 추천 가이드 (드래그 정렬, articleIds)              │
│  ① PMS · 호텔 PMS 첫 로그인 (slug: pms-first-...) │
│      [↑] [↓] [✕]                                  │
│  ② PMS · 체크인 등록 — 일반 예약 (slug: pms-ci...)│
│      [↑] [↓] [✕]                                  │
│  ③ Keyless · 키 발급 (slug: keyless-issue-key)    │
│      [↑] [↓] [✕]                                  │
│                                                    │
│ 가이드 추가                                        │
│  [🔍 아티클 검색...] ← RelatedArticleAutocomplete  │
│                                                    │
│ [저장]                                             │
└────────────────────────────────────────────────────┘
```

[CS] role_starters 매핑은 운영팀이 분기마다 재검토. 트래픽/만족도 기반 교체. 본 사이클은 편집 UI만 제공하고 분석 대시보드는 v2.

### 15-3. e2e 시나리오 추가

#### KB-07 — /help 메뉴 트리

```ts
test('/help/cms 사이드바 트리에서 모든 카테고리 도달', async ({ page }) => {
  await page.goto('/help/cms');
  // 트리에 4개 1단계 노드 노출 (master 시드 기준)
  await expect(page.getByTestId('menu-tree-node-l1')).toHaveCount(4);

  // 1단계 노드 펼치기
  await page.getByText('콘텐츠 관리').click();
  await expect(page.getByTestId('menu-tree-node-l2')).toBeVisible();

  // 2단계 노드 클릭 → 필터 적용
  await page.getByText('블로그 작성').click();
  await expect(page).toHaveURL(/path=콘텐츠\+관리\/블로그\+작성/);
  await expect(page.getByTestId('article-card')).toHaveCount.toBeGreaterThan(0);

  // sessionStorage 펼침 상태 유지 확인
  await page.reload();
  await expect(page.getByTestId('menu-tree-node-l2')).toBeVisible();
});
```

#### KB-08 — /role/front 마스터 연동

```ts
test('/role/front 매핑된 아티클이 순서대로 노출', async ({ page }) => {
  // 사전 조건: master/role-starters/front 에 3개 articleId 매핑된 상태 (seed)
  await page.goto('/role/front');
  const cards = page.getByTestId('role-article-card');
  await expect(cards).toHaveCount(3);
  // 첫 카드 = articleIds[0] 의 title 노출
  await expect(cards.nth(0).getByRole('heading')).toContainText('호텔 PMS 첫 로그인');

  // 어드민에서 articleIds 순서 변경
  await loginAs(page, 'admin');
  await page.goto('/admin/master/role-starters/front');
  await page.getByTestId('role-article-row').nth(0).getByRole('button', { name: '↓' }).click();
  await page.getByRole('button', { name: '저장' }).click();

  // 다시 /role/front 방문 → 순서 변경 반영
  await page.goto('/role/front');
  await expect(page.getByTestId('role-article-card').nth(0).getByRole('heading')).not.toContainText('호텔 PMS 첫 로그인');
});
```

### 15-4. 마이그레이션 (B2)

- 기존 `_constants.ts`의 정적 `ROLE_STARTERS` 5개는 seed script로 DB에 삽입 후 코드에서 제거
- `articleIds` 초기값은 비어있음 (`[]`) — 운영팀이 매핑 UI로 채워야 노출
- `/role/[key]` 페이지는 매핑이 빈 상태에서도 동작 (EmptyState로 "아직 매핑된 가이드가 없어요" + "전체 가이드 보기" 버튼)

[AS] seed script는 `scripts/seed-role-starters.ts` 로 작성. 한 번만 실행 (idempotent).

---

## 변경 이력

- 2026-05-31 v1.0: 초안 작성 (Open Q 추천안 반영, Stream A만)
- 2026-05-31 v1.1: **Stream B 세부 설계 추가** (§15). B1 `/help/[product]` 트리 사이드바, B2 `/role/[key]` 마스터 DB + 어드민 매핑 UI. e2e KB-07, KB-08. 신규/변경 파일 22 → 29.
