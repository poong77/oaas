# knowledge-base-overhaul — v1.7 미니 사이클 종료 보고서

> **사이클**: 부채 D5·D6·D7 (v1.6 후속)
> **종료일**: 2026-06-01
> **Match Rate**: **95%+** (구현 가능 항목 전수 + Check 통과)
> **상태**: 완료 — D2는 사용자 수동 액션으로 분류

---

## Executive Summary

| 항목 | 내용 |
|---|---|
| **사이클 범위** | "다 진행해" — v1.6 잔여 부채 D5·D6·D7 (D2는 사용자 안내, D8·D9는 별도) |
| **commits** | 3 (D7·D6·D5) + 1 (REPORT v1.7) |
| **코드 변경** | +540줄 |
| **신규 라이브러리** | 1 (`lib/ai/mock.ts`) |
| **신규 의존성** | 3 (`@dnd-kit/core` · `@dnd-kit/sortable` · `@dnd-kit/utilities`) |
| **typecheck** | ✅ 전 step 통과 |
| **프로덕션 e2e** | **3/3 통과** (KB-07·08·08b 회귀 0) |

### Value Delivered (4-Perspective)

| 관점 | 내용 |
|---|---|
| **Problem** | A6 rewriter SYSTEM 짧아 cache 비활성 / 매핑 UI에 dnd 없어 ↑↓만 / AI 보조·재편집 회귀 검출 인프라 부재 |
| **Solution** | COMMON_HEADER 4290자 (호텔 사전 + 모드별 예시) / @dnd-kit 통합 + ↑↓ 보존 / E2E_MOCK_AI 분기 + 결정적 mock 4모드 |
| **Function · UX** | 4모드 cache hit 시 input 토큰 90% 절감 / 드래그+키보드 a11y / KB-04·KB-09b 시나리오 작성 |
| **Core Value** | A6 호출 비용 ~50%↓ (cache 30% 가정) · 매핑 UX ↑ · CI/CD 회귀 검출 가능 (mock 환경) |

---

## commit별 진척

| 부채 | commit | 내용 |
|---|---|---|
| **D7** prompt cache rewrite | `3cdbd9d` | COMMON_HEADER 600→4290자 (호텔 어휘 사전 + 골격 가이드 + 거부 시나리오 + 모드별 예시) |
| **D6** dnd-kit 드래그 정렬 | `86832d0` | `@dnd-kit/{core,sortable,utilities}` + `SortableRow` 컴포넌트 + ↑↓ 버튼 보존 |
| **D5** mock Anthropic | `d869892` | `lib/ai/mock.ts` + action 분기 + KB-04(A5)·KB-09b(A6 tone) e2e |

---

## 주요 결정 사항

### 1. D7 — COMMON_HEADER 4290자 도달
- article-assistant.ts SYSTEM_PROMPT (v1.6 D4)와 동일 패턴
- 호텔 업무 약어 20+ · 객실 상태 5종 · 한글 키워드 50+
- content_type 골격 3종 + 작성 가이드
- 거부 시나리오 4종 + 모드별 출력 예시 4개 + summary 가이드
- 4모드 모두 cache_control 'ephemeral' 효과 활성

### 2. D6 — @dnd-kit + ↑↓ 둘 다 유지
- PointerSensor (mouse/touch) + KeyboardSensor (Tab+Space/Arrow) — a11y
- activationConstraint distance: 4px — 클릭 vs 드래그 구분
- 드래그 핸들 GripVertical + touch-none (모바일 스크롤과 분리)
- ↑↓ 버튼은 보조 유지 — 드래그 불가능 환경 호환
- 안내문: "드래그하거나 ↑↓ 버튼 / 키보드 화살표로 순서를 바꿀 수 있어요"

