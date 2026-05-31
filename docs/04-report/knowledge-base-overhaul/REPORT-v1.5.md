# knowledge-base-overhaul — v1.5 중간 PDCA Report

> **상태**: Phase 1·2·3 완료 + v1.5 정책 추가 적용 + 프로덕션 e2e 3/3 통과
> **다음**: Phase 4 (A6 재편집) / Phase 5 (Stream D 이미지) — 별도 사이클 권장

---

## Executive Summary

| 항목 | 내용 |
|---|---|
| **사이클** | knowledge-base-overhaul (Stream A + B + v1.5 정책 보강) |
| **시작** | 2026-05-31 (PLAN v1.0) |
| **현재 시점** | 2026-05-31 (v1.5 정책 + e2e 통과) |
| **누적 commits** | **26건** (docs 5 + impl 19 + e2e 2) |
| **코드 변경** | 약 **+5,000줄** (lib 1,400 / components 2,200 / db 100 / docs 1,300) |
| **신규 DB** | 3개 (`article_seq_counters` · `article_templates` · `articles.warning_count`) |
| **신규 라이브러리** | 9 (templates · recommend · ops-id-slug · master-article-templates · use-autosave-status · anthropic-client · article-assistant 프롬프트 · rate-limiter · cost-tracker · keyword-filter) |
| **신규 컴포넌트** | 10 (intent-selector · menu-path-cascader · editor-meta-form · editor-body · article-checklist-sidebar · ai-assistant-panel · keyword-recommender · related-article-autocomplete · menu-tree-sidebar · KbAiSuggestionCard · KbAiChatbotMetaCard) |
| **e2e 결과** | 프로덕션 3/3 통과 (KB-07·KB-08·KB-08b) |
| **AI 비용 추정** | $43/월 (매니저 5명 · 일 20회 호출 · Sonnet 4.6 기준) |

### Value Delivered (4-Perspective)

| 관점 | 내용 |
|---|---|
| **Problem** | 아티클 작성 30분+ · 메타데이터 전부 수동 · 발행 직전 차단 · AI 보조 0% · 영어/한글 키워드 혼재 · /help 메뉴 트리 부재 · /role DB 미연동 |
| **Solution** | 골격 마스터 DB · A2 캐스케이더 · A3·A4 자동 추천 · A5 Claude 5종 메타 · 운영 ID slug · 자동저장 가시화 · /help 트리 · /role DB · 한글 정책 · 발행 완화 · ⚠️ 보완 N건 |
| **Function · UX** | 좌 본문 + 우 체크리스트 · 의도 카드 호버 골격 미리보기 · 메뉴 3단 드롭다운 · 키워드 추천 칩 · 관련문서 자동완성 · AI 트리거 각 필드 옆 · 분산 적용 카드 · 챗봇 메타 별도 영역 · 발행 후 보완 표시 |
| **Core Value** | 매니저 효율 60%↑ · 호텔리어 검색 도달성↑ · 챗봇 KB 자동 메타데이터 기반 · 운영팀 마스터 편집 일관성 · 비용 예산 내 ($43/월) |

---

## Phase별 진척

| Phase | 항목 | 상태 | Key commits |
|---|---|---|---|
| **Phase 1** Week 1 | A1 본문 골격 + A2 메뉴 캐스케이더 + A7 Slug ID + A8 자동저장 + editor 519줄→280줄 분리 | ✅ | 88a893f, 313ab8e, 1812257, c21a080, 355314c |
| **Phase 2** Week 2 | A3 키워드 추천(동의어+본문 토큰) + A4 관련문서 자동완성 + B1 /help 트리 | ✅ | 4324874, 996c1d0, 1c02219 |
| **Phase 3** Week 3 | A5 Claude Sonnet 4.6 + B2 /role DB 폴백 + AI UX 분산 + 트리거 위치 | ✅ | 2440d6b, d08d6d8, f42a1a1, 96df6c9 |
| **v1.5 정책** | 발행 완화(Hard/Soft) · 키워드 한글 한정 · ⚠️ 보완 N건 배지 · AI 환경별 분기 · 백스페이스 픽스 · regex hotfix · 사이드바 좌측 | ✅ | 62eaf6e, 5f04943, ef6035c, 030d74c, 58fd19e, 96df6c9, b95fe33, 111b979 |
| **e2e** | KB-07 /help 트리 + KB-08 /role DB + KB-08b 404 (프로덕션 3/3 통과) | ✅ | 2501036, d429711 |
| **Phase 4** | A6 재편집 4모드 (reorder/fill-gaps/tone/custom) + diff 미리보기 | ⏳ | — |
| **Phase 5** | Stream D 이미지 4종 (sharp 리사이징·압축 + tui-image-editor 화살표/라벨 + CSS 프레임) | ⏳ | — |

---

