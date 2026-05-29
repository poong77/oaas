# synonyms-master — Design

> **Feature**: 동의어 사전 마스터 (호텔업계 용어 검색 보강)
> **Phase**: Design (PDCA)
> **선행 문서**: [docs/01-plan/features/synonyms-master.plan.md](../../01-plan/features/synonyms-master.plan.md)
> **작성일**: 2026-05-29
> **상태**: 🟡 검수 대기 — 시드(§9) 사용자 검수 후 Do 진입

---

## 0. 개요 — Plan 결정사항 → Design 반영

Plan에서 확정된 6개 결정사항(Q-1~Q-6)을 토대로 구현 명세를 확정한다.

| ID | 결정 | Design 반영 |
|:-:|:-|:-|
| Q-1 | 정확 일치 (token == term) | §5.2 `expandKeywords` 알고리즘 — 입력 토큰화 후 set 비교 |
| Q-2 | lower() + trim() 비교 | §5.2 `normalizeTerm()` 헬퍼 — 모든 비교 전 정규화 |
| Q-3 | 2자 이상 토큰만 | §5.2 `expandKeywords` filter `t.length >= 2` |
| Q-4 | raw text 인덱스 + 메모리 캐시 | §3.1 일반 btree 인덱스, §4.2 `unstable_cache` 5분 |
| Q-5 | FK 없는 nullable text | §3.1 `suggestedCategoryId text` (FK 미설정) |
| Q-6 | Claude 초안 → 사용자 검수 | §9 시드 확정안 50개 그룹, 사용자 검수 후 `db/seed.ts` 반영 |

---

## 1. 파일 변경 요약

### 1.1 신규 파일 (12개)

| 경로 | 역할 | 라인수 추정 |
|:-|:-|:-:|
| `db/schema/term-groups.ts` | Drizzle 스키마 (그룹) | ~50 |
| `db/schema/term-synonyms.ts` | Drizzle 스키마 (동의어) | ~50 |
| `db/migrations/XXXX_synonyms_master.sql` | 테이블 2개 생성 + 인덱스 + 시드 | ~120 |
| `lib/services/master-synonyms.ts` | CRUD 서비스 (그룹·동의어) | ~280 |
| `lib/services/synonym-expander.ts` | 검색 확장 헬퍼 (`expandKeywords`) | ~100 |
| `lib/text/normalize.ts` | 텍스트 정규화 (`normalizeTerm`, `tokenizeQuery`) | ~30 |
| `app/actions/master-synonyms-actions.ts` | Server Actions (그룹 CRUD + 동의어 CRUD) | ~220 |
| `app/(admin)/admin/master/synonyms/page.tsx` | 그룹 목록 (검색·카테고리 필터) | ~140 |
| `app/(admin)/admin/master/synonyms/new/page.tsx` | 신규 그룹 작성 | ~35 |
| `app/(admin)/admin/master/synonyms/[id]/page.tsx` | 그룹 상세 + 동의어 inline 편집 | ~70 |
| `app/(admin)/admin/master/synonyms/_components/group-form.tsx` | 그룹 폼 (대표어/카테고리/추천카테고리/설명/정렬) | ~180 |
| `app/(admin)/admin/master/synonyms/_components/synonyms-editor.tsx` | 동의어 N개 inline 편집기 (tags-input 스타일) | ~200 |

### 1.2 수정 파일 (8개) — 검색 호출 지점 실사 결과 반영 (2026-05-29)

| 경로 | 변경 내용 |
|:-|:-|
| `db/schema/_shared.ts` | `termGroupCategoryEnum` 추가 |
| `db/schema/index.ts` | `term-groups`, `term-synonyms` export 추가 |
| `db/seed.ts` | 호텔업계 시드 50그룹 INSERT (§9) |
| `app/(admin)/admin/master/page.tsx` | "동의어 사전" 카드 추가 (`Languages` 아이콘) |
| `lib/services/articles.ts` | `searchArticles(q)` + `listArticles({q})` 내부에 `expandKeywords` 적용 (§7.1) |
| `lib/services/faqs.ts` | `searchFaqs(q)` 내부에 `expandKeywords` 적용 |
| `lib/services/notices.ts` | `searchNotices(q)` 내부에 `expandKeywords` 적용 |
| `lib/services/tickets.ts` | `listTickets({q})` (매니저 검색, L539~547) 내부에 `expandKeywords` 적용 |
| `docs/IMPLEMENTATION_PLAN.md` | SS-01 부속 마스터 정의 추가, 스키마 정의 추가 |

> **시그니처 변경 없음** — `expandKeywords` 는 내부에서만 호출, 호출자(`/search`, `/admin/tickets`, `/admin/articles` 등) 영향 0. 검색 페이지 5곳은 코드 변경 없이 동의어 확장 자동 적용.

---

## 2. 자료 흐름 (검색 확장)

