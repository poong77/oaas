# 완료 보고서 — 제품 가이드 검색 동의어 확장 (kb-search-synonym)

> PDCA Check 92% → Act(클린업) → Report
> 작성일: 2026-05-31 · 작성: Claude (시니어 개발자 톤)

---

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | kb-search-synonym (제품별 가이드 검색 동의어 확장) |
| 기간 | 2026-05-31 (단일 세션) |
| 유형 | 버그 수정 + 리팩터링 + 클린업 |
| Match Rate | 92% (gap-detector) |
| 커밋 | `eba60b0`, `6550857`, `7a57328` (main 푸시 완료) |
| 변경 파일 | 3개 (`articles.ts`, `master-synonyms.ts`, `IMPLEMENTATION_PLAN.md`) |
| 코드 변화 | +50 / −91 (죽은 코드 제거 포함 순감) |
| 타입체크 | `tsc --noEmit` exit 0 |

### 1.3 Value Delivered (4관점)

| 관점 | 내용 |
|------|------|
| **Problem (문제)** | 제품별 가이드(`/help/pms`) 검색이 입력값 그대로 ILIKE만 수행 → "실시간객실"(붙여쓰기) 0건. 어드민에 등록한 동의어가 제품 가이드 검색에 전혀 반영되지 않음 (글로벌 검색 SS-01에서만 동작). |
| **Solution (해결)** | `listArticles()`의 `q` 검색에 `expandKeywords()` 동의어 확장 적용. `searchArticles()`와 `buildArticleSearchCondition()` 헬퍼를 공유해 두 검색 로직 통일. keywords 배열 매칭(GIN) + 확장 term 각각 본문 ILIKE를 OR 결합. |
| **Function/UX Effect (기능·UX 효과)** | "실시간객실" → 동의어 그룹 "실시간 객실"로 확장 → 제목 매칭 3건. 어드민 동의어 마스터 편집이 제품 가이드 검색에 즉시 반영(5분 캐시, `revalidateTag('synonyms')`). 호텔리어 셀프서치 성공률 개선. |
| **Core Value (핵심 가치)** | "세세하게" — 띄어쓰기·이형어 차이를 흡수하는 동의어 기반 검색으로 자가 해결률 향상. 어드민 마스터 데이터가 실제 동작에 연결됨. |

---

## 2. PDCA 사이클 요약

```
[Plan] ✅ → [Design] ⏭️(버그수정·생략) → [Do] ✅ → [Check] ✅ 92% → [Act] ✅(클린업) → [Report] ✅
```

| Phase | 내용 |
|-------|------|
| Plan | 사용자 화면 캡처(스크린샷)로 "실시간객실 vs 실시간 객실" 검색 결과 불일치 원인 진단 |
| Do | `listArticles`에 동의어 확장 적용 + 공용 헬퍼 추출 (`eba60b0`) |
| Check | gap-detector Gap 분석 → Match Rate 92%, 갭 4건 도출 |
| Act | 🟡 SQL 바인딩 교체(`6550857`) + 죽은 코드 제거·주석 보강(`7a57328`) |

---

## 3. 구현 상세

### 3-1. 핵심 변경

- **`lib/services/articles.ts`**
  - `buildArticleSearchCondition(expanded)` 공용 헬퍼 신설 — `listArticles`/`searchArticles` 공유
    - leg (1) `arrayOverlaps(articles.keywords, expanded)` — 정확 일치 GIN 가속 경로 (파라미터 바인딩)
    - leg (2) 확장 term 각각 title/summary/summary30s/bodyMarkdown ILIKE — 의미 매칭 실질 보장
  - `listArticles()` `q` 검색에 `expandKeywords(q, { maxTokens: 16 })` 적용
  - `searchArticles()` 동일 헬퍼로 리팩터링 (중복 제거)
- **`lib/services/master-synonyms.ts`**
  - 미사용 `_deprecatedLoadSynonymIndex` (~64줄) 제거
- **`docs/IMPLEMENTATION_PLAN.md`**
  - SS 섹션에 "검색 동의어 확장 (v1.2)" 명세 추가

### 3-2. 정합성 검증 (gap-detector)

| 검증 항목 | 결과 |
|-----------|------|
| listArticles 동의어 확장 + 공용 헬퍼 사용 | ✅ |
| 정규화 일치 (쿼리 토큰 ↔ 인덱스 키 모두 `normalizeTerm`) | ✅ 핵심 |
| 회귀 안전 (`params.q` 있을 때만 확장) | ✅ |
| 다단어 대표어 통째 ILIKE (`trimmed` 원본 보존) | ✅ |
| SQL 이스케이프 안전성 | ✅ (arrayOverlaps 바인딩으로 교체 완료) |

---

## 4. 학습·주의사항 (Lessons Learned)

1. **마스터 데이터는 "연결"까지 확인** — 동의어 테이블·어드민 편집 UI가 있어도, 실제 검색 함수(`listArticles`)가 조회하지 않으면 무의미. 마스터 기능은 소비처까지 추적 필요.
2. **gap-detector 지적도 검증 대상** — "`revalidateTag(tag, "default")` 2-인자가 비표준"이라는 지적은 오판이었음. **Next 16.2.6은 두 번째 인자 필수** (1-인자가 오히려 타입 에러). 리뷰 지적도 프레임워크 버전에 맞춰 재확인.
3. **`sql.raw` 수동 이스케이프는 latent foot-gun** — 사용자 입력이 닿는 경로는 drizzle `arrayOverlaps` 등 파라미터 바인딩 우선.

## 5. 후속(선택)

- 🔵 keywords GIN leg 대소문자/공백 민감 — keywords 저장 시 정규화 정책 도입하면 GIN 효용↑ (현재는 ILIKE leg가 보완하므로 기능 영향 없음).
- 무관 untracked: `scripts/import-help-articles.mjs`, `scripts/data/help-pms-room-extra-specs.mjs` — 별도 작업물, 미처리.
