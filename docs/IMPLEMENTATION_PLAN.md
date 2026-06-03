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
| LP-01 | 통합 홈 화면 | (2026-06-01 UX 재구성) ① Hero(검색+인기검색어 / 서비스 상태박스) → ② 빠른 행동 2갈래 택1(답 찾기 `/search` · 문의하기 `/tickets/new`)+내 문의 보조링크 → ③ 제품·역할 탭 병합(`/help/[code]` · `/role/[key]`). 기존 자주찾는작업·CTA 섹션 제거(계정 작업은 프로필로 이동) | 전체 | P1 |
| LP-02 | GNB 네비게이션 | (2026-06-01 UX 재구성) 행동 기준 4개: 홈 · 도움말 찾기(`/search`) · 문의하기(`/tickets/new`) · 문의 현황(`/tickets`) + 🟢 운영시간 배지(유지) + 🔔 공지(`/notices` 배지). 셀프픽스·서비스현황 메뉴 미사용. 푸터에 OA 패밀리 아웃링크(oapms.com·oachat.ai·blog) + 연락 정보(ContactPanel) 유지. `/search`는 페이지 중앙 검색바 단독 배치 | 전체 | P1 |
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

> **검색 동의어 확장 (v1.2, 2026-05-31)** — SS-01 통합 검색뿐 아니라 SS-02 제품별 가이드 목록 검색(`listArticles`)도 `synonyms-master`(`term_groups`/`term_synonyms`) 기반 동의어 확장을 적용한다. `expandKeywords()`로 확장한 대표어·이형어를 ① `keywords` 배열 매칭(GIN) + ② title/summary/body ILIKE 로 OR 결합. 작성자가 `keywords`를 누락해도 본문 ILIKE로 매칭되도록 보강(예: "실시간객실" → "실시간 객실"). 두 검색 함수는 `buildArticleSearchCondition()` 헬퍼를 공유.

> **공백·하이픈 무시 매칭 (v1.3, 2026-06-01)** — 동의어 사전에 한 형태만 등록해도 띄어쓰기·붙여쓰기·하이픈 변형이 모두 매칭된다. `collapseSpacing()`(`lib/text/normalize.ts`, NFC+lower+trim 후 `[\s\-_·.]` 제거)을 ① 인덱스(`loadSynonymIndex`)에 normalize 키와 함께 등록 + ② 질의(`expandKeywords`/`suggestCategoriesFromText`)에서 토큰·인접 bigram·전체입력 collapse 키로 탐색. 예: 사전 `check in` 하나로 `check-in`/`checkin` 매칭, 사전 `실시간 객실`로 `실시간객실` 매칭. 갭 탐지도 collapse 키로 집계하여 `실시간 객실`/`실시간객실`을 한 후보로 병합하고 둘 중 하나만 등록돼도 커버로 간주. → **운영자가 변형을 일일이 중복 입력할 필요 없음.**

> **아티클 기반 동의어 갭 탐지 (v1.3 Phase A, 2026-06-01)** — 발행 아티클의 `keywords[]`(사람이 큐레이션한 한글 키워드)를 전수 집계해 빈도·아티클 수를 산출하고, `loadSynonymIndex().termToGroupIds`와 대조하여 **"아티클엔 있으나 동의어 사전엔 미등록"** 키워드를 추출한다. 읽기 전용 분석 — 스키마 변경 없음, 자동 INSERT 없음(검색 품질 오염 방지: 후보 제시 → 어드민 검수 → 반영 원칙). `analyzeKeywordGaps()`(`lib/services/keyword-gap.ts`) + `/admin/master/synonyms` 상단 "아티클 미등록 키워드" 카드(Top N, 빈도순). 각 후보는 "그룹 생성"(canonical 프리필) 링크로 기존 동의어 등록 흐름에 연결. **Phase B(LLM 그룹화 검수 큐)·Phase C(0건 검색 로그)는 후속.**

> **검색 관련도 정합성 수정 (v1.6 Phase 1, 2026-06-01)** — 검색 매칭은 동의어 확장 결과로 하면서 점수·하이라이트는 **원본 검색어 글자**로만 계산하던 불일치를 수정. ① 점수를 확장 term 기준으로 재계산(`lib/text/search-match.ts`의 `matchesAnyTerm`/`keywordsMatchAnyTerm`): `base(0.5) + title(2.5) + summary/summary30s(1) + keywords(1) + 원본 직접일치(1)`. 신규 `summary` 필드와 작성자 `keywords`도 순위에 반영. ② "제목/질문 일치" 뱃지를 `score>=2` 추정 대신 명시적 `titleMatch`/`questionMatch` 플래그로. ③ 하이라이트를 원본어 1회 → 확장 term 전체 정규식(`buildHighlightRegex`). ④ **FAQ(`searchFaqs`)·공지(`searchNotices`)도 동의어 확장 적용** — 이전엔 도움말만 확장하고 FAQ/공지는 원본 ILIKE만 했음(통합검색 불일치 해소).