```
[사용자 검색]
  │
  ▼
GET /search?q=CI
  │
  ▼
loadSynonymIndex()  ← unstable_cache 5분 (전체 group+synonym 메모리 로딩)
  │
  ▼
expandKeywords("CI")
  → tokenizeQuery("CI")       = ["ci"]                  (lower + trim + 2자 이상 필터)
  → matchGroups(["ci"])       = [group_check_in]        (그룹 IN 어디든 정확 매칭)
  → collectTerms(matched)     = ["체크인","CI","check-in","입실"]
  → result Set (입력 토큰 포함)= ["CI","ci","체크인","check-in","입실"]
  │
  ▼
articles/faqs/notices WHERE title ILIKE %t% OR body ILIKE %t% (OR loop)
  │
  ▼
결과 반환 (중복 제거)
```

---

## 3. DB 스키마 최종안

### 3.1 `_shared.ts` enum 추가

```ts
// db/schema/_shared.ts (추가)
export const termGroupCategoryEnum = pgEnum('term_group_category', [
  'operation',     // 운영: 체크인/체크아웃/예약/객실/요금
  'housekeeping',  // 청소: 하우스키핑/턴다운/린넨
  'fnb',           // 식음료: 조식/룸서비스/미니바
  'frontdesk',     // 프런트: FD/리셉션/컨시어지/벨맨
  'pms',           // PMS 운영 용어: 룸 차지/배정/오버부킹/객단가
  'product',       // OA 제품: PMS/CMS/Keyless/Kiosk/웹서비스
  'issue',         // 장애 유형: 결제 실패/네트워크/카드 미인식
  'role',          // 직무: 매니저/총지배인/객실팀장
  'misc',          // 기타
]);

export type TermGroupCategory = (typeof termGroupCategoryEnum.enumValues)[number];
```

### 3.2 `term_groups` 테이블

```ts
// db/schema/term-groups.ts
import { integer, pgTable, text, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { commonColumns, termGroupCategoryEnum } from './_shared';

/**
 * 동의어 그룹 — 대표어 1개 + 동의어 N개 (term_synonyms).
 *
 * 어드민이 그룹 추가/수정/숨김 가능 (`/admin/master/synonyms`).
 * 검색 시 입력 토큰이 같은 그룹의 어떤 동의어와도 일치하면 그룹 전체 term을 OR 확장한다.
 *
 * `canonicalTerm`은 사용자 노출 표준 라벨, `term_synonyms`에 별도 INSERT 하지 않음.
 *  → `expandKeywords` 가 항상 canonical을 자동으로 포함한다.
 */
export const termGroups = pgTable(
  'term_groups',
  {
    ...commonColumns(),
    /** 대표어 — 사용자 노출 표준 한글 표현. unique. */
    canonicalTerm: text('canonical_term').notNull(),
    /** 도메인 분류 — 어드민 필터/검색 용도 */
    category: termGroupCategoryEnum('category').notNull().default('misc'),
    /** 운영자 메모 (검색 미반영) */
    description: text('description'),
    /**
     * 카테고리 자동 매칭 시 추천할 categories.id (issue_type/product 등).
     * Q-5 결정: FK 없음. nullable text.
     */
    suggestedCategoryId: text('suggested_category_id'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    uniqueIndex('term_groups_canonical_uq').on(table.canonicalTerm),
    index('term_groups_category_idx').on(table.category),
    index('term_groups_sort_idx').on(table.sortOrder),
  ],
);

export type TermGroup = typeof termGroups.$inferSelect;
export type NewTermGroup = typeof termGroups.$inferInsert;
```

### 3.3 `term_synonyms` 테이블

```ts
// db/schema/term-synonyms.ts
import { integer, pgTable, text, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';
import { termGroups } from './term-groups';

/**
 * 동의어 — 한 그룹에 N개. 같은 (group_id, term, language) 중복 방지.
 *
 * `term` 은 원본 보존 (대소문자/공백 그대로). 매칭 시점에 lower+trim 비교 (Q-2).
 * Q-3: 검색 확장 시 2자 미만 term은 제외.
 */
export const termSynonyms = pgTable(
  'term_synonyms',
  {
    ...commonColumns(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => termGroups.id, { onDelete: 'cascade' }),
    /** 동의어 원본 (대소문자/공백 보존). 검색 시 lower+trim 비교 */
    term: text('term').notNull(),
    /** 'ko' | 'en' (P0). 'ja'/'zh'는 P2 — enum 대신 text */
    language: text('language').notNull().default('ko'),
    /** 가중치 (0~10). P0에선 보관만, 랭킹은 후속 */
    weight: integer('weight').notNull().default(5),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    // 한 그룹 안에서는 동일 (term, language) 중복 불가
    uniqueIndex('term_synonyms_group_term_uq').on(
      table.groupId,
      table.term,
      table.language,
    ),
    // 다른 그룹에는 같은 term 등록 가능 (다의어 허용)
    index('term_synonyms_term_idx').on(table.term),
    index('term_synonyms_group_idx').on(table.groupId),
  ],
);

export type TermSynonym = typeof termSynonyms.$inferSelect;
export type NewTermSynonym = typeof termSynonyms.$inferInsert;
```

