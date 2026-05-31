# knowledge-base-overhaul — PDCA Plan

> **사이클**: knowledge-base-overhaul · **레벨**: Dynamic · **시작**: 2026-05-31
> **목표**: 아티클 작성을 30분 → 8분으로 단축 + 1아티클=1의도 강제 + 챗봇 KB 메타데이터 자동 생성
> **팀**: [CTO] 풀스택 아키텍처 · [UX] 호텔리어/매니저 멘탈모델 · [UI] 디자인 시스템 · [AS] 기술 지식 정합성 · [CS] 고객응대 톤·해상도

---

## Executive Summary

| 항목 | 내용 |
|---|---|
| **Feature** | knowledge-base-overhaul (Stream A MVP) |
| **Goal** | 아티클 작성 자동화 (A1~A5) + 콘텐츠 품질 3대 목표 (1의도/빠른인식/챗봇KB) 달성 |
| **MVP Scope** | A1 본문 템플릿(+H3+마스터DB 이관) · A2 메뉴 캐스케이드 · A3 키워드 자동완성 · A4 관련문서 자동추천 · A5 Claude 보조 · A6 재편집 4모드 · **A7 Slug 운영 ID 규칙** · **A8 자동저장 가시화·토글** · B1 /help 메뉴 트리 · B2 /role 마스터 DB · **D1~D4 이미지 처리 (Stream D)** |
| **Out-of-Scope (v2)** | Stream C (챗봇 KB 인덱싱·자기완결 errors 승격) — A5에서 chatbot_meta 추출은 하되 영속화는 v2에서 |
| **예상 기간** | **5주** (Phase 1 ~ 5) · 5인 팀 병렬 진행 시 단축 가능 |
| **핵심 의존성** | Anthropic Claude API · 기존 마스터 (menu_taxonomies/term_synonyms/articles) · Tiptap RichEditor |
| **성공 지표** | 아티클 1건 평균 작성 시간 ↓ 60% / 발행 차단(errors) 비율 ↓ 80% / 챗봇 KB 메타 100% 자동 생성 |

### Value Delivered (4-Perspective)

| 관점 | 내용 |
|---|---|
| **Problem** | 아티클 작성이 어렵고 시간 걸림. 메타데이터(카테고리·키워드·관련문서) 전부 수동 입력. content_type별 본문 템플릿 부재로 매번 빈 화면에서 시작. 발행 직전에야 검증 차단. AI 보조 0%. 결과적으로 1건당 30분+ 소요·내부 일관성 저하·챗봇 KB로 직접 활용 불가. |
| **Solution** | 마스터 데이터(menu_taxonomies, term_synonyms, articles)와 에디터를 양방향 연결. content_type별 본문 자동 골격 주입. Claude로 slug·summary·keywords·관련문서·챗봇 메타 추출. 작성 중 실시간 사이드바 체크리스트로 발행 차단 사전 해소. |
| **Function · UX Effect** | (1) "사용자 의도" 카드 클릭 → 본문 H2 골격 자동 주입 (2) 메뉴 경로 캐스케이딩 드롭다운 (3) 키워드 입력 시 동의어 그룹 자동 제안 (4) 관련문서 검색 자동완성 (5) AI "한 번 클릭 작성 보조" 패널 (6) 작성 사이드바 = 실시간 체크리스트 + 통과 표시 |
| **Core Value** | 매니저 업무 효율 60% ↑ · 아티클 품질 일관성 ↑ (1의도/자기완결/메뉴정합) · 챗봇 KB 자동 인덱싱 기반 마련 (Stream C 진입 준비) |

---

## 1. Problem Definition — PM Lite

### 1-1. 사용자 3종과 그들의 진짜 통증

| 사용자 | 작업 컨텍스트 | 핵심 통증 (현재) | 기대 행동 |
|---|---|---|---|
| **호텔리어** (콘텐츠 소비자) | 문제 발생 → /help 또는 검색 → 아티클 클릭 → 30초 안에 해결 여부 판단 | 검색 결과 산만 / 메뉴 구조 안 보임 / 동의어 매칭 약함 → 결국 티켓 접수 | "이게 내 문제 맞다" 30초 안에 인식 + 따라할 단계가 명확 |
| **매니저** (콘텐츠 작성자) | 신규 이슈 패턴 발견 → 30분 들여 아티클 작성 → 발행 직전 검증 차단 → 재작성 | content_type 본문 골격 매번 손으로 / 메뉴 경로 오타 / 키워드 누락 / 관련 문서 못 찾음 | "8분 안에 발행" + "내 글이 챗봇에도 쓰일 거" 라는 자신감 |
| **챗봇** (콘텐츠 재소비자) | RAG 청크 단위로 아티클 인용 → 호텔리어 질문에 답변 | 아티클이 자기참조("위에서 말한") / 다중의도 / 메타데이터 결여 → 청크 단독 인용 시 의미 깨짐 | 청크 단독으로도 의미 완결 + intent/entities/steps 메타 |

[CS] "1아티클=1의도"는 챗봇 KB 입장에서 절대 명제. CS 응대 시 챗봇 답변이 부정확하면 신뢰 누적 파괴.
[AS] 기술 AS 관점에서는 "트러블슈팅의 5W1H(증상→원인→재현→해결→재발 방지)"가 자기완결성과 직결.

### 1-2. Stream A 5개 항목 진단 매트릭스

각 항목을 **[현재 상태]·[페인 강도]·[5인 팀 관점]·[목표 상태]·[승인 기준]**으로 정리.

#### A1. content_type별 본문 템플릿 자동 주입 + 실시간 체크리스트

