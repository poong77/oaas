/**
 * content_type별 본문 골격 + placeholder.
 *
 * knowledge-base-overhaul Phase 1 (A1):
 *   - 매니저가 의도 카드 클릭 → 본문 골격 자동 주입
 *   - 골격은 H2 4개 + placeholder blockquote ("> ...")
 *   - placeholder는 발행 시 그대로 두면 워닝(extractBodyOutline.hasContent=false)
 *
 * 원칙 [AS][CS]:
 *   - 매니저가 "빈 페이지 공포" 없이 시작
 *   - 필수 H2를 골격에 미리 포함 → body-validator REQUIRED_H2_BY_TYPE와 동기
 *   - placeholder 톤: 청유형("~ 적어주세요"), CS 톤 가이드 포함
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §6
 */

import type { ArticleContentType } from '@/db/schema';

export type TemplateHeading = {
  level: 2 | 3;
  text: string;
  placeholder: string;
  required: boolean;
};

export type ArticleTemplate = {
  contentType: ArticleContentType;
  outline: TemplateHeading[];
  bodyMarkdown: string;
  hoverPreview: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// 골격 정의 (DESIGN §6 — AS 팀 초안)
// ─────────────────────────────────────────────────────────────────────────────

const HOWTO: ArticleTemplate = {
  contentType: 'howto',
  hoverPreview:
    '따라하기 가이드 — 목표 → 사전 준비 → 단계 → 다음 단계. 5분 이내 동작형 작업에 적합.',
  outline: [
    { level: 2, text: '목표', placeholder: '이 작업을 마쳤을 때 얻는 결과를 한 문장으로 적어주세요.', required: true },
    { level: 2, text: '사전 준비', placeholder: '필요한 권한·계정·데이터·메뉴 경로를 항목으로 적어주세요.', required: true },
    { level: 2, text: '단계', placeholder: '한 단계 = 한 동작 원칙. 동사로 시작하고 결과 화면까지 포함해주세요.', required: true },
    { level: 2, text: '다음 단계', placeholder: '작업 후 호텔리어가 자주 묻는 후속 작업을 1~3개 적어주세요.', required: true },
  ],
  bodyMarkdown: `## 목표

> 이 작업을 마쳤을 때 얻는 결과를 한 문장으로 적어주세요. (예: 신규 예약을 5분 안에 등록하고 객실 배정까지 완료한다.)

## 사전 준비

> - 필요한 권한/계정/데이터를 항목으로 적어주세요.
> - 미리 확인할 메뉴 경로를 함께 적어주세요.

## 단계

> 1. **첫 번째 단계** — 동사로 시작. 화면 캡처가 있으면 함께.
> 2. **두 번째 단계** — 한 단계 = 한 동작.
> 3. **세 번째 단계** — 결과 화면을 보여주는 것까지가 한 단계.

## 다음 단계

> 작업 후 호텔리어가 자주 묻는 후속 작업을 1~3개 적어주세요. (예: 등록한 예약에 결제 정보 추가하기)
`,
};

const FEATURE: ArticleTemplate = {
  contentType: 'feature',
  hoverPreview:
    '기능 설명 — 개요 → 위치(메뉴 경로) → 항목 설명 → 관련 문서. 화면·필드 reference 용도.',
  outline: [
    { level: 2, text: '개요', placeholder: '이 기능이 무엇을 하는지, 어떤 호텔리어가 언제 쓰는지 한 문단.', required: true },
    { level: 2, text: '위치(메뉴 경로)', placeholder: '예: PMS > 예약 관리 > 예약 등록 > "신규" 버튼', required: true },
    { level: 2, text: '항목 설명', placeholder: '필드별 의미·형식·기본값을 표 형태로 적어주세요.', required: true },
    { level: 2, text: '관련 문서', placeholder: '관련 가이드 1~3개를 자동 추천에서 선택하거나 직접 입력하세요.', required: true },
  ],
  bodyMarkdown: `## 개요

> 이 기능이 무엇을 하는지, 어떤 호텔리어가 언제 쓰는지 한 문단으로 적어주세요.

## 위치(메뉴 경로)

> 예: PMS > 예약 관리 > 예약 등록 > "신규" 버튼

## 항목 설명

| 항목 | 설명 |
|---|---|
| (필드명) | (이 필드가 무엇을 의미하는지, 어떤 형식인지, 기본값) |
| (필드명) | … |

## 관련 문서

> 관련 가이드 1~3개를 자동 추천에서 선택하거나 직접 입력하세요.
`,
};

const TROUBLESHOOT: ArticleTemplate = {
  contentType: 'troubleshoot',
  hoverPreview:
    '문제 해결 — 증상 → 원인 → 해결 단계 → 그래도 안 되면. 5W1H 기반.',
  outline: [
    { level: 2, text: '증상', placeholder: '호텔리어가 실제로 보는 증상을 그대로.', required: true },
    { level: 2, text: '원인', placeholder: '가능한 원인을 가능성 높은 순으로 1~3개.', required: true },
    { level: 2, text: '해결 단계', placeholder: '가장 흔한 해결책부터 → 안 될 때 시도 → 확인 방법.', required: true },
    { level: 2, text: '그래도 안 되면', placeholder: '어떤 정보를 모아서 어디로 문의해야 하는지 정확히.', required: true },
  ],
  bodyMarkdown: `## 증상

> 호텔리어가 실제로 보는 증상을 그대로 적어주세요. (예: 카드 결제 시 "승인 거절" 메시지가 뜬다)

## 원인

> 가능한 원인을 가능성 높은 순으로 1~3개 적어주세요.

## 해결 단계

> 1. **첫 번째 시도** — 가장 흔한 해결책부터.
> 2. **두 번째 시도** — 첫 번째로 해결 안 될 때.
> 3. **확인 사항** — 해결되었는지 확인하는 방법.

## 그래도 안 되면

> - 어떤 정보를 모아서 어디로 문의해야 하는지 정확히 적어주세요.
> - 관련 솔루션 링크/연락처를 추천 마스터에서 선택할 수 있어요.
`,
};

const TEMPLATES: Record<ArticleContentType, ArticleTemplate> = {
  howto: HOWTO,
  feature: FEATURE,
  troubleshoot: TROUBLESHOOT,
};

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

export function getArticleTemplate(contentType: ArticleContentType): ArticleTemplate {
  return TEMPLATES[contentType];
}

export function getTemplateBody(contentType: ArticleContentType): string {
  return TEMPLATES[contentType].bodyMarkdown;
}

export function getTemplateOutline(contentType: ArticleContentType): TemplateHeading[] {
  return TEMPLATES[contentType].outline;
}

export function getTemplateHoverPreview(contentType: ArticleContentType): string {
  return TEMPLATES[contentType].hoverPreview;
}

export const ARTICLE_CONTENT_TYPES: ArticleContentType[] = ['howto', 'feature', 'troubleshoot'];