**제약 설계 근거**:
- `canonical_term` UNIQUE: 그룹은 대표어 1개로 식별. 동일 대표어 그룹 2개 생성 불가
- `term_synonyms.group_id` FK + `onDelete: 'cascade'`: 그룹 물리 삭제 시 동의어도 일괄 정리 (단 본 프로젝트는 soft delete만 사용)
- `(group_id, term, language)` UNIQUE: 같은 그룹 내 중복 동의어 방지
- `term` index: 향후 SQL 기반 매칭 시 사용 가능 (현재는 메모리 캐시)
- `suggestedCategoryId` FK 없음: Q-5 결정. 운영 유연성

### 3.4 마이그레이션 SQL

```sql
-- migrations/XXXX_synonyms_master.sql
BEGIN;

-- 1. enum
CREATE TYPE term_group_category AS ENUM (
  'operation','housekeeping','fnb','frontdesk',
  'pms','product','issue','role','misc'
);

-- 2. term_groups
CREATE TABLE term_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_term TEXT NOT NULL,
  category term_group_category NOT NULL DEFAULT 'misc',
  description TEXT,
  suggested_category_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX term_groups_canonical_uq ON term_groups(canonical_term);
CREATE INDEX term_groups_category_idx ON term_groups(category);
CREATE INDEX term_groups_sort_idx ON term_groups(sort_order);

-- 3. term_synonyms
CREATE TABLE term_synonyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES term_groups(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'ko',
  weight INTEGER NOT NULL DEFAULT 5,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX term_synonyms_group_term_uq
  ON term_synonyms(group_id, term, language);
CREATE INDEX term_synonyms_term_idx ON term_synonyms(term);
CREATE INDEX term_synonyms_group_idx ON term_synonyms(group_id);

-- 4. 시드는 db/seed.ts 에서 INSERT (마이그레이션과 분리)

COMMIT;
```

| 환경 | 명령 |
|:-|:-|
| Dev | `drizzle-kit push` |
| Prod | `drizzle-kit migrate` |

**롤백**: `DROP TABLE term_synonyms; DROP TABLE term_groups; DROP TYPE term_group_category;`

---

## 4. 서비스 레이어 명세

### 4.1 `lib/text/normalize.ts` — 정규화 헬퍼

```ts
/** Q-2: lower + trim. NFC 정규화 포함. */
export function normalizeTerm(input: string): string {
  return input.normalize('NFC').toLowerCase().trim();
}

/**
 * Q-1/Q-3: 검색 쿼리를 토큰으로 분리.
 *
 * - 공백/구두점/따옴표 등으로 split
 * - lower + trim 후 2자 이상만 남김
 * - 중복 제거
 */
export function tokenizeQuery(input: string): string[] {
  const SPLIT = /[\s,.;:/\\!?"'()[\]{}<>~`@#$%^&*+=|]+/u;
  const tokens = normalizeTerm(input)
    .split(SPLIT)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return Array.from(new Set(tokens));
}
```

### 4.2 `lib/services/master-synonyms.ts` — CRUD

```ts
import 'server-only';
import { and, asc, eq, ilike, inArray } from 'drizzle-orm';
import { unstable_cache, revalidateTag } from 'next/cache';
import { db } from '@/db';
import {
  termGroups,
  termSynonyms,
  type NewTermGroup,
  type TermGroup,
  type TermSynonym,
  type TermGroupCategory,
} from '@/db/schema';

// ─── 조회 ────────────────────────────────────────────────

export type TermGroupWithSynonyms = TermGroup & {
  synonyms: TermSynonym[];
};

export async function listTermGroups(options: {
  category?: TermGroupCategory;
  search?: string;          // canonical_term ILIKE
  includeInactive?: boolean;
} = {}): Promise<TermGroup[]> { /* ... */ }

export async function getTermGroupById(id: string): Promise<TermGroupWithSynonyms | null> { /* ... */ }

/** 검색 확장용 — 전체 그룹+동의어를 메모리 인덱스로 로딩 (Q-4). */
export const loadSynonymIndex = unstable_cache(
  async (): Promise<SynonymIndex> => {
    const groups = await db.select().from(termGroups).where(eq(termGroups.isActive, true));
    const synonyms = await db.select().from(termSynonyms).where(eq(termSynonyms.isActive, true));
    // term(lowercase) → groupId set 매핑 미리 구성
    const termToGroupIds = new Map<string, Set<string>>();
    const groupIdToTerms = new Map<string, string[]>(); // 그룹 → [canonical, ...synonyms]
    for (const g of groups) {
      groupIdToTerms.set(g.id, [g.canonicalTerm]);
      const key = normalizeTerm(g.canonicalTerm);
      if (!termToGroupIds.has(key)) termToGroupIds.set(key, new Set());
      termToGroupIds.get(key)!.add(g.id);
    }
    for (const s of synonyms) {
      const arr = groupIdToTerms.get(s.groupId);
      if (!arr) continue; // 비활성 그룹 동의어는 무시
      arr.push(s.term);
      const key = normalizeTerm(s.term);
      if (!termToGroupIds.has(key)) termToGroupIds.set(key, new Set());
      termToGroupIds.get(key)!.add(s.groupId);
    }
    return { termToGroupIds, groupIdToTerms };
  },
  ['synonym-index:v1'],
  { revalidate: 300, tags: ['synonyms'] }, // 5분 TTL
);