> **시맨틱 검색 — 하이브리드 (v1.6 Phase 2, 2026-06-01)** — `articles.embedding vector(1536)`(pgvector) + OpenAI `text-embedding-3-small`. `searchArticles`가 **키워드 leg(ILIKE+동의어) + 벡터 leg(코사인 최근접)** 를 id로 병합, 점수 = 키워드 점수 + `cosine_sim × 4`. 키워드로 안 잡히는 의미 매칭("결제가 안돼요" → 결제 오류 문서)을 시맨틱 leg가 커버. **HNSW 코사인 인덱스**(`articles_embedding_hnsw`), 마이그레이션 `0020`에서 `CREATE EXTENSION vector` 수동 보강(멱등). 임베딩은 발행/수정 시 자동 생성(`generateArticleEmbedding`), 기존 데이터는 `npm run db:backfill-embeddings`(147건 적용 완료). **graceful degrade**: `OPENAI_API_KEY` 미설정/quota 오류 시 임베딩 null → 기존 키워드 검색으로 폴백(서비스 중단 없음, 키 활성 즉시 시맨틱 자동 ON). 마이그레이션은 `drizzle-kit migrate`로만 적용(`db:push`는 `articles_search_tsv` GIN 인덱스를 DROP하므로 금지). **남은 한계**: tsvector/ts_rank DB 랭킹 이관, FAQ/공지 임베딩 확대는 후속.

> **검색 품질 측정 — Layer A 오프라인 평가 (v1.6, 2026-06-01)** — **`/admin/master/search-quality`** (어드민>마스터, 한 페이지 통합). 골든셋(`search_eval_queries`: 질의→정답 아티클slug/FAQid)을 실제 `searchArticles`+`searchFaqs`에 돌려 **Hit@1·Hit@3·MRR·nDCG@5**(`lib/services/search-eval.ts`)를 산출, 실행 스냅샷을 `search_eval_runs`에 저장. 판정 모드 label/llm/hybrid(LLM-as-a-judge 0~3, `lib/services/llm.ts` gpt-4o-mini). **첫 실측(FAQ 12건, label)**: Hit@1 67% / Hit@3 83% / MRR 0.78 / nDCG 0.81.
>
> 골든셋 관리 화면: ①**순위 버킷 대시보드**(≤4위/5~8위/9위↓/정답없음) ②**10배치 진행률 프로그레스바** 측정(`evaluateBatch`+`saveRun`, 클라이언트 순차 호출) ③리스트에 **최신 순위 + 지난 3회 추세**(`getRankHistory` — 최근 run details에서 추출, 스키마 변경 없음) + 실사용 지표 조인 ④**입력**: 수기 + AI 추천 2종(`suggestFromLogs` 검색이력 기반·현재 top 결과를 정답 후보 제시 / `suggestFromTroubleshoot` 문제해결 아티클 기반 LLM 증상형 질의) → 검수 모달 선택 후 `bulkCreateEvalQueries`. FAQ 시드 병행.

> **검색 품질 측정 — Layer B 온라인 지표 (v1.6, 2026-06-01)** — `/admin/search-quality/usage`. `search_logs`에 실사용 검색 1행씩 기록(`logSearch`, best-effort), 결과 클릭(`recordClick`)·접수 전환(`recordTicketIntent`)은 `<TrackedLink>` → `navigator.sendBeacon` → `POST /api/search/track`로 사후 업데이트. 대시보드 지표: **0건 검색률 + 0건 top 질의(콘텐츠/동의어 갭)·CTR·평균 클릭 위치·검색→접수 전환율·자가해결(deflection) 추정**(`getUsageStats`/`topZeroQueries`/`topQueries`). 최근 30일 window. 권한 manager+admin. 마이그레이션 `0022`.

> **FAQ 검색 도움말 동일화 (v1.7, 2026-06-01)** — FAQ 검색(`searchFaqs`)을 아티클(`searchArticles`) 수준으로 끌어올려 통합검색 두 엔진을 일치시킨다. v1.6까지 FAQ는 동의어 확장 후 `question`/`answer` ILIKE만 — keywords 배열·시맨틱·인기 가중치가 없어 사전에 없는 표현이면 0건이었다.
> - **(A) keywords 태그** — `faqs.keywords text[]` + GIN(`faqs_keywords_gin`). 어드민 FAQ 에디터에 아티클과 동일한 칩 입력 + `AiTriggerBtn`(question+answer→한글 키워드 AI 제안, 선택 필드). 약어·영문·교차언어는 keywords가 아니라 동의어 마스터(`term_groups`/`term_synonyms`) 담당(역할 분리). `searchFaqs`에 `arrayOverlaps(faqs.keywords, expanded)` leg 추가(`buildArticleSearchCondition`와 동일 패턴).
> - **(B) 인기·유용도 랭킹 + 정렬 버그 수정** — 기존 미사용 컬럼 활용: `viewCount`(로그 스케일 가중), `helpfulYes/(yes+no)`(최소표본 가드). v1.6 `searchFaqs`는 `sortOrder`로 자른 뒤 점수 계산 → 관련도 높은 FAQ 누락 가능. **매칭 전체 fetch 후 score 정렬→limit**으로 수정(FAQ는 소량).
> - **(C) FAQ 시맨틱 — 하이브리드** — `faqs.embedding vector(1536)` + HNSW 코사인 인덱스(`faqs_embedding_hnsw`). `buildFaqEmbeddingInput`(question+answer 앞부분)→`generateFaqEmbedding`, 발행/수정 시 자동 생성. `searchFaqs`에 벡터 leg(코사인 최근접) 병합, 점수 = 키워드 점수 + `cosine_sim × 4`(아티클과 동일 가중). graceful degrade 동일(키 없으면 키워드 검색 폴백). 백필 `npm run db:backfill-faq-embeddings`. 마이그레이션은 `drizzle-kit generate`+`migrate`(`db:push` 금지).
> - **(D) 0건 질의 → 보강 원클릭** — `/admin/master/search-quality`(통합 페이지)의 `ZeroQueriesCard`에 0건 top 질의(최근 90일·최대 20건)를 빈도순 노출, 각 행에 "동의어 추가"(→`/admin/master/synonyms/new?canonical=`, **admin 전용 노출**)·"FAQ 작성"(→`/admin/faqs/new?question=`) 액션 링크. 운영자가 콘텐츠 갭을 즉시 보강하는 닫힌 루프 완성.

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
| CB-05 | 지식팩 내보내기 (AI 지식 가공) | 발행 아티클·활성 FAQ·동의어를 GPT-4o mini 최적 포맷(**Markdown / JSONL**)으로 가공해 다운로드. 본문 정규화(인라인 HTML 제거·이미지 alt화), 동의어 용어사전 인라인, self-contained 청크, AI 사용 지침 프리앰블. `/admin/master/knowledge-export` | 매니저·어드민 | P1 |