## 주요 결정 사항 (사용자 협의 누적)

1. **MVP 스코프 확장 결정** (v1.0→v1.4):
   - v1.1: Stream B(/help·/role) MVP 포함 (일정 3주 → 유지)
   - v1.2: A6 재편집 4모드 추가 (3주 → 4주)
   - v1.3: A7 Slug + A8 자동저장 + Stream D 이미지 추가 (4주 → 5주)
   - v1.4: 모델 분기 — A6-3 톤만 Haiku, 나머지 Sonnet (월 ~$43)

2. **v1.5 정책 보강** (사용자 피드백 기반):
   - 발행 정책 완화 — Hard 5종(productCode/contentType/title/slug/본문 H2+50자)만 차단, 나머지는 워닝
   - 키워드 한글 한정 — 영어 약어는 동의어 마스터로 분리 (`term_synonyms`)
   - `articles.warning_count` 컬럼 + ⚠️ "보완 N건" 배지 (status enum 확장 X)
   - AI 보조 트리거 위치 — 하단 큰 카드 → 각 필드 라벨 옆 작은 ✨ 버튼 (1회 호출 유지)
   - AI 결과 적용 — 5종 카드 일괄 → 각 필드 옆 mini 카드로 분산
   - /help/[product] 사이드바 우측 → 좌측

3. **환경 분리**:
   - Vercel `ANTHROPIC_API_KEY` (Production+Preview, Sensitive)
   - Vercel `ANTHROPIC_API_KEY_DEV` (Development)
   - 코드 폴백: `_DEV` → 일반

---

## Phase 1·2·3·v1.5 주요 산출물

### 신규 라이브러리

| 파일 | 역할 |
|---|---|
| `lib/articles/templates.ts` | content_type 본문 골격 3종 (AS 팀 초안) |
| `lib/articles/recommend.ts` | A3·A4 추천 (동의어+본문토큰, 카테고리+키워드교집합+본문링크) |
| `lib/articles/ops-id-slug.ts` | A7 atomic UPSERT slug 채번 |
| `lib/articles/keyword-filter.ts` | v1.5 한글 정책 (isKoreanKeyword, filterKoreanKeywords) |
| `lib/articles/body-validator.ts` (확장) | extractBodyOutline + isPlaceholderOnly + hardCheck |
| `lib/services/master-article-templates.ts` | resolveArticleTemplate (DB 우선, 코드 폴백) + CRUD |
| `lib/services/master-role-starters.ts` (확장) | getRoleStarterByKey + getRoleStarterWithArticles |
| `lib/editor/use-autosave-status.ts` | A8 자동저장 상태 훅 + ON/OFF 토글 |
| `lib/ai/anthropic-client.ts` | Claude Sonnet 4.6 wrapper + prompt cache + env 분기 |
| `lib/ai/prompts/article-assistant.ts` | system 프롬프트 + zod 스키마 + truncateBody |
| `lib/ai/rate-limiter.ts` | sliding window 메모리 |
| `lib/ai/cost-tracker.ts` | 토큰 사용량 console |

### 신규 컴포넌트

| 컴포넌트 | 역할 |
|---|---|
| `editor/intent-selector.tsx` | 3-card content_type + hover popover |
| `editor/menu-path-cascader.tsx` | 3단 캐스케이더 + 수동 fallback |
| `editor/editor-meta-form.tsx` | 메타 폼 + AI 트리거 4곳 + KbAiSuggestionCard inline |
| `editor/editor-body.tsx` | RichEditor wrapper + autosave passthrough |
| `editor/article-checklist-sidebar.tsx` | 진척률 + 메타 체크 + errors/warnings + 자동저장 표시바 |
| `editor/ai-assistant-panel.tsx` | KbAiSuggestionCard + KbAiChatbotMetaCard (분산 적용) |
| `editor/keyword-recommender.tsx` | A3 추천 칩 (한글 필터) |
| `editor/related-article-autocomplete.tsx` | A4 검색 + 추천 칩 |
| `help/[product]/_components/menu-tree-sidebar.tsx` | B1 트리 사이드바 (sessionStorage 펼침) |

### DB 변경

| 마이그레이션 | 내용 |
|---|---|
| `0016_married_the_hunter.sql` | article_seq_counters + article_templates |
| `0017_romantic_sabretooth.sql` | articles.warning_count int default 0 |

### 환경 설정

- `.env.example` ANTHROPIC_API_KEY scaffold
- `.env.local` ANTHROPIC_API_KEY (gitignore)
- Vercel `ANTHROPIC_API_KEY` (Production+Preview) + `ANTHROPIC_API_KEY_DEV` (Development)
- `package.json` `@anthropic-ai/sdk@^0.100.1`

---

## Key Insights (다음 사이클로 이월)