// ─── 변경 ────────────────────────────────────────────────

export async function createTermGroup(input: NewTermGroup): Promise<TermGroup> { /* ... */ }
export async function updateTermGroup(id: string, patch: Partial<NewTermGroup>): Promise<TermGroup> { /* ... */ }
/** soft delete */
export async function deactivateTermGroup(id: string): Promise<void> { /* ... */ }

export async function addSynonym(groupId: string, term: string, language?: string): Promise<TermSynonym> { /* ... */ }
export async function removeSynonym(synonymId: string): Promise<void> { /* ... */ } // soft delete
export async function reorderSynonyms(groupId: string, ordering: { id: string; sortOrder: number }[]): Promise<void> { /* ... */ }

// 모든 변경 후 revalidateTag('synonyms')
```

### 4.3 `lib/services/synonym-expander.ts` — 검색 확장

```ts
import { loadSynonymIndex } from './master-synonyms';
import { tokenizeQuery, normalizeTerm } from '@/lib/text/normalize';

/**
 * 입력 키워드 → 동의어 OR 확장.
 *
 * 알고리즘 (Q-1 정확 일치):
 * 1. tokenizeQuery(input) → tokens
 * 2. 각 token에 대해 termToGroupIds 정확 매칭
 * 3. 매칭된 그룹의 [canonical, ...synonyms] 수집
 * 4. 원본 토큰 + 확장 토큰 dedupe 반환
 *
 * 매칭 없으면 원본 토큰만 반환 (확장 0).
 */
export async function expandKeywords(input: string): Promise<string[]> {
  const tokens = tokenizeQuery(input);
  if (tokens.length === 0) return [input.trim()].filter(Boolean);

  const index = await loadSynonymIndex();
  const result = new Set<string>(tokens);

  // 원본 input 자체도 보존 (UI 표시용)
  const originalTrim = input.trim();
  if (originalTrim) result.add(originalTrim);

  for (const tok of tokens) {
    const groupIds = index.termToGroupIds.get(tok);
    if (!groupIds) continue;
    for (const gid of groupIds) {
      const terms = index.groupIdToTerms.get(gid) ?? [];
      for (const t of terms) result.add(t);
    }
  }
  return Array.from(result);
}

/**
 * 호출처 검색 SQL 헬퍼.
 * articles.title/body 등에 ILIKE OR 적용.
 *
 * 예시 (검색 서비스):
 *   const tokens = await expandKeywords(q);
 *   const orClauses = tokens.flatMap((t) => [
 *     ilike(articles.title, `%${t}%`),
 *     ilike(articles.body, `%${t}%`),
 *   ]);
 *   db.select().from(articles).where(or(...orClauses))
 */