#### CB-05 지식팩 내보내기 상세

> 목적: oachat.ai(또는 자체 GPT-4o mini) 챗봇에 공급할 **AI 최적화 지식 스냅샷**을 생성한다.
> RAG 실시간 검색(이미 임베딩/하이브리드 검색 인프라 보유)과 별개로, "AI에게 직접 먹일 파일"을 한 곳에서 뽑는 도구.

**포맷 (2종, PDF 미포함 — AI 인식률·토큰효율상 구조화 텍스트가 우월)**
- `knowledge.md` — 사람도 검수 가능한 단일 지식 문서. ① AI 사용 지침 프리앰블 → ② 용어 사전(구어체→표준어) → ③ 도움말 아티클(제품별) → ④ FAQ(제품별).
- `knowledge.jsonl` — 1행 1레코드. RAG/Assistants file_search/임베딩 재활용에 최적. `type`: `synonym` | `article` | `faq`.

**가공 규칙 (품질 핵심)**
1. 범위: `status='published' AND is_active=true` 아티클 + `is_active=true` FAQ + `is_active=true` 동의어 그룹·이형어. (제품 필터 옵션)
2. 본문 정규화: HTML 주석 제거, `<img>`→`[이미지: alt]`, `<br>`→개행, 스타일 전용 태그(span/div/font) 언랩, 3개 이상 연속 개행 축소.
3. 동의어를 문서 상단 "용어 사전"으로 인라인 → 모델이 사용자 구어체를 표준어로 매핑.
4. 각 항목을 self-contained 청크로 — 제품·카테고리·검색어·제목을 항목 헤더에 부착(RAG 분리 시 문맥 보존).
5. 아티클 출처 URL: `/help/{product}/{content_type}/{slug}` (인용용).

**구현 산출물**
- `lib/services/knowledge-export.ts` — 지식 로드 + 정규화 + `toMarkdown()`/`toJsonl()` 빌더 + 통계.
- `app/api/admin/knowledge-export/route.ts` — `GET ?format=md|jsonl&product=...` 다운로드(Content-Disposition attachment).
- `app/(admin)/admin/master/knowledge-export/page.tsx` — 통계·제품필터·다운로드·미리보기(매니저+어드민).

### 3. 이슈 클레임 (IC) — 문제 접수

| ID | 기능 | 핵심 동작 | 권한 | 우선순위 |
|:-:|:-|:-|:-:|:-:|
| IC-01 | 접수 폼 — 기본 정보 | 제품·호텔/장애명·유형(오류/장애/기능문의/기능개발/데이터수정/기타)·영향범위·제목·내용. 3단계 스텝퍼 | 호텔리어 | P1 |
| IC-02 | 접수 폼 — 멀티미디어 첨부 | 이미지·비디오·로그파일 (최대 50MB) | 호텔리어 | P1 |
| IC-03 | 접수 폼 — 연락 수단 선택 | SMS(솔라피)·이메일(SES) 선택. 접수확인 자동 발송 | 호텔리어 | P1 |
| IC-04 | 대리 접수 (관리자 수기) | 전화·카카오톡·이메일 등 외부 채널 문의를 매니저가 대신 접수. 유입채널은 `ticket_channels` 마스터에서 선택 (시드: web/phone/chatbot/kakao/email/walk_in). 자세히는 `ticket-channels-master` 참조 | 매니저 | P1 |
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
| DI-01 | 운영 인사이트 대시보드 | 액션카드(긴급·장기지연) + 핵심지표4종(셀프/원콜/원팀/Dev개입) + 행위자 5단계 퍼널 + 유입/처리·완료 차트 | 매니저·어드민 | P1 |
| DI-02 | 담당자별 처리 현황 | 처리건수·평균해결시간·미처리건수 테이블 | 어드민 | P3 |
| DI-03 | AI 자동해결률 트래킹 | AI/셀프 해결 비율, 목표치 설정 | 매니저·어드민 | P2 |
| DI-04 | (AI) 정보칩 기반 인사이트 | 반복 이슈·빈출 키워드·미해결 다발 제품 자동 분석 리포트 | 어드민 | P3 |
| DI-05 | 월간 리포트 자동 발송 | 월 1회 Slack 자동 발송 | — | P3 |
| DI-06 | 검색로그 | 어드민>인사이트>검색로그. 호텔리어 실사용 검색 1행=1회 나열(유입 키워드·유입일시·세션 체류시간·도움됨 반응표·유출 페이지 URL). 기간 어제/7일/30일(KST, 오늘 제외). 읽기 전용 | 매니저·어드민 | P1 ✅ |