- **현재 상태**: 빈 에디터로 시작. 매니저가 매번 손으로 H2 4개 입력. `validateBody` 발행 시점에야 차단. ([body-validator.ts:15-20](lib/articles/body-validator.ts#L15-L20))
- **페인 강도**: ★★★★★ (모든 아티클 작성마다 발생, 작성 시간의 30% 소비)
- **[UX]** 호텔리어 멘탈 모델: howto는 "따라하기", feature는 "이해하기", troubleshoot는 "고치기". 매니저 입장에서도 3가지 멘탈 모델이 명확함. 골격을 미리 주입하면 "빈 페이지 공포(blank page paradox)" 해소.
- **[UI]** content_type 카드 클릭 시 본문에 fade-in으로 H2 4개 + placeholder 텍스트 자동 삽입. 빈 H2는 사이드바 체크리스트에 "미작성" 표시. 작성 시 ✓로 변경.
- **[AS]** troubleshoot의 "증상/원인/해결/그래도 안 되면" 4단계는 기술 AS 5W1H와 정확히 매칭. 이를 강제하면 KB 품질 자연 상승.
- **[CS]** howto의 "다음 단계" 섹션은 CS 응대 시 follow-up 시나리오의 기반. 절대 빠뜨리면 안 됨.
- **[CTO]** 템플릿은 마크다운 상수로 관리 (`lib/articles/templates.ts`). 변경 시 코드 리뷰 거치도록. 사이드바 체크리스트는 `useMemo` 기반 실시간 H2 파싱.
- **목표 상태**: content_type 선택 → 0.3초 안에 본문 골격 + 사이드바 체크리스트 동기화
- **승인 기준**: (1) 3개 type 모두 골격 주입 동작 (2) 본문 입력 중 사이드바 체크리스트 실시간 갱신 (3) 기존 본문 있을 때 confirm dialog로 덮어쓰기 의도 확인

#### A2. categoryPath ↔ menu_taxonomies 캐스케이딩 드롭다운

- **현재 상태**: 자유 텍스트 `"예약 관리 > 예약 등록"` 입력. menu_taxonomies 마스터 존재하나 미참조. 오타 시 사이드바 누락. ([article-editor.tsx:326-336](app/(admin)/admin/articles/_components/article-editor.tsx#L326-L336))
- **페인 강도**: ★★★★☆ (오타 발생 시 도움말 트리에서 영원히 누락)
- **[UX]** 호텔리어 검색 시 "예약 관리"라고 입력했는데 작성자가 "예약관리"라고 띄어쓰기 빼면 매칭 깨짐. 마스터 드롭다운으로 강제하면 100% 일관성.
- **[UI]** 3단계 캐스케이딩 (제품 → 대분류 → 중분류 → 소분류). 셀렉트는 [shadcn/ui Combobox] 또는 native select. 기존 입력 마이그레이션을 위해 "수동 입력" 토글도 제공.
- **[AS]** 기술 AS 관점에서 메뉴 분류는 제품팀이 정의하는 정본. 작성자가 임의 분류하면 안 됨.
- **[CS]** CS팀이 사용자 문의를 매니저에게 에스컬레이션할 때 "어느 메뉴 영역" 식별 필요. 정본 분류 강제하면 분류 작업 0건.
- **[CTO]** menu_taxonomies는 (productCode, parentId)로 트리. 클라이언트 측에서 트리 빌딩은 무겁지 않음 (호텔당 메뉴 100개 미만). 서버 액션 1회 호출로 전체 트리 로드.
- **목표 상태**: 제품 선택 → 대분류 드롭다운 → 중분류 드롭다운 → 소분류 (선택) → categoryPath 배열 자동 직렬화
- **승인 기준**: (1) menu_taxonomies 변경 시 드롭다운 즉시 반영 (2) 기존 자유 텍스트 입력 가진 아티클 편집 시 "마스터에 없는 경로" 경고 + 매핑 제안 (3) 수동 입력 fallback 유지

#### A3. keywords 자동 추천 (term_synonyms + 본문 추출)

- **현재 상태**: 수동 입력만. term_synonyms 마스터 + `expandKeywords()` 검색 확장 있으나 작성 시점 미사용. ([article-editor.tsx:404-450](app/(admin)/admin/articles/_components/article-editor.tsx#L404-L450), [synonym-expander.ts:41-81](lib/services/synonym-expander.ts#L41-L81))
- **페인 강도**: ★★★★☆ (키워드 미만 시 워닝만, 발견되지 않는 아티클 다수 생성)
- **[UX]** 매니저가 "체크인"이라 쓰면 시스템이 "CI·check-in·체크인" 동의어 그룹을 제안 → 클릭으로 일괄 추가. 작성자는 결정만, 입력은 0.
- **[UI]** 키워드 입력란 아래에 추천 칩 행 (`text-xs`, 동의어 그룹별 색상 구분). 클릭 시 위 입력 영역으로 이동.
- **[AS]** 동의어 사전은 AS 팀이 가장 잘 안다 (현장 용어 vs 공식 용어). 사전 자체를 AS 팀이 마스터에서 직접 편집 → 작성자에게 자동 반영.
- **[CS]** CS 응대 시 호텔리어가 "CI 안 됨"이라 했는데 매니저 아티클이 "체크인 오류"로만 작성되어 있으면 매칭 실패. 동의어 강제 추가로 해결.
- **[CTO]** 추천 알고리즘: (1) 본문/제목에 등장한 토큰을 `expandKeywords`로 동의어 그룹 매칭 (2) 같은 productCode + content_type의 인기 아티클 top 10 키워드 빈도 (3) 최종 union → 매니저에게 제안.
- **목표 상태**: 제목 입력 직후 + 본문 1000자 이상 작성 시 자동 추천 7개 노출
- **승인 기준**: (1) 동의어 그룹 매칭이 정확 (2) 클릭으로 일괄 추가 가능 (3) 사용자 수동 추가 키워드는 그대로 유지 (덮어쓰기 X)

#### A4. 관련 문서 (related) 자동 추천 + 검색 자동완성

- **현재 상태**: 자유 텍스트 (slug 또는 uuid를 쉼표로 구분). 검색 자동완성 없음. 매니저가 기억으로 입력. ([article-editor.tsx:452-463](app/(admin)/admin/articles/_components/article-editor.tsx#L452-L463))
- **페인 강도**: ★★★☆☆ (자주 누락, 호텔리어가 follow-up 못 찾음)
- **[UX]** 호텔리어가 아티클 끝에서 "다음 단계" 또는 "관련 문서" 클릭 → 다음 아티클로 자연 이동. 매니저가 입력 안 하면 이 경로 단절.
- **[UI]** 입력란 + 자동완성 드롭다운 (검색 기반). 추천 후보 칩 행도 제공 (제목+slug 미리보기).
- **[AS]** "이 아티클은 X와 Y와 Z를 같이 봐야 한다"는 AS 팀의 도메인 지식. 매니저가 매번 기억 못 함.
- **[CS]** CS 응대 시 follow-up 자료 신속 제공의 핵심. 챗봇도 related 그래프를 활용한 추론 가능.
- **[CTO]** 추천 알고리즘: (1) 같은 productCode + categoryPath의 top 5 (2) 같은 키워드 교집합 ≥ 2 인 top 5 (3) 본문 내 마크다운 링크로 이미 참조한 아티클 자동 포함 → 최종 dedup top 7.
- **목표 상태**: 메타 정보 입력 직후 추천 5건 표시, 클릭 추가, 검색 자동완성 동작
- **승인 기준**: (1) 자동완성 200ms 내 응답 (2) 같은 productCode 우선 정렬 (3) slug + uuid 양쪽 호환 유지

#### A5. Claude 보조 — title→slug·summary, 본문→keywords/TOC/난이도/예상시간

- **현재 상태**: AI 0%. slug 자동 생성은 일반 슬러그화 규칙뿐 (한글 → 영문 transliteration 없음). ([article-actions.ts](app/actions/article-actions.ts))
- **페인 강도**: ★★★★★ (사용자 명시 요구 + 자동화 효과 최대)
- **[UX]** 매니저가 "✨ AI 보조" 버튼 클릭 → 현재 입력 컨텍스트(제목/본문)를 기반으로 (slug · summary · keywords · related · 챗봇 메타) 5종 제안. 매니저는 검토·수정·승인만. **결정자는 사람, 작업자는 AI**.
- **[UI]** 우측 사이드 패널 또는 본문 위 sticky bar에 보조 패널. 각 제안은 카드형 + "적용/거부" 버튼. 프롬프트는 노출 안 함 (실용성).
- **[AS]** AS 팀이 직접 본 사례 → AI가 표면 텍스트만 보고 추론한 메타는 50% 정확도. 따라서 **반드시 사람 확인 통과** 후 저장. 자동 저장은 금지.
- **[CS]** AI 제안 summary가 너무 마케팅톤이면 거부. CS 톤(객관/단호/공감)으로 가이드 프롬프트 작성.
- **[CTO]** 모델: Claude Sonnet 4.6 (가성비) + prompt caching 적용. system 프롬프트에 (1) content_type별 작성 가이드 (2) 호텔리어 어휘 사전 (3) 출력 JSON 스키마 명시. 호출 단위 비용 약 0.005~0.01 USD/회 예상.
- **목표 상태**: 본문 500자 이상 + 제목 입력 시 "AI 보조" 활성화. 클릭 1회로 5종 제안. 평균 응답 3~5초.
- **승인 기준**: (1) Claude API 호출 정상 (2) 출력 JSON 스키마 검증 통과 (3) 사람 확인 후에만 필드 반영 (4) 호출 실패 시 graceful degradation (수동 입력으로 fallback)

### 1-3. 페인-우선순위 매트릭스

| 항목 | 페인 강도 | 구현 복잡도 | ROI | MVP 우선순위 |
|---|---|---|---|---|
| A1 본문 템플릿 + 체크리스트 | ★★★★★ | 낮음 | 매우 높음 | **1순위** |
| A5 Claude 보조 | ★★★★★ | 높음 (API 호출 + 캐싱 + UX) | 매우 높음 | **2순위** |
| A2 메뉴 캐스케이드 | ★★★★☆ | 중간 | 높음 | **3순위** |
| A3 키워드 자동완성 | ★★★★☆ | 중간 | 높음 | **4순위** |
| A4 관련 문서 자동완성 | ★★★☆☆ | 중간 | 중간 | **5순위** |

---

## 2. Goal & Success Metrics

### 2-1. 최종 목표 (3개월 시점)

> "신규 매니저가 처음 출근한 날에도 30분 안에 첫 아티클을 발행할 수 있고, 그 아티클이 자동으로 챗봇 KB에 인덱싱된다."

### 2-2. MVP 성공 지표 (Phase 3 종료 시)

| 지표 | 현재 | 목표 | 측정 방법 |
|---|---|---|---|
| **아티클 1건 평균 작성 시간** | ~30분 | **≤ 8분** | activity_logs `article.create_started → article.published` 시간 차 |
| **발행 차단 (errors) 비율** | 미측정 (체감 ~50%) | **≤ 10%** | `validateBody` errors > 0인 시도 / 전체 시도 |
| **categoryPath 정합성** | 미측정 | **100%** | menu_taxonomies와 일치하지 않는 path = 0건 |
| **키워드 평균 개수** | 평균 3.2개 | **≥ 7개** | DB aggregate |
| **챗봇 KB 메타 자동 생성률** (Stream C 준비도) | 0% | **100%** | 발행 아티클 중 intent/entities/steps JSON 보유 비율 |
| **AI 보조 채택률** | N/A | **≥ 60%** | AI 제안 적용/거부 ratio |

### 2-3. UX 정성 지표

- 매니저 5명 인터뷰: "이전보다 작성이 쉬워졌다" ≥ 4명
- 호텔리어 검색 만족도 (5점 척도): 평균 3.5 → 4.0

---

## 3. Scope

### 3-1. In-Scope (MVP, v1.1 — Stream B 포함)

- **공개 페이지 측 (Stream B)**:
  - **B1** `/help/[product]` 사이드바를 `menu_taxonomies` 트리로 교체 + 드릴다운 navigation
  - **B2** `/role/[key]` 페이지를 `role_starters` DB + 매핑된 articleIds 기반으로 전환, 어드민 마스터에서 매핑 UI 제공
- **에디터 측 (Stream A)**: `app/(admin)/admin/articles/_components/article-editor.tsx` 전면 리팩토링 (519줄 단일 → 모듈 분리)
- **신규 라이브러리**:
  - `lib/articles/templates.ts` (content_type별 본문 골격)
  - `lib/articles/recommend.ts` (키워드/관련문서 추천)
  - `lib/ai/anthropic-client.ts` (Claude 보조)
  - `lib/ai/prompts/article-assistant.ts` (system 프롬프트)
- **신규 컴포넌트**:
  - `MenuPathCascader` (3단 캐스케이딩 드롭다운)
  - `KeywordRecommender` (키워드 추천 칩)
  - `RelatedArticleAutocomplete` (관련 문서 검색)
  - `AiAssistantPanel` (AI 보조 패널)
  - `ArticleChecklistSidebar` (실시간 체크리스트)
- **신규 API/Server Actions**:
  - `getMenuTaxonomyTree(productCode)` (1회 호출로 전체 트리)
  - `recommendKeywords(input)` (동의어 + 본문 토큰 + 인기 키워드)
  - `recommendRelatedArticles(input)` (카테고리 + 키워드 + 본문 링크)
  - `searchArticlesForAutocomplete(q)` (자동완성용 경량 검색)
  - `aiAssistArticle(input)` (Claude 호출 wrapper)
- **DB 변경**: 없음 (기존 마스터 활용)
- **검증 라이브러리 확장**: `body-validator.ts`에 "본문 H2 진척률" 계산 함수 추가

### 3-2. Out-of-Scope (v2 별도 사이클)

- **Stream C** 챗봇 KB 메타데이터 영속화 (C1 chatbot_meta JSONB 컬럼 추가 + 발행 시 저장 / C2 자기완결 violations errors 승격)
  - A5에서 AI가 chatbot_meta를 출력은 하지만, v1은 화면 표시 + draft에만 보관. 발행 시 DB 영속화는 v2.
- **자기참조 ("위에서 말한") 워닝 → errors 승격** (UX 영향 큰 변경이므로 별도 사이클)
- **AI 자동 발행** (사람 확인 없이 자동 발행은 본 사이클에서 금지)
- **다국어 번역** (한국어 우선)

### 3-3. Non-Functional Requirements

- **응답 시간**: 자동완성 ≤ 200ms · AI 보조 ≤ 5초
- **graceful degradation**: Anthropic API 장애 시 수동 입력 fallback 자동 전환
- **권한**: 모든 신규 API는 `requireRole(['manager', 'admin'])`
- **레이트 리밋**: AI 보조 호출은 매니저당 분당 10회 제한
- **다크모드**: 모든 신규 컴포넌트 dark: 클래스 적용

---

## 4. Information Architecture (마스터-에디터-공개페이지)

```
┌─────────────────────────────────────────────────────────────────┐
│                       MASTER (어드민 편집)                       │
│   menu_taxonomies   term_synonyms   articles (자체참조 그래프)    │
└──────────┬──────────────┬──────────────┬────────────────────────┘
           │              │              │
           ▼              ▼              ▼
  ┌────────────────────────────────────────────────┐
  │           EDITOR (article-editor.tsx)          │
  │   ┌─────────┐  ┌──────────┐  ┌──────────────┐  │
  │   │A1 템플릿│  │A2 캐스케이드│  │ A5 AI 보조  │  │
  │   └─────────┘  └──────────┘  └──────────────┘  │
  │   ┌─────────────┐  ┌────────────────────────┐  │
  │   │A3 키워드 추천│  │ A4 관련문서 자동완성    │  │
  │   └─────────────┘  └────────────────────────┘  │
  │   ┌─────────────────── Sidebar ──────────────┐  │
  │   │ ArticleChecklistSidebar (실시간 체크리스트) │  │
  │   └────────────────────────────────────────────┘  │
  └────────────────┬──────────────────────────────┘
                   │ 발행 (validateBody 통과)
                   ▼
        ┌─────────────────────┐
        │  articles 테이블    │
        │  + (Stream C) chatbot_meta JSONB  ← v2
        └─────────────────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │  PUBLIC PAGES       │  ← v2 (Stream B)
        │  /help/[product]    │
        │  /role/[key]        │
        └─────────────────────┘
```

[CTO] 본 사이클은 **에디터 ↔ 마스터** 양방향 연결에 집중. 공개 페이지(Stream B)와 챗봇 KB(Stream C)는 v2에서 별도 사이클.
[UX] 단방향 마스터-소비 흐름 유지: 어드민이 마스터 편집 → 에디터/공개 페이지가 자동 소비. 역방향(공개 페이지에서 마스터 추론) 금지.

---

## 5. Phases (3주 일정)

### Phase 1 (Week 1) — 본문 자동 골격 + 메뉴 캐스케이드 (A1, A2)

| 작업 | 담당 관점 | 완료 기준 |
|---|---|---|
| `lib/articles/templates.ts` 작성 (howto/feature/troubleshoot 골격 + placeholder) | [AS][CS] | content_type 3종 × H2 4개 + 가이드 텍스트 |
| content_type 선택 시 본문 골격 자동 주입 (confirm dialog 포함) | [UX][UI] | 빈 본문 → 즉시 주입 / 기존 본문 → 덮어쓰기 확인 |
| `ArticleChecklistSidebar` 컴포넌트 (실시간 H2 진척률) | [UI][CTO] | useMemo 기반, 작성 중 0.5초 이내 업데이트 |
| `getMenuTaxonomyTree(productCode)` server action | [CTO] | 트리 구조 반환, 200ms 내 응답 |
| `MenuPathCascader` 컴포넌트 (3단 드롭다운 + 수동 입력 fallback) | [UI][UX] | 제품 변경 시 트리 리셋, 기존 자유 텍스트 마이그레이션 경로 |
| 기존 article-editor.tsx 모듈 분리 시작 (`_components/editor/` 하위) | [CTO] | 519줄 → 5개 파일 분할, 동일 동작 보장 |

**Phase 1 Acceptance**: `npm run typecheck` + `npm run lint` 통과 · 기존 e2e 회귀 없음 · 신규 컴포넌트 단독 동작.

### Phase 2 (Week 2) — 키워드/관련문서 자동완성 (A3, A4) + /help 메뉴 트리 (B1)

| 작업 | 담당 관점 | 완료 기준 |
|---|---|---|
| `recommendKeywords(input)` server action (동의어 + 본문 토큰 + 인기 키워드) | [CTO][AS] | 7개 추천, 300ms 내 응답 |
| `KeywordRecommender` 컴포넌트 (추천 칩 + 클릭 추가) | [UI][UX] | 그룹 색상 구분, 이미 추가된 키워드는 비활성화 |
| `recommendRelatedArticles(input)` server action | [CTO][CS] | 카테고리 + 키워드 + 본문링크 dedup top 7 |
| `searchArticlesForAutocomplete(q)` server action (경량 검색) | [CTO] | 200ms 내 응답, 발행된 아티클만 |
| `RelatedArticleAutocomplete` 컴포넌트 (검색 + 자동완성 + 추천 칩) | [UI][UX] | slug + uuid 양쪽 호환 |
| body-validator: 키워드 수동 ≥ 3개 워닝 유지 + 추천 적용 시 자동 해소 | [AS] | 추천 클릭 시 워닝 즉시 사라짐 |
| **B1 — `/help/[product]` 메뉴 트리 사이드바** (Phase 1의 `getMenuTaxonomyTree` 재사용) | [UI][UX][CTO] | 트리 노드 클릭 → `?path=` 쿼리로 아티클 리스트 필터, 펼침 상태 URL 동기 |

**Phase 2 Acceptance**: 추천 정확도 매니저 3인 정성 평가 통과 · API 응답 시간 SLA 충족 · /help/cms 메뉴 트리에서 모든 카테고리 도달 가능.

### Phase 3 (Week 3) — Claude AI 보조 + /role 마스터 DB (B2) + 통합 (A5)

| 작업 | 담당 관점 | 완료 기준 |
|---|---|---|
| `lib/ai/anthropic-client.ts` (model: Sonnet 4.6, prompt caching) | [CTO] | 호출 wrapper + 에러 핸들링 + 토큰 사용량 로깅 |
| `lib/ai/prompts/article-assistant.ts` (system 프롬프트 + JSON 스키마) | [AS][CS] | content_type별 가이드 + 호텔리어 어휘 + CS 톤 |
| `aiAssistArticle(input)` server action | [CTO] | 입력 검증, JSON 스키마 결과 반환, rate limit |
| `AiAssistantPanel` 컴포넌트 (제안 카드 + 적용/거부) | [UI][UX] | 응답 3~5초, 적용 시 해당 필드 즉시 반영 |
| graceful degradation: API 장애 시 패널 비활성화 + 토스트 | [CTO] | 호출 실패 시 수동 입력 흐름 유지 |
| **B2 — `/role/[key]` 페이지를 `role_starters` DB 기반으로** (정적 `ROLE_STARTERS` 상수 제거) | [CTO][UX] | DB에서 articleIds 매핑 fetch → 실제 아티클 카드 노출, label/description은 DB가 SoT |
| **B2 — 어드민 `master/role-starters` 매핑 UI** (articleIds 추가/제거/순서 변경) | [UI][UX][CS] | 검색 자동완성으로 아티클 선택, 드래그 정렬, soft-delete |
| 통합 e2e: 본문 골격 → 메뉴 캐스케이드 → 키워드 추천 → 관련 추천 → AI 보조 → 발행 + /help 메뉴 트리 + /role 페이지 | [전팀] | 8분 이내 발행 시나리오 통과 + KB-07·KB-08 통과 |

**Phase 3 Acceptance**: AI 채택률 매니저 5명 테스트에서 ≥ 60% · 평균 작성 시간 ≤ 8분 측정 · /role/front 호텔리어 3명 인터뷰에서 "처음 출근일에 본격 활용 가능" 통과 · 모든 NFR 충족.

### Phase 4 (Week 4) — A6 재편집 4모드 + diff 미리보기

| 작업 | 담당 관점 | 완료 기준 |
|---|---|---|
| `lib/ai/prompts/article-rewriter.ts` — 4모드별 system 프롬프트 + JSON 출력 스키마 | [AS][CS][CTO] | mode = 'reorder' \| 'fill-gaps' \| 'tone' \| 'custom' 각각 검증 통과 |
| `aiRewriteArticleAction(input)` server action — rate limit 분당 5회/일 100회 (메타 추출보다 보수) | [CTO] | input/output 검증 + truncation + 에러 핸들링 |
| `RewritePanel` 컴포넌트 — 모드 선택 + (custom일 때) 명령 입력란 | [UI][UX] | 4모드 라디오 + 호버 설명 + custom 명령 자동완성(템플릿 5개) |
| `DiffPreviewModal` 컴포넌트 — 사이드-바이-사이드 markdown diff | [UI][UX] | 라인별 변경 색상(추가 emerald · 삭제 rose · 수정 amber) + H2 섹션별 [적용] 토글 + [절부 적용]/[거부] |
| markdown diff 유틸 — H2 섹션 단위로 split + 라인 diff | [CTO] | `diff` 패키지 사용 또는 자체 markdown-aware diff |
| body-validator: 재편집 적용 후 자동 재검증 + 사이드바 체크리스트 갱신 | [AS] | apply 직후 ✓⏳ 즉시 업데이트 |
| 통합 e2e: KB-09 (4모드 각각 호출 + 적용/거부) | [전팀] | 4모드 모두 동작 + 거부 시 본문 보존 |

**Phase 4 Acceptance**: 매니저 5명이 A6-1(reorder)·A6-2(fill-gaps)·A6-3(tone)·A6-4(custom) 각 1회 이상 사용 + 적용률 ≥ 40% + 재편집 후 body-validator errors ≤ 0건.

### Phase 5 (Week 5) — Stream D 이미지 처리 4종

| 작업 | 담당 관점 | 완료 기준 |
|---|---|---|
| **D1** 자동 리사이징 (max 폭 1920px) — server `sharp` | [CTO] | 업로드 시 자동, 원본 보존 |
| **D2** 포맷·압축 최적화 (PNG → WebP, JPEG quality 85) — server `sharp` | [CTO] | 평균 파일 크기 60% ↓ |
| **D3** AS 이미지 에디터 (화살표·박스·번호·텍스트 라벨) — `tui-image-editor` 또는 `react-konva` | [UI][UX][AS] | 5종 도구 + Undo/Redo + 저장 |
| **D4** 브라우저/모바일 프레임 — CSS overlay | [UI] | 3종(Mac chrome / iOS / Android) frame overlay |
| 이미지 업로드 server action — S3 multipart, 메타데이터 저장 | [CTO] | 권한 검증 + 최대 10MB |
| 통합 e2e KB-10 (업로드 → 리사이징 → 에디팅 → 저장 → 본문 삽입) | [전팀] | 전 단계 통과 |

**Phase 5 Acceptance**: 매니저 5명이 D3 에디터로 화살표 1회 이상 추가 + D2 파일 크기 평균 60% 축소 측정.

---

## 6. Risks & Mitigations

| Risk | 영향 | 확률 | 완화 |
|---|---|---|---|
| Anthropic API 장애·요금 폭증 | 높음 | 낮음 | rate limit + 일일 호출량 모니터링 + graceful degradation |
| menu_taxonomies 마이그레이션 어려움 (기존 자유 텍스트) | 중간 | 중간 | Phase 1에서 "마스터에 없는 경로" 경고만 + 수동 매핑 UI · 신규 작성은 캐스케이드 강제 |
| 추천 알고리즘 부정확 → 매니저 신뢰 저하 | 높음 | 중간 | Phase 2 매니저 정성 평가 통과 후 릴리즈 · 추천 무시 가능하게 UI 설계 |
| 본문 골격 강제로 기존 작성자 거부감 | 중간 | 낮음 | 항상 "수동 모드" 토글 제공 · 기존 본문 있을 때 confirm dialog |
| article-editor.tsx 리팩토링 회귀 버그 | 중간 | 중간 | Phase 1에서 모듈 분리만, 기능 추가 없음 · e2e 회귀 테스트 필수 |
| AI 보조 부정확 → 잘못된 메타데이터 발행 | 높음 | 중간 | 자동 저장 금지 · 사람 확인 통과 후에만 반영 · 거부 패턴 학습 (v2) |
| Vercel 배포 후 ANTHROPIC_API_KEY 누락 | 낮음 | 낮음 | `vercel env add` 안내 + 시작 시 키 존재 체크 |

---

## 7. Architecture & Component Inventory

### 7-1. 파일 인벤토리 (신규/변경)

```
lib/
  articles/
    templates.ts                       [NEW] content_type 본문 골격
    recommend.ts                       [NEW] 키워드/관련문서 추천 알고리즘
    body-validator.ts                  [EDIT] H2 진척률 함수 추가
  ai/
    anthropic-client.ts                [NEW] Claude SDK wrapper
    prompts/
      article-assistant.ts             [NEW] system 프롬프트 + JSON 스키마
    rate-limiter.ts                    [NEW] 매니저당 분당 10회
  services/
    master-menu-taxonomies.ts          [EDIT] getMenuTaxonomyTree() 추가
    articles.ts                        [EDIT] searchArticlesForAutocomplete() 추가

app/
  actions/
    article-actions.ts                 [EDIT] aiAssistArticle, recommendKeywords, recommendRelatedArticles 추가
  (admin)/admin/articles/
    _components/
      editor/                          [NEW DIR]
        article-editor.tsx             [SPLIT from 519-line single]
        editor-meta-form.tsx           [NEW]
        editor-body.tsx                [NEW]
        article-checklist-sidebar.tsx  [NEW]
        ai-assistant-panel.tsx         [NEW]
      menu-path-cascader.tsx           [NEW]
      keyword-recommender.tsx          [NEW]
      related-article-autocomplete.tsx [NEW]

components/editor/
  rich-editor.tsx                      [EDIT] onInsertTemplate prop 추가
```

### 7-2. 데이터 흐름

```
[매니저 화면]
  content_type 카드 클릭
    → A1: lib/articles/templates.ts 에서 마크다운 골격 fetch
    → RichEditor 에 onInsertTemplate(markdown)
    → editor-body.tsx 가 H2 파싱하여 sidebar에 전파
    → ArticleChecklistSidebar 실시간 갱신

  제품 코드 선택
    → A2: getMenuTaxonomyTree(productCode)
    → MenuPathCascader 가 트리 렌더링
    → 3단 선택 시 categoryPath: string[] 직렬화

  제목 입력 + 본문 500자+
    → A3 자동 트리거: recommendKeywords({ title, body, productCode })
    → KeywordRecommender 가 그룹 색상 칩으로 표시
    → 클릭 → 키워드 배열에 추가

  메타 확정
    → A4: recommendRelatedArticles({ productCode, categoryPath, keywords, body })
    → RelatedArticleAutocomplete 가 추천 칩 + 검색 입력

  "✨ AI 보조" 버튼
    → A5: aiAssistArticle({ title, body, contentType, productCode })
    → AiAssistantPanel 에 5종 제안 카드 (slug, summary, keywords, related, chatbot_meta_v0)
    → 사용자가 카드별 적용/거부

  발행
    → validateBody (errors 0건) → createArticleAction/updateArticleAction
```

[CTO] 모든 server action은 `app/actions/article-actions.ts`에 통합. Rate limiting은 `lib/ai/rate-limiter.ts` (Redis 사용 가능하면 Upstash, 없으면 메모리). 본 사이클은 메모리 한정.

### 7-3. AI 프롬프트 골격 (article-assistant.ts)

```ts
// system 프롬프트 (prompt cache 대상, 변경 없음)
const SYSTEM = `당신은 호텔 OA 솔루션 도움말 작성 보조입니다.
입력: 매니저가 작성 중인 아티클의 title, body(markdown), contentType, productCode.
출력: JSON {
  slug: string (영문 소문자 + 하이픈, 60자 이내),
  summary: string (200자 이내, 30초 이해 가능),
  keywords: string[] (7~10개, 호텔리어 현장 어휘 + 공식 어휘 동의어 포함),
  related_search_hints: string[] (3~5개, 관련 아티클 검색에 쓸 키워드),
  chatbot_meta: {
    intent: string (한 문장),
    entities: string[],
    steps: string[] (howto/troubleshoot 만),
    expected_time_minutes: number,
    prerequisites: string[]
  }
}
규칙:
- 한국어 본문은 한국어로, 영어 약어(CI, OTA 등)는 보존.
- 마케팅 톤 금지. CS 톤: 객관, 단호, 공감.
- chatbot_meta.intent는 "1아티클=1의도" 원칙. 다중 의도면 가장 우선되는 하나만.
- slug는 한글 → roman transliteration 후 keyword 핵심 단어 1~3개.`;
```

[AS] 프롬프트 검증 시 실제 호텔 현장 용어 사전을 함께 봐야 함. → term_synonyms 마스터를 context로 첨부하는 방안 (Phase 3 후반).

---

## 8. Open Questions (사용자 결정 필요)

| # | 질문 | 추천 |
|---|---|---|
| Q1 | Anthropic 모델은 Sonnet 4.6 vs Haiku 4.5? | **Sonnet 4.6** (품질 우선, 호출량 적음) |
| Q2 | AI 보조 호출 한도는? | **매니저당 분당 10회 / 일 200회** |
| Q3 | A1 본문 골격 적용 시 기존 본문 있으면? | **confirm dialog로 덮어쓰기 의도 확인** (잃을 위험) |
| Q4 | 추천 알고리즘 인기 키워드는 viewCount 기준? helpfulYes? | **(viewCount × 0.7 + helpfulYes × 0.3)** 가중치 |
| Q5 | AI 보조에 본문 전체 전송? 5000자 cap? | **5000자 cap + truncation 시 사용자 알림** |
| Q6 | AI 호출 비용 예산? (월 한도) | **월 50 USD 한도** (Sonnet 4.6 기준 약 5000 호출) |
| Q7 | 본문 골격 텍스트는 누가 작성? | **AS 팀이 초안 + Plan 검토 시 확정** |
| Q8 | content_type 카드 호버 시 골격 미리보기 보여줄지? | **예** (덮어쓰기 부담 완화) |

---

## 9. Acceptance Criteria (전체)

본 사이클 종료 조건:

- [ ] A1~A5 모두 동작 (Phase 1~3 Acceptance 모두 통과)
- [ ] 매니저 5명 테스트: 평균 작성 시간 ≤ 8분
- [ ] Gap Analysis (gap-detector): Match Rate ≥ 90%
- [ ] e2e 시나리오 추가: KB-01 (howto 작성) / KB-02 (feature 작성) / KB-03 (troubleshoot 작성) / KB-04 (AI 보조 적용) / KB-05 (수동 fallback) / KB-06 (API 장애 fallback)
- [ ] 타입체크 + 린트 통과
- [ ] dev-log HTML 작성 (3주 동안 매주 1건)
- [ ] PDCA REPORT.md 작성 + Match Rate 95% 이상

---

## 10. Team Allocation (5인 팀)

> CTO-Led Agent Teams 활성화 시 병렬 실행. 비활성화 시 Claude가 5인 시뮬레이션.

| Phase | [CTO] | [UX] | [UI] | [AS] | [CS] |
|---|---|---|---|---|---|
| **Phase 1** | 모듈 분리 / 트리 API | content_type 멘탈모델 검증 | 캐스케이더 UI / 사이드바 | 본문 골격 텍스트 작성 | 다음 단계 섹션 톤 |
| **Phase 2** | 추천 알고리즘 / API | 추천 UX 흐름 | 추천 칩 / 자동완성 | 동의어 그룹 정합성 | 관련문서 우선순위 |
| **Phase 3** | Anthropic 통합 / rate limit | AI 보조 패널 UX | 카드 디자인 | 프롬프트 + 챗봇 메타 스키마 | CS 톤 가이드라인 |

---

## 11. Stream B 보강 (v1.1) — /help 메뉴 트리 + /role 마스터 DB

### 11-1. 변경 이유

사용자 초기 요구사항: "(1) /help/cms — 마스터페이지 메뉴구조 반영 안 됨 / (2) /role/front — 마스터·아티클 어떻게 연결되고 자동화될 수 있을지". 초안 PLAN에서 Stream B를 v2로 미뤘으나, 챗봇 KB 최적화·1아티클=1의도 원칙은 **공개 페이지 노출 전략과 분리 불가**. v1.1에서 MVP에 승격.

### 11-2. B1 — /help/[product] 사이드바 메뉴 트리

- **현재 상태**: `categoryPath[0]` 문자열 카운트만 사이드바에 노출. menu_taxonomies 트리 미사용. ([help/[product]/page.tsx:71-75](app/help/[product]/page.tsx#L71-L75))
- **[UX]** 호텔리어 멘탈 모델: 가이드를 메뉴 구조로 검색하는 패턴이 가장 직관적. "예약 관리 → 예약 등록" 트리 노드 클릭 → 해당 카테고리 아티클만 필터.
- **[UI]** 사이드바 트리는 펼침/접힘 + 현재 선택 highlight + 카운트 배지. URL `?path=예약+관리/예약+등록` 쿼리로 펼침 상태 동기 (북마크/공유 가능).
- **[AS]** 메뉴 트리가 정본이면 작성자(매니저)·소비자(호텔리어)·관리자(어드민)가 같은 IA를 공유. 분류 일관성 보장.
- **[CTO]** Phase 1의 `getMenuTaxonomyTree(productCode)` 재사용 → 추가 비용 거의 없음. 트리 ↔ 아티클 매칭은 `categoryPath` 배열의 prefix match.

### 11-3. B2 — /role/[key] 마스터 DB + 매핑 UI

- **현재 상태**: 정적 상수 `ROLE_STARTERS` 사용 (label/description/icon만). `role_starters` DB 테이블에 `articleIds: uuid[]` 컬럼 있으나 미연동. ([role/[key]/page.tsx:14-35](app/role/[key]/page.tsx#L14-L35))
- **[UX]** 호텔리어 첫 출근일 시나리오: "프론트 시작하기" 클릭 → 7개 핵심 가이드가 순서대로 카드로 노출 → 첫 가이드부터 따라 학습. 정적 상수는 운영 변경 불가능 → "신규 직원 온보딩 KPI" 측정 불가.
- **[UI]** `/role/[key]` 페이지는 hero + role description + **아티클 카드 그리드** (순서대로). 카드는 제목 + summary + 예상 시간 (chatbot_meta 활용 가능 시).
- **[CS]** "신규 직원이 처음 출근한 날 무엇부터 봐야 하는가"는 CS팀이 가장 자주 받는 질문. 매핑 UI에서 직접 운영 가능해야 함.
- **[AS]** 매핑은 어드민 `master/role-starters` 페이지에 추가 — 기존 마스터 편집 패턴 그대로 (검색 자동완성으로 아티클 선택, 드래그 정렬).
- **[CTO]** DB 스키마 변경 0. 기존 `articleIds: uuid[]` 컬럼 그대로 활용. 신규 server action `getRoleStarterWithArticles(roleKey)` 추가.

### 11-4. 일정 영향 — 3주 유지

- **Phase 2 후반 1일**: B1 사이드바 트리 컴포넌트 + 기존 정적 카운트 사이드바 교체
- **Phase 3 후반 1.5일**: B2 `/role/[key]` 페이지 전환 + 어드민 매핑 UI + e2e KB-07, KB-08

기존 일정은 그대로 유지. menu_taxonomies tree 함수 공유로 시너지 확보.

### 11-5. 성공 지표 추가

| 지표 | 현재 | 목표 |
|---|---|---|
| /help 메뉴 트리 사용률 | 0% | ≥ 40% 사용자가 사이드바 트리에서 1회 이상 클릭 |
| /role/[key] 페이지 가이드 클릭 ≥ 1건 비율 | N/A (placeholder) | ≥ 70% |
| 신규 매니저 온보딩 시간 (정성) | "막막함" | "한 페이지로 시작 명확" |

### 11-6. 신규/변경 파일 추가 (v1.1)

```
lib/services/
  role-starters.ts                     [NEW]   getRoleStarterWithArticles(roleKey)

app/
  help/[product]/
    _components/
      menu-tree-sidebar.tsx            [NEW]   B1: menu_taxonomies 트리 사이드바
    page.tsx                           [EDIT]  사이드바 교체
  role/[key]/page.tsx                  [REWRITE] B2: DB 기반 페이지로 전환
  (admin)/admin/master/role-starters/
    _components/
      role-starter-mapping-form.tsx    [EDIT]   articleIds 검색 자동완성 + 드래그 정렬
  actions/
    role-starter-actions.ts            [EDIT]   getRoleStarterWithArticles, updateRoleStarterArticles

tests/e2e/knowledge-base/
  kb-07-help-menu-tree.spec.ts         [NEW]   /help/cms 트리 → 아티클 도달
  kb-08-role-starter.spec.ts           [NEW]   /role/front 매핑된 아티클 노출
```

[CTO] 추가 파일 7개 (신규 4, 변경 3). 총 변경 파일 22 → 29.

---

## 변경 이력

- 2026-05-31 v1.0: 초안 작성 (5인 팀 PM Lite + Plan 일괄, Stream A만)
- 2026-05-31 v1.1: **Stream B MVP 승격** (B1 /help 메뉴 트리, B2 /role 마스터 DB). 일정 3주 유지.
- 2026-05-31 v1.2: **A6 재편집 신설** (4모드 + diff 미리보기). Phase 4 (Week 4) 추가. 일정 3주 → 4주.
- 2026-05-31 v1.3: **A7 Slug ID 규칙 + A1+ H3·마스터DB 이관 + A8 자동저장 + Stream D 이미지 4종** 추가. **Phase 5 (Week 5) 신설**. 일정 4주 → **5주**. 자세히는 §12·§13 참조.
- 2026-05-31 v1.4: **모델 분기 결정** — A6-3 톤 보정만 `claude-haiku-4-5-20251001`, 나머지는 `claude-sonnet-4-6`. 월 비용 ~$43 (예산 $50 안). v1.5에서 system 프롬프트 5000자+ 확장 + prompt cache로 추가 30% 절감 가능. 자세히는 DESIGN §16-0 참조.

## 12. A7·A8·A1+ 보강 (v1.3)

### 12-1. A7 — Slug 운영 ID 규칙

- **기존**: `slugify(title)` → 한글 시 fallback timestamp 6자리. URL이 무의미 hash.
- **신규**: `{productCode}-{contentType}-{seq3}` 형식 (예: `pms-howto-042`, `cms-troubleshoot-013`).
- **atomic counter**: 신규 테이블 `article_seq_counters (product_code, content_type, next_seq)` — tickets `ticket_no` 패턴과 동일 (커밋 `fa35d27` 참고).
- **호환**: 기존 발행 slug는 그대로 유지. redirect 매핑 없이 새 규칙은 신규 작성부터.
- **변경 함수**: `generateArticleSlug(productCode, contentType)` — title 인자 제거.

[CTO] race-free 채번을 위해 atomic counter 테이블 사용. Drizzle 마이그레이션 1건 추가.
[CS] URL을 운영자가 이해할 수 있는 패턴으로 통일 — CS 응대 시 slug만으로도 카테고리 추정 가능.

### 12-2. A1+ — H3 sub-headings + 마스터 DB 이관

- **신규 테이블 `article_templates`**: `(id, content_type, version, body_markdown, outline JSONB, hover_preview, is_active, ...)`. 코드 상수(`lib/articles/templates.ts`)는 seed 후 유지(기본값) + DB가 정본.
- **H3 sub-headings 추가**: 
  - `howto.단계` → H3 "준비물", "주의 사항"
  - `troubleshoot.해결 단계` → H3 "1차 시도", "2차 시도", "확인 사항"
- **어드민 페이지 `master/article-templates`**: 골격 편집 UI (markdown 에디터 + 미리보기). 운영팀이 직접 변경 + 변경 이력.
- **에디터 통합**: `getArticleTemplate(contentType)`이 DB fetch로 전환. 캐시 적용.

[AS] 골격이 자주 안 바뀌더라도 마스터 편집 가능한 게 CLAUDE.md "어드민 DB 편집 우선 설계" 원칙과 일치.

### 12-3. A8 — 자동저장 가시화 + ON/OFF 토글

- **현재**: RichEditor `autoSave={{scope, targetId}}` 3초 debounce → localStorage + `/api/drafts`. 사용자 인식 표시 없음.
- **신규**:
  - 사이드바 상태바 추가: "✓ 3초 전 자동저장됨" / "● 저장 중..." / "⚠ 변경됨, 저장 안 됨"
  - 토글 스위치: ON / OFF (OFF 시 페이지 이탈 시 ConfirmDialog 경고)
  - 상태는 `useAutosaveStatus()` 훅으로 관리, 사이드바에 표시.
- **데이터**: localStorage에 `autosave-enabled-${userId}` 토글 상태 저장. 기본값 ON.

[UX] 매니저가 안심하고 작성 가능. 토글 OFF는 "지금은 저장 안 했으면 좋겠음"(예: 실험 작성) 시나리오.

---

## 13. Stream D 보강 (v1.3) — 이미지 처리 4종

### 13-1. D1·D2 자동 리사이징 + 압축 (서버 sharp)

- **Route Handler**: `POST /api/articles/images` — multipart 업로드 → sharp 변환 → S3 저장 → 변환된 URL 반환.
- **변환 규칙**:
  - max width 1920px (비율 유지)
  - PNG → WebP (RGBA 보존)
  - JPEG quality 85 (visually lossless)
  - 원본은 별도 S3 prefix `original/` 보관 (옵션)
- **메타데이터 DB**: 신규 테이블 `article_images (id, article_id_nullable, uploaded_by, original_url, webp_url, width, height, byte_size, ...)`.

### 13-2. D3 AS 이미지 에디터 (화살표·박스·번호·텍스트)

- **라이브러리 결정**: `tui-image-editor` (TOAST UI, 한국어 우호적, 무료 + AGPL) 또는 `react-konva` (커스텀).
  - **추천**: `tui-image-editor` — 즉시 사용 가능. 라이선스 검토 후 도입.
- **5종 도구**: 화살표 / 박스 / 번호 라벨 / 텍스트 / 강조 highlight
- **Undo/Redo** + 캔버스 export PNG → 다시 D1·D2 변환 → S3 저장
- **모달 형태**: 본문 이미지 클릭 → "✏️ 편집" 버튼 → 모달 풀스크린.

### 13-3. D4 브라우저/모바일 프레임 (CSS overlay)

- **3종**: Mac Safari chrome / iOS iPhone frame / Android frame
- **구현**: 이미지 위 CSS `background-image` overlay 또는 `<svg>` 프레임. 코드 가벼움.
- **저장**: 프레임은 보기용 메타데이터로만 저장, 본 이미지는 그대로. 렌더링 시 frame 종류 적용.

### 13-4. Phase 5 일정

- D1·D2: 1.5일 (sharp 패키지 통합 + Route Handler + 메타데이터 DB)
- D3: 2.5일 (tui-image-editor 통합 + 5종 도구 + 모달 UI)
- D4: 0.5일 (CSS frames)
- e2e KB-10: 0.5일
- 통합 + 디버그: 1일

총 약 6일 (Week 5 + 약간 여유).

### 13-5. 신규 파일 (v1.3)

```
lib/
  articles/
    slug.ts                            [NEW]   A7: generateOpsId(productCode, contentType)
    templates.ts                       [EDIT]  마스터 DB 우선, 코드 상수는 seed 기본값
  services/
    master-article-templates.ts        [NEW]   A1+: CRUD
    article-images.ts                  [NEW]   D1·D2·D3: 메타데이터 + S3 wrapper
  ai/
    (unchanged)

db/schema/
  article-seq-counters.ts              [NEW]   A7: atomic counter
  article-templates.ts                 [NEW]   A1+: 골격 DB
  article-images.ts                    [NEW]   D: 이미지 메타데이터

app/
  actions/
    article-actions.ts                 [EDIT]  generateArticleSlug 시그니처 변경
    article-template-actions.ts        [NEW]   A1+: 어드민 CRUD
    article-image-actions.ts           [NEW]   D: 업로드/변환 server action
  api/articles/images/route.ts         [NEW]   D1·D2 multipart 업로드
  (admin)/admin/articles/_components/editor/
    autosave-status-bar.tsx            [NEW]   A8
    image-editor-modal.tsx             [NEW]   D3
  (admin)/admin/master/article-templates/
    page.tsx                           [NEW]   A1+ 어드민 페이지
    _components/
      template-editor.tsx              [NEW]   markdown + outline 편집
components/ui/
  image-frame.tsx                      [NEW]   D4 CSS frames

scripts/
  seed-article-templates.ts            [NEW]   코드 상수 → DB seed

tests/e2e/knowledge-base/
  kb-10-image-pipeline.spec.ts         [NEW]   업로드 → 변환 → 에디팅 → 저장
```

총 신규 파일 +14, 변경 +2 → **합계 49개** (신규 35, 변경 14).

### A6 세부 (v1.2)

| 모드 | 호출 트리거 | 입력 | 출력 |
|---|---|---|---|
| **A6-1 reorder** | contentType 변경 시 자동 제안 (수락 시 호출) | { 기존 body, fromType, toType } | { reorderedBody, summaryOfChanges[] } |
| **A6-2 fill-gaps** | "✨ 빈 섹션 채우기" 버튼 | { body, contentType, title, summary, productCode } | { filledBody, addedSections[] } |
| **A6-3 tone** | "✨ 톤 보정" 버튼 | { body, contentType } | { revisedBody, changedPhrases[] } (CS 톤·자기참조/다중의도 제거) |
| **A6-4 custom** | "✨ 자유 명령" + 사용자 입력 | { body, contentType, command(string) } | { revisedBody, summaryOfChanges[] } |

[UX] 모든 모드 결과는 **DiffPreviewModal**로 표시. H2 섹션 단위 토글 + [전부 적용]/[부분 선택 적용]/[거부]. 거부 시 본문 변경 0.
[AS] 4모드 모두 본문 5000자 cap + 출력 5000자 cap. 초과 시 truncation + 토스트.
[CS] custom 명령 자동완성 템플릿 5개: "더 짧게" · "단계 더 자세히" · "용어 통일" · "초보 호텔리어 눈높이" · "약어 풀어쓰기".