```

---

## 5. Server Actions

### 5.1 `app/actions/master-synonyms-actions.ts`

| 액션 | 권한 | 입력 (Zod) | 출력 |
|:-|:-|:-|:-|
| `createTermGroupAction` | admin | `{ canonicalTerm, category, description?, suggestedCategoryId?, sortOrder? }` | `{ ok: true, id } \| { ok: false, fieldErrors }` |
| `updateTermGroupAction` | admin | `{ id, ...patch }` | 위 동일 |
| `deactivateTermGroupAction` | admin | `{ id }` | `{ ok }` |
| `addSynonymAction` | admin | `{ groupId, term, language? }` | `{ ok, synonym } \| { fieldErrors }` |
| `removeSynonymAction` | admin | `{ synonymId }` | `{ ok }` |
| `reorderSynonymsAction` | admin | `{ groupId, ordering: { id, sortOrder }[] }` | `{ ok }` |

**공통**:
- `requireRole(['admin'])` 진입 가드 (매니저는 read-only)
- `revalidatePath('/admin/master/synonyms')` + `revalidateTag('synonyms')`
- `recordActivityLog({ action: 'master:synonyms:*', actorId, target })` 호출 (fire-and-forget)
- Zod 검증 실패 시 `{ ok: false, fieldErrors }` 반환 — 폼이 인라인 노출

### 5.2 검증 규칙

```ts
const canonicalTermSchema = z.string().trim().min(1).max(60);
const synonymTermSchema = z.string().trim().min(1).max(60);
const languageSchema = z.enum(['ko', 'en']);  // P0
const categorySchema = z.enum([
  'operation','housekeeping','fnb','frontdesk',
  'pms','product','issue','role','misc',
]);
```

---

## 6. UI 명세

### 6.1 `/admin/master/synonyms` (목록 페이지)

**구성**:
- `PageHeader` — 제목 "동의어 사전", description "호텔업계 용어/약어를 그룹으로 묶어 검색을 보강합니다."
- 상단 통계 카드 (4종): 전체 그룹 수 / 활성 그룹 / 총 동의어 수 / 가장 큰 그룹 동의어 수
- 카테고리 탭 필터: `전체 / 운영 / 청소 / F&B / 프런트 / PMS / 제품 / 장애 / 직무 / 기타`
- 검색 입력 (canonical_term ILIKE)
- 우상단 `<Button asChild><Link href="/admin/master/synonyms/new">+ 새 그룹</Link></Button>`
- 목록 (Card + 테이블):

| 컬럼 | 내용 |
|:-|:-|
| 대표어 | `canonical_term` (link → 상세) |
| 카테고리 | 라벨 뱃지 (운영/청소/F&B/…) |
| 동의어 수 | `synonyms.length` |
| 추천 카테고리 | join 결과 라벨 (issue_type/product 등) — 없으면 "—" |
| 상태 | 활성/비활성 뱃지 |
| 마지막 수정 | `updated_at` |

- 모바일: 카드 뷰 (제목 + 카테고리 뱃지 + 동의어 미리보기 3개 + …+N)
- 정렬: 기본 `sortOrder ASC, canonical_term ASC` — `sortBy/sortOrder` 쿼리 지원
- EmptyState: "아직 등록된 동의어 그룹이 없습니다" + CTA

### 6.2 `/admin/master/synonyms/new`

- `<GroupForm mode="create" />`
- 필드: 대표어 (text·required), 카테고리 (Select·9종), 추천 카테고리 (선택·categories type별 그룹), 설명 (textarea), 정렬 (number·default 100)
- 저장 후 → `redirect(/admin/master/synonyms/${id})` (상세에서 동의어 추가하도록 유도)

### 6.3 `/admin/master/synonyms/[id]`

- 상단: `<GroupForm mode="edit" group={group} />` (대표어/카테고리/설명/추천카테고리/정렬 + 활성 토글)
- 하단: `<SynonymsEditor groupId={id} synonyms={group.synonyms} />`
  - **인터랙션**:
    1. 입력 박스 — Enter 또는 쉼표 시 동의어 추가
    2. 추가 시 즉시 Server Action 호출 (낙관적 업데이트 + revalidate)
    3. 각 동의어 칩: `[CI · ko ×]` — × 클릭 시 confirm 후 soft delete
    4. 칩 드래그 정렬 (sortOrder)
    5. 언어 토글 (ko/en) — 새 동의어 추가 시 기본 'ko'
    6. 중복 입력 감지: 같은 그룹 내 중복 시 토스트 "이미 등록됨" (저장 안 됨)
    7. 다른 그룹과 충돌: 다른 그룹에 존재 시 경고 토스트 (저장은 허용 — 다의어 의도)
  - **에러 처리**: Zod 실패 시 입력 박스 하단 인라인 메시지

### 6.4 `<GroupForm>` 컴포넌트

```
┌────────────────────────────────────────┐
│ 대표어 *                                │
│ [체크인_______________]                 │
│                                        │
│ 분류 *                                  │
│ [운영 ▾]                                │
│                                        │
│ 추천 카테고리 (티켓 자동 매칭 시 사용)   │
│ [issue_type / 예약 / 결제 ▾]            │
│                                        │
│ 설명 (운영자 메모)                       │
│ [모바일 키 발급 관련 문의 자동 라우팅...] │
│                                        │
│ 정렬                                    │
│ [100]                                  │
│                                        │
│ ☑ 활성 (검색에 사용)                    │
│                                        │
│       [취소]  [저장]                    │
└────────────────────────────────────────┘
```

### 6.5 `<SynonymsEditor>` 컴포넌트

```
┌────────────────────────────────────────────────────┐
│ 동의어 (4개)                          [언어: ko ▾] │
│                                                    │
│ [CI ×] [check-in ×] [입실 ×] [入室 ×]              │
│                                                    │
│ [_______________________] [+ 추가]                 │
│ ↑ Enter 또는 쉼표로 추가 (2자 이상)                 │
│                                                    │
│ ℹ "CI"는 다른 그룹(continuous integration)에도 등록 │
└────────────────────────────────────────────────────┘
```

- 칩 색상은 카테고리 색 따라감 (분류 일관성)
- 드래그 핸들 (lucide `GripVertical`) 으로 순서 변경

### 6.6 `/admin/master` 인덱스 카드 추가

```tsx
{
  href: '/admin/master/synonyms',
  label: '동의어 사전',
  description: '호텔업계 용어/약어를 그룹으로 묶어 검색을 보강. CI↔체크인, 하우스키핑↔객실 청소.',
  icon: Languages,   // lucide-react
  badge: '검색 인프라',
}
```

---

## 7. 검색 통합 지점 — 실사 완료 (2026-05-29)

> Do 진입 전 grep으로 검색 호출처를 모두 식별. 아래 5곳은 시그니처 변경 없이 내부 ILIKE 부분만 `expandKeywords` 결과 토큰 배열로 OR 확장한다. 호출자(`/search`, `/admin/tickets`, `/admin/articles`)는 무수정.

### 7.1 `lib/services/articles.ts` — `searchArticles(q, options)` (L422)

호출처: [`app/search/page.tsx:78`](app/search/page.tsx#L78) (호텔리어 `/search?tab=help`)

```ts
// Before (L429~444)
const pattern = `%${query}%`;
const searchCond = or(
  ilike(articles.title, pattern),
  ilike(articles.summary30s, pattern),
  ilike(articles.bodyMarkdown, pattern),
);