> **DI-01 운영 인사이트 대시보드 (P1, 2026-06-02 설계)** — `/admin/insights/dashboard` (인사이트 그룹). 권한 매니저+어드민. 기간 필터 **어제/7일/30일**(KST, 오늘 제외) + 제품(productCode) 필터 공통 적용. 구성: ①**액션카드** 긴급 처리건(urgency=P1 AND status≠completed)·장기 지연건(미완료 AND **영업일 3일 초과**, `business_hours_*`/`business_holidays`로 영업일 경과 산출) ②**핵심지표 3종**(**도넛 미사용 — 완료건 대비 비율 카드 3개**, 모수=완료건, 보류·처리중 제외): 원콜완료(`tickets.one_call_resolved=true`, **신규 컬럼**)·원팀완료=자체해결(completed AND `slack_dev_thread_ts IS NULL`, 원콜+다회 포함)·Dev개입(`slack_dev_thread_ts IS NOT NULL`, 슬랙공유건). **원팀완료+Dev개입=100%(에스컬레이션 여부로 양분), 원콜완료는 자체해결의 부분집합이라 합산 대상 아님 — 각 비율은 완료건 대비 독립 지표**. 셀프완료(deflection)는 미사용 ③**행위자 5단계 퍼널**: 검색(호텔리어,`search_logs` 웹/챗봇 진입량)→문의(호텔리어,티켓 생성)→**접수=처리 착수(운영팀, status=in_progress 전환 시점, 미착수와 구분)**→Dev이관(운영팀,slack_dev_thread_ts)→완료(운영팀,completed). **전화=직접접수(검색 무관), 카카오·방문 채널 없음 → deflection 지표 미적용** ④**검색·호텔**: 검색어 워드클라우드 — `search_logs.normalized_query`를 `loadSynonymIndex().termToGroupIds`로 매핑해 **동의어 대표어(`term_groups.canonical_term`) 기준 빈도 집계**(표기 변형·유의어 합산), 사전 미등록어는 원본 유지(동의어 갭 신호), 0건 다발어 강조 / 호텔별 문의 수 Top 15(`tickets` GROUP BY hotel_id) ⑤**유입 분석**: 일자별×채널별 누적막대(**건당 1회 집계 — 채널 2개 이상은 '여럿' 단일 분류로 중복 합산 방지**, `channels.length>=2 ? '여럿' : channels[0]`)·유형별·제품별 ⑥**처리·완료**: 상태분포·평균 첫응답/해결시간(영업일)·담당자별 처리 테이블(DI-02 흡수)·Dev 에스컬레이션 백로그. **신규 스키마**: ⓐ`tickets.one_call_resolved boolean default false`(티켓 상세에서 담당자가 완료 처리 시 "원콜 해결" 체크) ⓑ`tickets.channels jsonb (string[]) default '[]'`(유입 채널 복수 — 같은 건이 이메일+AS 등 2개 이상으로 유입 가능. 기존 `channel` 단일값은 primary로 유지하거나 마이그레이션. 차트 버킷: `channels.length>=2 ? '여럿' : channels[0]`). 그 외 위젯은 기존 테이블 조회. **제외 결정**: 만족도 섹션·호텔리어 로그인 수 위젯은 1차 미포함(로그인 수는 `user.login` 이벤트 계측이 없어 보류). 시각 목업: `docs/dev-logs/2026-06-02-insight-dashboard-mockup.html`.
>
> **만족도 수집 (별도 Phase 분리)** — 검색/페이지 단위 만족도는 트리거(체류시간 임계·exit-intent `beforeunload`/`mouseleave`·검색완료 후 경과)로 비침투 팝업을 띄워 신규 테이블 `satisfaction_surveys`(context: search|page|ticket, rating, trigger_type, session_key, page_url)에 수집. 대시보드 1차에는 placeholder만 노출하고 수집 메커니즘은 후속 Phase로 진행한다.
>
> **사이드바 그룹**: 본 기능으로 어드민 사이드바에 **인사이트** 그룹(`GROUP_ORDER`: tickets → content → **insight** → org)을 신설했다. `search_logs` + `articles/faqs.helpful_*` 기존 자산을 조회 전용으로 활용(DB 스키마 변경 0건). 집계 대시보드는 `/admin/master/search-quality`(별도), 본 기능은 개별 행 나열에 집중. 상세: `docs/01-plan/features/search-logs.plan.md`, `docs/02-design/features/search-logs.design.md`.

### 6. 공지/업데이트 (NT)

| ID | 기능 | 핵심 동작 | 권한 | 우선순위 |
|:-:|:-|:-|:-:|:-:|
| NT-01 | 공지사항 목록·상세 | 점검·장애·업데이트. 제품 태그 필터. 상단 고정 | 매니저·어드민 | P1 |
| NT-02 | 릴리즈 노트 | 제품별 업데이트 내역 | 매니저 | P2 |
| NT-03 | 긴급 공지 배너 | 장애 발생 시 홈 최상단 자동 배너. 정상화 시 자동 해제 | 매니저(설정) | P1 |
| NT-04 | 홈 팝업 배너 | 공지 편집 노출옵션. 이미지+크기 프리셋(소/중/대)+종료일자(3·7일). 홈 모달 노출, 미리보기, 오늘 하루 안 보기 | 매니저·어드민(설정) | P1 |

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

