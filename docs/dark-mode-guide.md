# 다크모드 일관 적용 가이드 — 표준 매핑표

> 이 프로젝트는 **클래스마다 `dark:` 짝을 직접 다는** 컨벤션을 쓴다(shadcn 시맨틱 토큰 미사용).
> "일관성" = 라이트 색상 유틸마다 대응하는 `dark:` 변형을 빠짐없이 다는 것.
> 아래 매핑은 **현 코드베이스에서 실제로 가장 많이 쓰인 짝**을 실측해 확정한 표준이다.
> 신규 코드·변환 작업 모두 이 표를 따른다.

## 1. 표면(배경) — surface

| 라이트 | 다크 (표준) | 용도 |
|--------|------------|------|
| `bg-white` | `dark:bg-slate-900` | 카드·패널·모달 본문 (최상위 body는 `dark:bg-slate-950`) |
| `bg-slate-50` | `dark:bg-slate-900` | 옅은 섹션 배경·테이블 헤더 (강조 시 `dark:bg-slate-800/50`) |
| `bg-slate-100` | `dark:bg-slate-800` | 코드칩·뱃지·hover 면 |
| `bg-slate-200` | `dark:bg-slate-800` | 구분 띠·비활성 트랙 (진하게 `dark:bg-slate-700`) |

## 2. 텍스트 — foreground

| 라이트 | 다크 (표준) | 용도 |
|--------|------------|------|
| `text-slate-900` | `dark:text-slate-100` | 제목·본문 강조 |
| `text-slate-800` | `dark:text-slate-200` | 본문 |
| `text-slate-700` | `dark:text-slate-200` | 본문·라벨 |
| `text-slate-600` | `dark:text-slate-300` | 보조 본문 |
| `text-slate-500` | `dark:text-slate-400` | muted·설명·placeholder성 |
| `text-slate-400` | `dark:text-slate-500` | 아이콘 흐림·비활성 |
| `text-white` | (변환 안 함) | 컬러 버튼 위 흰 글자는 다크에서도 유지 |

## 3. 테두리 — border

| 라이트 | 다크 (표준) | 용도 |
|--------|------------|------|
| `border-slate-100` | `dark:border-slate-800` | 옅은 구분선 |
| `border-slate-200` | `dark:border-slate-700` | 기본 카드·인풋 테두리 (가장 흔함) |
| `border-slate-300` | `dark:border-slate-700` | 인풋·버튼 테두리 (진하게 `dark:border-slate-600`) |

## 4. 의미 색상(상태 틴트) — tint

> 패턴: 옅은 배경 `bg-{c}-50` + 진한 글자 `text-{c}-700`. 다크는 어두운 배경 + 밝은 글자로 반전.

| 라이트 | 다크 (표준) |
|--------|------------|
| `bg-{red,amber,green,emerald,blue,sky,violet}-50` | `dark:bg-{c}-950/40` |
| `bg-{c}-100` | `dark:bg-{c}-900/40` |
| `text-{c}-700` / `text-{c}-600` | `dark:text-{c}-300` / `dark:text-{c}-400` |
| `border-{c}-200` | `dark:border-{c}-800` |

대표 예) 성공=green/emerald, 경고=amber, 위험=red, 정보=blue/sky, 릴리즈=violet.

## 5. 변환 안 하는 것 (제외 규칙)

- `bg-brand-*`, `text-brand-*` 등 **brand-* 토큰** — globals.css가 모드별로 자동 처리(현재 단일 그린 통일).
- `text-white`, `text-black` — 컬러 면 위 글자. 문맥상 라이트 배경 위면 개별 판단.
- 임의값 hex `bg-[#1A1C20]` 등 — **landing 시안 전용**, 별도 페이즈에서 토큰화 후 처리.
- 이미 같은 요소에 `dark:` 짝이 있는 클래스 — 중복 추가 금지.
- 레이아웃·간격·크기 클래스(`p-`, `flex`, `grid`, `rounded-` 등) — 색상 아님, 손대지 않음.

## 6. 적용 범위 (1차: 본문 앱)

- **대상**: `app/**`(landing 제외) + `components/**` 중 라이트 색상에 `dark:` 짝이 빠진 137개 파일.
- **landing/ 시안**(hex 641개)은 토큰화 선행 필요 → 2차 페이즈.
- 진행 체크리스트는 이 문서 하단 `## 7` 또는 작업 보고서(`docs/dev-logs/`)에서 관리.

## 7. 우선순위 배치

1. **공유 UI 프리미티브** `components/ui/*` — input·select·textarea·checkbox·switch·sheet·choice-card·combobox (전파 효과 최대)
2. **레이아웃·공통** components/layout·contact·chatbot·faqs·articles·notices·tickets·editor
3. **본문 앱 페이지** app/(admin)·(user)·(auth)·help·notices·tickets·troubleshoot·search·status·faq·role