// After
const expanded = await expandKeywords(query);   // 동의어 OR 확장
const searchCond = or(
  ...expanded.flatMap((t) => {
    const p = `%${t}%`;
    return [
      ilike(articles.title, p),
      ilike(articles.summary30s, p),
      ilike(articles.bodyMarkdown, p),
    ];
  }),
);
// 점수 부여 로직(L470~475)은 그대로 유지 — title/summary 일치 시 가점.
// (P1) 토큰별 매칭 정보를 SearchArticleHit.matchedTokens 로 노출하여 헤더 표시.
```

### 7.2 `lib/services/articles.ts` — `listArticles({q})` (L105~113)

호출처: 어드민 아티클 목록 페이지 (`/admin/articles`)

같은 패턴으로 `expanded` OR 확장 적용. 어드민 측에서는 표시 헤더 없이 자연 확장.

### 7.3 `lib/services/faqs.ts` — `searchFaqs(q, options)` (L182)

호출처: [`app/search/page.tsx:79`](app/search/page.tsx#L79) (호텔리어 `/search?tab=faq`)

동일 패턴. FAQ 컬럼(question/answer 등)에 expanded 토큰 OR 확장.

### 7.4 `lib/services/notices.ts` — `searchNotices(q, options)` (L482)

호출처: [`app/search/page.tsx:80`](app/search/page.tsx#L80) (호텔리어 `/search?tab=notice`)

동일 패턴. notices.title/bodyMarkdown OR 확장.

### 7.5 `lib/services/tickets.ts` — `listTickets({q})` (L539~547)

호출처: 매니저 `/admin/tickets?q=`

```ts
// Before (L539~547)
if (params.q && params.q.trim()) {
  const pattern = `%${params.q.trim()}%`;
  const search = or(
    ilike(tickets.title, pattern),
    ilike(tickets.ticketNo, pattern),
    ilike(tickets.content, pattern),
  );
  if (search) conditions.push(search);
}