## 5-bis. 공통 인프라 — 리치 에디터 (rich-editor)

> 텍스트 입력 10곳에 Tiptap WYSIWYG 리치 에디터 통합. 저장 포맷은 마크다운 유지(컬럼 무변경).
> 자세한 내용은 `docs/01-plan/features/rich-editor.plan.md`.

| 항목 | 결정 |
|:-|:-|
| 에디터 | **Tiptap v3.x + tiptap-markdown** (입력 WYSIWYG, 저장 마크다운) |
| 적용 범위 | 10곳 (필수 5 + 권장 5) — notice/article/faq/checklist-step/quick-reply + 티켓 4종 + system-settings |
| 저장 포맷 | 마크다운 (기존 `*_markdown` 컬럼 유지, **마이그레이션 0**) |
| 렌더링 | 기존 `components/articles/markdown-view.tsx` 재사용 |
| 이미지 업로드 | 기존 `/api/upload` + `purpose='editor'` 분기 + Rate Limit (분당 30회) |
| 이미지 마크업 | react-konva 기반 인라인 에디터. 도구: 화살표·박스·텍스트 (3색) + 그림자 프레임. 업로드 다이얼로그 안에서 [편집] → PNG 합성 → 기존 upload 흐름 (스크린샷 가공 용도, MVP) |
| 본문 미리보기 | 편집 중 상태 그대로 새 탭에서 `/help` 레이아웃으로 렌더. localStorage 10분 TTL, 어드민/매니저 권한 가드 |
| 첨부 | 이미지(jpg/png/webp/gif) + PDF, 개당 10MB. 영상 Phase 1 제외 |
| 자동 저장 | localStorage 2초 + `editor_drafts` 테이블 30초 |
| 신규 테이블 | `editor_drafts` (id, user_id, scope, target_id, draft_key, content_markdown, metadata, ...) |
| 단축키 | Cmd+Enter / Cmd+S / Cmd+/ / 슬래시 커맨드 / Cmd+? 도움말 |
| 슬래시 커맨드 | 빠른답변(`/q`) · SMS 미리보기(`/sms`) · 변수 칩(`/customer` 등) · 헤딩/표/이미지/링크 |
| SMS 미리보기 | 매니저 답변 화면 사이드 패널 (140자 카운터, 80자 초과 LMS 안내) |
| 발송 변환 helper | `markdown-to-plain`(SMS) / `markdown-to-html`(SES) / `markdown-to-slack-mrkdwn`(Slack) |
| brand-* 토큰 | role-mode-ui cascade 활용 — viewMode 전환 시 톨바 자동 적응 |
| 호텔리어 placeholder | "예시 채우기 ↳" 인터랙티브 토글 |
| Phase | 1(인프라) 1.5일 / 2(필수 5곳) 1일 / 3(권장 5곳+매니저) 1.5일 / 4(호텔리어+모바일) 1일 / 5(QA·문서) 0.5일 — **총 5.5일** |

### 신규 DB 컬럼 추가 (`editor_drafts` 1개 테이블)

```ts
// db/schema/editor-drafts.ts
editor_drafts (
  id uuid PK,
  user_id uuid FK users(id) ON DELETE CASCADE,
  scope varchar(50),                  // 'article'|'notice'|'faq'|'checklist-step'|'quick-reply'|'ticket-message'|'system-setting'
  target_id uuid,                     // 기존 편집 시 PK, 신규는 null
  draft_key varchar(200),             // 'scope:targetId' 또는 'scope:new:nonce' (UNIQUE per user)
  content_markdown text,
  metadata text,                      // JSON (선택 메타)
  created_at, updated_at, is_active
)
```

### 신규 API
- `POST/PUT/GET/DELETE /api/drafts/[scope]/[id]` — 본인 draft CRUD
- `/api/upload` 수정 — `purpose='editor'` 분기 + Rate Limit