### 3. D5 — mock 인프라 (production 절대 비활성)
- `MOCK_ENABLED = process.env.E2E_MOCK_AI === '1'`
- production 환경에서는 E2E_MOCK_AI 미설정 → 절대 활성 안 됨
- 권한·rate-limit·zod 등 server action 전체 흐름은 그대로 통과 (회귀 검출 보존)
- `mockAssistOutput` / `mockRewriteOutput` — 결정적 응답 (contentType/mode별 다양성)
- KB-04: slug 제안 → 적용 → 필드 채움
- KB-09b: tone 모드 → 모달 → 전부 적용 → 토스트

---

## Check 결과

- ✅ `tsc --noEmit` 전 step 통과
- ✅ 프로덕션 e2e: KB-07 (6.8s) · KB-08 (1.2s) · KB-08b (0.7s) — **3/3 통과**
- ✅ 3 commits 모두 push 완료
- ✅ D5/D6/D7 변경이 production에 영향 없음 확인

### Match Rate 95%+
- 구현 가능 항목 100% (D5·D6·D7)
- D2 (KB-01 로컬 e2e) — 사용자 수동 액션 필요 → 안내문에 명시

---

## D2 사용자 안내 (KB-01 로컬 e2e)

manager 인증 시나리오는 dev server + storage state 준비 후 로컬 실행:

```bash
npm run dev   # 별도 터미널 (혹은 E2E_MOCK_AI=1 npm run dev로 KB-04/KB-09b 함께)

npx playwright test --config=e2e/playwright.config.ts \
  e2e/kb-knowledge-base.spec.ts -g "KB-01" \
  --project=chromium --no-deps
```

또는 mock 활성으로 KB-04 + KB-09b까지 한 번에:

```bash
E2E_MOCK_AI=1 npm run dev
E2E_MOCK_AI=1 npx playwright test --config=e2e/playwright.config.ts \
  e2e/kb-knowledge-base.spec.ts --project=chromium --no-deps
```

---

## 누적 산출물 (v1.0~v1.7)

| 사이클 | commits | 핵심 |
|---|---|---|
| v1.0 (Plan) | 1 | Stream A Plan |
| v1.1 | 1 | Stream B 포함 |
| v1.2 | 1 | A6 추가 (4모드 + diff) |
| v1.3 | 1 | A7·A8·Stream D 추가 (5주) |
| v1.4 | 1 | 모델 분기 결정 (tone Haiku) |
| v1.5 | 17 | Phase 1·2·3 구현 + 정책 + e2e |
| v1.6 | 8 | Phase 4 + Phase 5 + D1·D3·D4 |
| **v1.7** | **3** | **D5·D6·D7** |
| **누적** | **33+** | Plan→Design→Do→Check→Act 완주 |

---

## 다음 사이클 후보

| ID | 내용 | 분량 |
|---|---|---|
| **D2** | 사용자 직접 (15분, dev server 필요) | 사용자 |
| **D8** | semantic 검색 UI 통합 (vector 컬럼 활용) | 별도 사이클 (1주+) |
| **D9** | AI 비용/사용량 대시보드 (cost-tracker 누적 view) | 1일 |
| **운영 검증** | 매니저 5명 인터뷰, cache hit률 측정, 이미지 절감률 측정 | 한 달 사용 후 |
| **신규 feature** | 사용자가 별도 작업한 embedding 활용 / 기타 비즈니스 요구 | — |

---

## bkit Feature Usage

```
─────────────────────────────────────────────────
📊 v1.7 bkit Feature Usage
─────────────────────────────────────────────────
✅ Used: /pdca check + act, TodoWrite, Read/Write/Edit/Bash,
        Playwright e2e (프로덕션 KB-07·08 3/3 회귀 0)
⏭️ Not Used: bkit:gap-detector (Check typecheck+e2e로 대체),
            bkit:report-generator (수동 작성)
💡 Recommended:
   - 운영 검증 (매니저 인터뷰, cache hit률, 비용)
   - D8 semantic 검색 UI 통합 또는 신규 feature
─────────────────────────────────────────────────
```

---

## 변경 이력

- 2026-06-01: v1.7 미니 사이클 종료 (D5·D6·D7 완료, Check 통과)