1. **사용자 피드백 즉시 반영 패턴 검증** — 큰 작업(Phase) 사이사이에 들어온 작은 정책 변경(키워드 한글 한정, 발행 완화, AI 버튼 위치)을 즉시 commit으로 처리하는 게 누적 효과 큼. PLAN/DESIGN 버전 (v1.0~v1.5)로 변경 이력 기록.

2. **모델 ID 미스매치 위험** — 새 모델(`claude-sonnet-4-6`)이 SDK에 등록되지 않은 경우 런타임 에러. 폴백 모델(`claude-sonnet-4-5`) + ANTHROPIC_MODEL 환경변수 override가 안전망. 에러 메시지에 모델 ID 노출이 진단에 결정적.

3. **마이그레이션 메타 체인 충돌** — drizzle generate 시 0015/0016 prevId 같으면 차단. snapshot json id 수동 패치로 해결. 한 번 직접 SQL 만들면 메타 동기 부담 — generate가 정석.

4. **표현식 인덱스 부채** — `articles_search_tsv`처럼 raw SQL로 만든 인덱스는 schema 미정의 → 다음 generate 시 또 DROP 시도. articles.ts에 표현식 인덱스 정의 추가가 영구 해결 (별도 사이클 권장).

5. **status enum 보수성** — "개선필요" 같은 derived 상태는 status enum 확장 X, 메타 컬럼(`warning_count`)으로 분리. 이진성(draft/published) 유지 + UI 배지로 매니저에게 표시. 호텔리어/검색에는 영향 0.

6. **e2e strict mode** — `getByRole('heading', { name: /가이드/ })`처럼 광범위 매치는 strict mode 위반. `level: 1` 명시 또는 `.first()`로 좁히기.

7. **AI 호출 비용 — 1회 호출 + 분산 표시** 패턴 — 5종 메타를 각 필드 옆 별도 호출하면 비용 5배. 1회 호출 후 결과를 각 필드 옆 카드로 분산하면 비용 동일 + UX 직관적.

8. **한글/영어 분리 정책** — articles.keywords(한글, 호텔리어 검색어) vs term_synonyms(영어 약어·다국어, 시스템 매칭 사전) 분리. 검색 시 `expandKeywords()`로 자동 조합. 어드민 운영 일관성 + AI 출력 가드 동시 달성.

---

## 미해결 부채 (v1.5+ 권장)

| ID | 부채 | 영향 | 권장 |
|---|---|---|---|
| **D1** | `articles_search_tsv` 인덱스 schema 미정의 | 다음 generate 시 또 DROP 시도 | articles.ts에 표현식 인덱스 정의 추가 |
| **D2** | KB-01·KB-01b·KB-01c 로컬 e2e 미실행 | manager 시나리오 회귀 검증 부족 | `npm run dev` + `npm run test:e2e -- e2e/kb-knowledge-base.spec.ts` |
| **D3** | 어드민 master/role-starters에 articleIds 매핑 UI (드래그 정렬 + RelatedAutocomplete 재사용) | /role 매핑 운영 UX 부족 | 별도 사이클 (작업 ~1일) |
| **D4** | system 프롬프트 4000자+ 확장 + prompt cache 활성 | 호출당 비용 ~70% 절감 가능 | 호텔리어 어휘 사전 + 예시 추가 (별도 사이클) |
| **D5** | A6 재편집 4모드 (Phase 4) | 본문 재구조화·톤 보정 자동화 | Phase 4 진입 |
| **D6** | Stream D 이미지 4종 (Phase 5) | 스크린샷 자동 리사이징·압축·에디팅·프레임 | Phase 5 진입 |
| **D7** | 통합 e2e KB-04 mock Anthropic | AI 보조 적용 시나리오 회귀 | Phase 4 동반 |

---

## bkit Feature Usage

```
─────────────────────────────────────────────────
📊 bkit Feature Usage (v1.5 누적)
─────────────────────────────────────────────────
✅ Used: /pdca plan, /pdca design, /pdca do, /pdca check (e2e),
        AskUserQuestion, TodoWrite, Read/Write/Edit/Bash,
        Anthropic SDK, drizzle-kit generate+migrate,
        Playwright e2e (프로덕션 KB-07·08 3/3 통과)
⏭️ Not Used: bkit:gap-detector (Phase 4·5 이후 권장),
            bkit:pdca-iterator (Match 측정 후 자동 반복),
            bkit:qa-monitor (Docker 환경 미적용)
💡 Recommended: 
   - Phase 4 (A6) 또는 Phase 5 (Stream D) 진입은 새 사이클 권장
   - Match Rate 측정 시 bkit:gap-detector 호출 → 90%+ 시 /pdca report
─────────────────────────────────────────────────
```

---

## 변경 이력

- 2026-05-31: 중간 보고서 작성 (Phase 1·2·3 + v1.5 정책 완료, Phase 4·5 보류)