### 후속 결정 (Phase 1 이후)
- 영상 처리 (A Blob 원본 / B Mux / C YouTube 링크만)
- @멘션 (내부 메모 매니저 간)
- 답변 수정 이력 (`ticket_message_versions`)
- AI 작성 보조 (IC-09/10) 통합
- 글 작성 페이지 사이드바 자동 접힘

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
| **운영시간 마스터** ✅ | `business_hours_default` · `business_hours_overrides` · `business_holidays` | ① 현재 운영시간 (점심·접수마감·긴급전화 안내문구) · ② 예약 변경 (기간/시간 일시적 오버라이드, cron 자동 활성화/만료) · ③ 공휴일 관리 · ④ 변경 이력 (`activity_logs` 필터) | **P1+P2 완료 2026-05-29** |

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
channel text,  // ticket_channels.code 참조 (FK 미설정). 마스터에서 어드민이 확장 가능.
slack_thread_ts varchar, slack_dev_thread_ts varchar,  // #as-new / #dev-escalation 스레드
one_call_resolved boolean default false,  // DI-01: 1회 작업 해결 여부, 담당자가 완료 처리 시 체크
created_at, updated_at, is_active
```

#### `ticket_channels` (유입 채널 마스터, IC-04 확장)
```ts
id, code text unique,               // 'web' | 'phone' | 'chatbot' | 'kakao' | 'email' | 'walk_in' ...
label text,                          // '웹' | '전화' | '챗봇' | '카카오톡' | '이메일' | '방문'
description text,
icon text,                           // lucide-react 컴포넌트 이름 (CHANNEL_ICON_MAP 화이트리스트)
selectable_in_agent_form bool,       // 대리 접수 폼 드롭다운 노출 여부 (web/chatbot false)
is_agent_default bool,               // 대리 접수 폼 기본 선택 (정책상 true는 1개)
sort_order int,
created_at, updated_at, is_active
```
- 시스템 채널(`web`, `chatbot`)은 비활성화/code 변경 불가 — UI + 백엔드 양쪽 보호.
- `tickets.channel`은 `code` 문자열 참조 (FK 미설정 — 마스터 비활성/삭제 시 과거 티켓 raw 보존).
- 어드민만 CRUD (`/admin/master/ticket-channels`).
- 자세히는 `docs/01-plan/features/ticket-channels-master.plan.md` + `docs/02-design/features/ticket-channels-master.design.md`.

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
// NT-04 홈 팝업 배너 (텍스트 띠 banner와 독립)
popup_enabled bool, popup_image_url text (nullable),
popup_image_width int (nullable), popup_image_height int (nullable), // CLS 방지용 원본 px (마이그 0025)
popup_size enum('small' | 'medium' | 'large') default 'medium',
popup_until timestamp (nullable, null이면 무기한),
published_at, author_id (FK users),
created_at, updated_at, is_active
```
> NT-04: `popup_enabled=true`이고 발행·활성·이미지 보유·`popup_until` 미경과인 공지를
> 홈 진입 시 모달로 노출. 크기 프리셋(소/중/대), 종료일자(3·7일 빠른 설정), 편집 미리보기.
> 사용자가 "오늘 하루 안 보기" 선택 시 브라우저 localStorage로 당일 미노출.

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

#### `popular_keywords` (하이브리드: 수동 큐레이션 + 검색로그 실시간 집계)
```ts
id, keyword, normalized_keyword,
kind enum('pin' | 'block'),   -- pin: 항상 상단 고정, block: 자동집계에서 제외
sort_order, created_at, updated_at, is_active
```
- **auto 행은 저장하지 않는다.** 홈/검색 노출 시 `search_logs.topQueries(30일)` 를 실시간 집계.
- 노출 = `pin`(sort_order) → auto top-N(`block` 제외 + 이미 pin된 것 제외) 순서로 병합, 최대 N개.
- DB row 0건이거나 auto 0건이면 `_constants.ts`의 하드코딩 fallback 사용.
- 캐시: `unstable_cache` 1h + `revalidateTag` (어드민 pin/block 편집 시 무효화).

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
// 주의: business_hours 키는 사용하지 않음 — `business_hours_default` 전용 테이블로 분리.
```

#### `business_hours_default` (현재 운영시간 — 단일 행)
```ts
id,                                  // 단일 행 강제 (unique index on (true))
weekday_open    time NOT NULL,       // 평일 운영 시작 (예: 10:00)
weekday_close   time NOT NULL,       // 평일 운영 종료 (예: 18:40)
lunch_start     time,                // 점심 시작 (예: 12:00, nullable)
lunch_end       time,                // 점심 종료 (예: 13:00, nullable)
intake_deadline time,                // 접수 마감 (예: 18:00, nullable — 운영종료보다 빠를 수 있음)
saturday_closed bool DEFAULT true,
sunday_closed   bool DEFAULT true,
holidays_closed bool DEFAULT true,   // 공휴일 자동 휴무
emergency_phone text,                // 070-8028-0919
emergency_note  text,                // "단순 금액 정정 불가" 등 안내문구
timezone        text DEFAULT 'Asia/Seoul',
updated_by      uuid (FK users),
created_at, updated_at, is_active
```
- **수정 즉시 반영** — `activity_logs(action='business_hours.default.update', payload={before, after})`
- 호텔리어 컨택 패널의 `useBusinessStatus()` 훅이 이 행을 기준으로 운영 중/외 판정.

#### `business_hours_overrides` (예약 변경 — 일시적 오버라이드)
```ts
id,
effective_from   date NOT NULL,      // 적용 시작일
effective_until  date NOT NULL,      // 적용 종료일 (포함)
kind enum('short_hours' | 'closed' | 'custom'),
                                     // short_hours: 단축운영, closed: 임시휴무, custom: 자유 설정