// After
if (params.q && params.q.trim()) {
  const expanded = await expandKeywords(params.q);
  const search = or(
    ...expanded.flatMap((t) => {
      const p = `%${t}%`;
      return [
        ilike(tickets.title, p),
        ilike(tickets.content, p),
      ];
    }),
    // ticketNo는 동의어 확장 대상 아님 — 원본 토큰만 매칭
    ilike(tickets.ticketNo, `%${params.q.trim()}%`),
  );
  if (search) conditions.push(search);
}
```

> `ticketNo`는 'T-2026-00001' 같은 시스템 식별자라 동의어 확장 대상 아님 — 원본 q 만 매칭.

### 7.6 결과 헤더 (UX)

- `/search`: 결과 헤더에 "동의어 N개 자동 확장" 칩 노출 (확장된 토큰 hover 시 툴팁)
- `/admin/tickets`: 자연 확장만, 별도 UI 표시 없음 (매니저는 결과만 빠르게 확인)
- 0건일 때: 검색 결과 0건 시 EmptyState에 "동의어 확장 적용했으나 결과 없음" 안내

### 7.7 tsvector 마이그레이션 호환성

`lib/services/articles.ts:6` 의 "Phase 5에서 tsvector 고도화 예정" 주석 참고. 동의어 사전은 ILIKE 단계에서 도입되지만, 향후 tsvector 도입 시:
- 마스터 테이블(`term_groups`, `term_synonyms`)은 그대로 재활용
- `expandKeywords` → `expandToTsquery` 로 추가만 하면 됨 (`to_tsquery('체크인 | CI | check-in')`)
- 호출자는 여전히 무변경

---

## 8. 검증 & 회귀

### 8.1 단위 검증 (수동)

- [ ] `expandKeywords('CI')` → `['CI', '체크인', 'check-in', '입실']` (set 비교)
- [ ] `expandKeywords('하우스키핑')` → `['하우스키핑', '객실 청소', 'housekeeping', 'HK']`
- [ ] `expandKeywords('전혀모르는단어')` → `['전혀모르는단어']` (확장 0)
- [ ] `expandKeywords('a')` → `['a']` (1자 토큰은 매칭 시도 X, 원본만)
- [ ] `expandKeywords('체크인 결제실패')` → 두 그룹 모두 확장 (다중 토큰)
- [ ] `expandKeywords('')` → `[]`

### 8.2 어드민 UI

- [ ] 새 그룹 생성 → 동의어 0개 상태로 상세 진입
- [ ] 동의어 inline 추가 → 즉시 칩 표시
- [ ] 같은 그룹에 동일 동의어 재입력 → 토스트 "이미 등록됨" + 저장 안 됨
- [ ] 다른 그룹과 동의어 충돌 → 경고 토스트 + 저장됨 (다의어 의도)
- [ ] 비활성화 → 검색에서 즉시 빠짐 (5분 캐시 TTL 안에서는 revalidateTag로 무효화)
- [ ] 활동 로그 기록 확인 (`activity_logs`)

### 8.3 검색 회귀

- [ ] `/search?q=체크인` 기존 결과 유지 + 추가 결과 (동의어 확장분)
- [ ] `/admin/tickets?q=하우스키핑` — 본문에 "객실 청소" 들어간 티켓 노출
- [ ] 결과 개수 변화는 UI 헤더에서 인지 가능
- [ ] 검색 기존 E2E 테스트 (있다면) 영향 분석

### 8.4 성능

- [ ] `loadSynonymIndex()` 첫 로딩 1회 + 캐시 5분
- [ ] 동시 100명 검색 시 인덱스 재구성 1회 (캐시 hit)
- [ ] `unstable_cache` revalidateTag('synonyms') 동작 확인

---

## 9. 시드 확정안 (Q-6 — Claude 초안)

> 사용자 검수 후 `db/seed.ts` 반영. 잘못된 표현/누락 용어는 검수 시 가감.

### 9.1 시드 총괄

| 카테고리 | 그룹 수 | 비고 |
|:-|:-:|:-|
| operation | 9 | 체크인·체크아웃·예약·객실 등 |
| housekeeping | 5 | 객실 청소·턴다운·린넨·인스펙션·미니바 |
| fnb | 4 | 조식·룸서비스·식음료·라운지 |
| frontdesk | 4 | 프런트·컨시어지·벨맨·게스트 |
| pms | 6 | 룸 배정·룸 차지·오버부킹·객실 등급·점유율·객단가 |
| product | 5 | PMS·CMS·Keyless·Kiosk·웹서비스 |
| issue | 8 | 결제 실패·네트워크 끊김·카드 미인식 등 |
| role | 5 | 매니저·객실팀장·F&B 매니저·총지배인·당직 |
| misc | 4 | VIP·블록·OOO·OS |
| **합계** | **50** | 약 180~200 row (그룹당 평균 4 동의어) |

### 9.2 시드 데이터 (operation)

| 대표어 | 동의어 (ko/en) | 추천 카테고리 type |
|:-|:-|:-|
| 체크인 | CI · check-in · 입실 · check in | issue_type=예약 |
| 체크아웃 | CO · check-out · 퇴실 · check out | issue_type=예약 |
| 예약 | reservation · booking · 부킹 · 예약건 | issue_type=예약 |
| 객실 | room · 룸 · 호실 · 방 · 객실번호 | issue_type=객실 |
| 요금 | rate · 가격 · ADR · 단가 · 요율 | issue_type=요금 |
| 노쇼 | no-show · 미투숙 · NS | issue_type=예약 |
| 워크인 | walk-in · 현장 투숙 · WI | issue_type=예약 |
| 얼리 체크인 | early CI · ECI · 조기 입실 | issue_type=예약 |
| 레이트 체크아웃 | late CO · LCO · 늦은 퇴실 | issue_type=예약 |

### 9.3 시드 데이터 (housekeeping)

| 대표어 | 동의어 |
|:-|:-|
| 객실 청소 | 하우스키핑 · housekeeping · HK · 청소 · 룸 클리닝 |
| 턴다운 | turn-down · 야간정리 · TD |
| 린넨 | linen · 침구 · 시트 |
| 객실 점검 | inspection · 인스펙션 · 룸체크 · 점검 |
| 미니바 | minibar · MB · 미니 바 |

### 9.4 시드 데이터 (fnb)

| 대표어 | 동의어 |
|:-|:-|
| 조식 | breakfast · BF · 아침 식사 · 아침 |
| 룸서비스 | room service · RS · 인룸 다이닝 · in-room dining |
| 식음료 | F&B · FB · food and beverage · 에프앤비 |
| 라운지 | lounge · 라운지바 · 라운지 바 |

### 9.5 시드 데이터 (frontdesk)

| 대표어 | 동의어 |
|:-|:-|
| 프런트 | FD · front desk · 리셉션 · reception · 프론트 |
| 컨시어지 | concierge · 컨시 |
| 벨맨 | bellman · bell · 벨보이 · bellboy |
| 게스트 | guest · 고객 · 손님 · 투숙객 |

### 9.6 시드 데이터 (pms)

| 대표어 | 동의어 | 추천 카테고리 |
|:-|:-|:-|
| 룸 배정 | room assignment · 배방 · 배정 · assign | issue_type=객실 |
| 룸 차지 | room charge · 룸챠지 · 객실 청구 · charge | issue_type=요금 |
| 오버부킹 | overbooking · OB · 초과예약 | issue_type=예약 |
| 객실 등급 | room type · RT · 룸타입 · 룸 타입 | issue_type=객실 |
| 점유율 | occupancy · OCC · 객실 점유율 | — |
| 객단가 | ADR · average daily rate · 평균 객실 단가 | — |

### 9.7 시드 데이터 (product) — OA 제품군

| 대표어 | 동의어 | 추천 카테고리 |
|:-|:-|:-|
| PMS | Property Management System · 자산관리시스템 · OA PMS · 피엠에스 | product=PMS |
| CMS | Channel Manager · 채널매니저 · 채널관리시스템 · 씨엠에스 | product=CMS |
| Keyless | 키리스 · 모바일키 · mobile key · 무인체크인 · 모바일 키 | product=Keyless |
| Kiosk | 키오스크 · 무인 단말 · 자율 단말 · self check-in kiosk | product=키오스크 |
| 웹서비스 | booking engine · 부킹엔진 · BE · 웹 부킹엔진 | product=웹서비스 |

### 9.8 시드 데이터 (issue) — 장애 유형

| 대표어 | 동의어 | 추천 카테고리 |
|:-|:-|:-|
| 결제 실패 | payment failed · 결제 오류 · 결제 안됨 · 카드 거절 · 승인 거절 | issue_type=결제 |
| 네트워크 끊김 | network down · 인터넷 끊김 · 통신 장애 · 망 장애 · 회선 장애 | issue_type=네트워크 |
| 카드 미인식 | card not detected · 키카드 인식 안됨 · 키 인식 오류 · NFC 오류 | issue_type=Keyless |
| 동기화 오류 | sync error · 싱크 오류 · 동기화 실패 · sync failed | issue_type=PMS |
| 로그인 안됨 | login failed · 로그인 오류 · 로그인 안 됨 · 인증 실패 | issue_type=계정 |
| 화면 멈춤 | freeze · 멈춤 · 응답 없음 · 행 · 다운 · 먹통 | issue_type=시스템 |
| 프린터 오류 | printer error · 영수증 안 나옴 · 프린트 안됨 · 출력 안됨 | issue_type=주변기기 |
| 데이터 누락 | data missing · 누락 · 안 나옴 · 안 보임 | issue_type=PMS |

### 9.9 시드 데이터 (role)

| 대표어 | 동의어 |
|:-|:-|
| 매니저 | MGR · manager · 책임자 · 매니져 |
| 객실팀장 | housekeeping manager · HKM · 하우스키핑 매니저 · 객실 팀장 |
| F&B 매니저 | FBM · 식음료 매니저 · F&B M · 에프앤비 매니저 |
| 총지배인 | GM · general manager · 지배인 · 총괄 |
| 당직 | duty · night manager · 야간 매니저 · MOD |

### 9.10 시드 데이터 (misc)

| 대표어 | 동의어 |
|:-|:-|
| VIP | 브이아이피 · 귀빈 · VIP 게스트 |
| 블록 | block · 단체 블록 · group block · 단체예약 |
| OOO | out of order · 사용불가 객실 · 수리중 객실 |
| OS | out of service · 일시 정지 객실 |

---

## 10. 다음 단계

1. **사용자 시드 검수** (§9.2~§9.10) — 잘못된 표현/누락 용어 보완
2. → `/pdca do synonyms-master` 진입
3. → P0 구현 순서:
   1. 스키마 2개 + 마이그레이션 → 빌드 통과
   2. 시드 → `npm run db:seed` 확인
   3. 서비스 (master-synonyms, synonym-expander, normalize)
   4. Server Actions
   5. 어드민 UI 4 페이지 + 2 컴포넌트
   6. master 인덱스 카드 추가
   7. 셀프서치 + 매니저 검색 통합
4. → Check (gap-detector + 검색 시각 회귀)
5. → Report

---

## 부록 A. 컴포넌트 재사용

| 컴포넌트 | 재사용 출처 |
|:-|:-|
| `<PageHeader>` | components/ui/page-header.tsx |
| `<Card>`, `<CardContent>` | components/ui/card.tsx |
| `<Badge>` | components/ui/badge.tsx (tone='brand'/'warn'/'success'/'muted') |
| `<Input>`, `<Textarea>`, `<Select>` | components/ui/* |
| `<ConfirmDialog>` | 글로벌 (window.confirm 대체) |
| `<EmptyState>` | components/ui/empty-state.tsx (있는 경우, 없으면 신규) |
| 드래그 정렬 | `@dnd-kit/core` (이미 도입돼있다면) — 없다면 `↑↓` 버튼으로 대체 |

## 부록 B. 미해결 결정 (Do 단계에서 확정)

| ID | 항목 | 결정 시점 |
|:-:|:-|:-|
| D-1 | 검색 통합 정확한 호출 지점 (페이지 vs 서비스) | Do 시작 시 grep 후 결정 |
| D-2 | 결과 헤더 "동의어 N개 자동 확장" 표시 여부 | UI 구현 시점 |
| D-3 | 드래그 정렬 라이브러리 vs 버튼 정렬 | UI 구현 시점 (의존성 점검) |
| D-4 | 인덱스 캐시 무효화 — 변경 즉시 vs 5분 자연 만료 | Server Actions 시점 (revalidateTag 사용) |