weekday_open    time,                // null이면 default 사용 (kind='closed'면 무시)
weekday_close   time,
lunch_start     time,
lunch_end       time,
intake_deadline time,
reason          text NOT NULL,       // "5/15 단축운영", "임직원 워크숍" 등
status enum('scheduled' | 'active' | 'expired' | 'canceled') DEFAULT 'scheduled',
applied_at      timestamp,           // cron이 status='active' 전환한 시각
created_by      uuid (FK users),
created_at, updated_at, is_active
```
- **충돌 방지**: 같은 날짜에 활성 override 2건 금지 (UI 사전 검증 + DB 부분 unique 제약 `WHERE status IN ('scheduled','active')`)
- **자동 전환**: cron (Vercel Cron 또는 on-demand) 매일 00:01에 `effective_from <= today` → active, `effective_until < today` → expired
- **취소**: status='canceled', is_active=false. `scheduled` 상태에서만 가능 (active는 종료일 단축으로 처리)
- **실시간 적용**: `useBusinessStatus()`는 `status='active'` override가 있으면 그것을 우선 적용

#### `business_holidays` (공휴일 마스터)
```ts
id,
date            date NOT NULL UNIQUE,  // 2026-01-01
name            text NOT NULL,         // "신정", "설날 연휴" 등
is_recurring    bool DEFAULT false,    // 매년 반복 (양력 기준 신정·광복절 등)
created_by      uuid (FK users),
created_at, updated_at, is_active
```
- `business_hours_default.holidays_closed=true`이면 이 날짜는 자동 휴무 처리.
- 음력 공휴일(설·추석)은 `is_recurring=false`로 매년 수동 등록 또는 천문연 API 연동 (P2).
- 시드: 2026년 공휴일 19종 (양력 8 + 음력 7 + 대체공휴일 4).

#### 운영시간 변경 이력 (`activity_logs` 활용)
별도 테이블 없이 `activity_logs`로 통합. UI에서 다음 action 필터링:
- `business_hours.default.update` — 현재 운영시간 수정
- `business_hours.override.create` — 예약 변경 등록
- `business_hours.override.cancel` — 예약 취소
- `business_hours.override.applied` — cron 자동 활성화 (system 액션)
- `business_hours.override.expired` — cron 자동 만료 (system 액션)
- `business_hours.holiday.create` / `holiday.delete` — 공휴일 관리

payload: `{ before, after, reason?, override_id?, holiday_id? }`

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

### Phase 0 — 프로젝트 셋업 (1~2일) — **완료 2026-05-28**
- [x] Next.js 15 + TypeScript 프로젝트 생성
- [x] Tailwind 4 + shadcn/ui 초기화 (메인 컬러는 우선 indigo, 추후 확정)
- [x] Drizzle ORM + Neon 연결 (DATABASE_URL)
- [x] Vercel 프로젝트 연동
- [x] 폴더 구조 골격 (`/app`, `/db`, `/lib`, `/components`, `/docs`)
- [x] `.env.example`, `.gitignore`, ESLint, Prettier
- [x] 다크모드 토글, ConfirmDialog 전역, Toaster 셋업
- [x] 헤더/GNB 레이아웃 골격 (LP-02 기준)
- [x] `.env`로 환경변수 정리, GitHub 저장소 연결

**완료 기준**: `npm run dev` → 빈 홈 + 다크모드 토글 + 헬스체크 API

### Phase 1 — 인증·권한·프로필 (3~4일) — **완료 2026-05-28**
- [x] NextAuth + OA SSO Provider 구현 (PM-04)
- [x] 역할 미들웨어 + `requireRole()` helper
- [x] `users`, `hotels`, `categories` 스키마 + 시드
- [x] 호텔리어 프로필 페이지 (AC-01, AC-02, AC-03)
- [x] 직원 계정 관리 (AC-04, AC-05)
- [x] 어드민 사용자 관리 (AC-06~10): 리스트·생성·편집·비번초기화·활성토글
- [x] 호텔 마스터 어드민 (Phase 7 마스터 일부 선행)
- [x] **운영시간 마스터 P1 선행** (`business_hours_default` + `business_holidays` 스키마·시드, `/admin/master/business-hours` ① 현재 운영시간 탭 + ③ 공휴일 탭, `useBusinessStatus()` 훅) — 호텔리어 컨택 패널이 의존 — **완료 2026-05-29**
- [x] 솔라피·SES 연동 (초대·비번초기화 SMS/이메일)
- [x] `activity_logs` 기본 셋업

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

### Phase 4 — 셀프 픽스 (2일) — **완료 2026-05-30**
- [x] `faqs`, `checklists`, `checklist_steps` 스키마 (`checklist_step_action_kind` enum)
- [x] SF-01 FAQ 목록 (`/faq` 아코디언 + 제품·유형 필터 + 검색 + 도움됨 위젯, ContactPanel sidebar)
- [x] SF-02 트러블슈팅 체크리스트 (`/troubleshoot` 허브 + `[id]` ChecklistRunner 단계별 분기 next/resolved/escalate, ContactPanel sidebar)
- [x] SF-04 어드민 편집 (`/admin/faqs`, `/admin/checklists` CRUD + 통계)

### Phase 5 — 이슈 클레임 (4~5일) — **완료 2026-05-28**
- [x] `tickets`, `ticket_messages`, `ticket_attachments`, `ticket_form_fields`, `notification_logs` 스키마
- [x] Vercel Blob 업로드 API + 첨부 업로더 컴포넌트 (S3 대신 Blob 선택)
- [x] IC-01 3단계 접수폼 (제품·유형·영향범위·긴급도·제목·내용)
- [x] IC-02 첨부 (최대 50MB, 총 200MB)
- [x] IC-03 연락수단 선택 (SMS·이메일)
- [x] IC-06 티켓 자동 생성 + 솔라피/SES 접수확인 + Slack `#as-new` 알림 (P1은 `#as-urgent` 동시 발송)
- [x] IC-04 대리 접수 (`/admin/tickets/new-by-phone`, 호텔·호텔리어 매핑 + 유입채널 드롭다운 + Blob 첨부)
- [x] **ticket_channels 마스터** (`/admin/master/ticket-channels`, 어드민이 채널 CRUD. 시스템 채널(web/chatbot) 보호. 시드 6종.)
- [x] IC-07 내부 메모 (호텔리어 비공개, 서버단 자동 필터)
- [x] IC-08 Dev 에스컬레이션 (Slack `#dev-escalation` + internal_memo 자동 기록)
- [x] IS-01 내 문의 (본인 + 같은 호텔)
- [x] IS-02 티켓 상세 + 추가 답변 (completed 시 폼 숨김)
- [x] IS-04 매니저 큐 (상태 탭 + 4종 필터 + 검색 + 요약 카드)
- [x] 매니저/어드민 헤더 + admin-nav에 "티켓 큐" 메뉴
- [x] 시드: 샘플 티켓 3건 + 메시지 9~10건 (idempotent)

### Phase 6 — 이슈 현황 (2~3일) — **완료 2026-05-30**
- [x] IS-01 내 문의 목록 (Phase 5 선행)
- [x] IS-02 티켓 상세 (처리이력·공개메모·추가 답변, Phase 5 선행)
- [x] IS-03 상태 3단계 알림 (SMS/이메일 자동) — `changeStatus` → `dispatchStatusChangeNotifications` (in_progress / completed) + notification_logs 기록
- [x] IS-04 어드민 티켓 큐 (칸반/리스트, 상태 변경, 담당자 배정, 마감일)
- [x] ⑦ 피드백 (`ticket_feedback` + `FeedbackWidget` 클라이언트 컴포넌트, 호텔리어 상세에서 노출)

### Phase 7 — 공지·릴리즈 (1~2일) — **완료 2026-05-30**
- [x] `notices` 스키마 (notice_kind enum: notice/release/incident, banner_until 자동 만료)
- [x] NT-01 공지 목록 (`/notices` 필터·페이지네이션) + 상세 (`/notices/[id]`) + 어드민 CRUD (`/admin/notices`)
- [x] NT-03 긴급 배너 자동 노출/해제 — `EmergencyBanner` RSC가 `service_status='incident'` + `notices.banner=true` 둘 다 처리, banner_until 시각 이후 lazy 자동 비표시

### Phase 8 — 챗봇 임베드 (1일) — **완료 2026-05-30**
- [x] CB-01 oachat.ai iframe 임베드 (`ChatbotFab` 우하단 fixed, 모바일 풀스크린) — 노출 제외 `/login`, `/admin/*`, `/profile/staff`
- [x] 장애 시 fallback (`OACHAT_EMBED_URL` 비어있으면 "문의 접수" 안내 카드)

### Phase 9 — 어드민 마스터 데이터 (3~4일) — **완료 2026-05-30**
- [x] `/admin/master` 라우트 그룹 (인덱스 카드 그리드)
- [x] 카테고리 관리 (제품/유형/긴급도/영향범위 탭)
- [x] 이슈 접수 폼 필드 (`form-fields`, 제품별 동적 필드)
- [x] 알림 템플릿 (SMS/이메일, 이벤트별)
- [x] 빠른 응대 (`quick-replies`)
- [x] 자주 찾는 작업 (`quick-actions`)
- [x] 역할별 시작 (`role-starters`)
- [x] 솔루션 링크 프리셋 (`solution-links`)
- [x] 시스템 설정 (key-value)
- [x] 동의어 사전 (`synonyms`)
  - [x] **아티클 기반 갭 탐지 (v1.3 Phase A, 2026-06-01)** — `analyzeKeywordGaps()` + `/admin/master/synonyms` "아티클 미등록 키워드" 카드. 읽기 전용 분석, 스키마 변경 없음.
- [x] 메뉴 구조 (`menu-taxonomies`)
- [x] 유입 채널 (`ticket-channels`)
- [x] 호텔 마스터 (Phase 1 선행 완료)
- [x] **운영시간 마스터 P2 보강** — `business_hours_overrides` 스키마, `/admin/master/business-hours` ② 예약 변경 탭 (CRUD + 충돌 검증) + ④ 변경 이력 탭 (`activity_logs` 필터 뷰), Vercel Cron daily 활성화/만료 핸들러 (`/api/cron/business-hours-overrides`, KST 00:01) — **완료 2026-05-29**
- [x] **운영시간 마스터 P3 보강** — (a) 양력 공휴일 일괄 복제 (`replicateRecurringHolidaysForYear`), (b) active override 종료일 단축 편집 (`shortenActiveOverride` + UI 인라인 폼), (c) 예약 적용 24시간 전 슬랙 알림 (cron 통합 `notifyUpcomingOverrides`, 'new' 채널), (d) 변경 이력 화면 user.name LEFT JOIN — **완료 2026-05-30**
- [x] **연락처 정보 일원화** (P3 정리, 2026-05-30) — `business_hours_default`에 컬럼 5개 추가(`main_phone`, `main_email`, `ars_items`, `fax_number`, `website_url`). ContactPanel 하드코딩 제거. `system_settings.business_hours` · `contact_phone` 키 시드/DB 모두 cleanup. 운영시간·점심·접수마감·긴급전화·대표전화·이메일·ARS·Fax·웹사이트가 **한 화면(/admin/master/business-hours 탭 ①)에서 통째로 관리** + 호텔리어 ContactPanel·헤더 배지·footer가 동일 단일 소스 구독.

### Phase 10 — 배포·검증 (1~2일) — **체크리스트 완성 2026-05-30**
- [x] 보안 헤더·CSP·Rate Limit·HSTS 코드 적용 (`next.config.ts`, `lib/rate-limit.ts`)
- [x] **배포 체크리스트 문서화** — `docs/DEPLOY_CHECKLIST.md` (환경변수·시드·보안·롤백·운영 매뉴얼 8장)
- [ ] Vercel 프로덕션 환경변수 설정 — 운영팀 작업
- [ ] 커스텀 도메인 연결 (`support.oapms.com`) — 운영팀 작업
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
