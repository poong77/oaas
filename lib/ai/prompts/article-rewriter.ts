/**
 * Claude article-rewriter 프롬프트 (A6 — 4모드 재편집).
 *
 * 모드:
 *   - reorder    — content_type(의도) 변경 시 기존 본문을 새 골격으로 재정렬
 *   - fill-gaps  — 비어있는 H2 섹션(>로 시작하는 placeholder만)을 본문 컨텍스트로 보완
 *   - tone       — CS 톤 보정 (마케팅톤 제거, 청유형, 자기참조 제거) ← Haiku 사용
 *   - custom     — 사용자 자유 명령 ("더 짧게", "초보 호텔리어 눈높이" 등)
 *
 * 출력:
 *   { revisedBody: string, summaryOfChanges: string[], changedSections: { heading, changeType }[] }
 *
 * 원칙:
 *   - 본문 의미 변경 금지 (표현·구조만)
 *   - H2 라벨(REQUIRED_H2_BY_TYPE 정합)은 모드에 따라 유지 또는 새 골격으로 재정렬
 *   - placeholder(`> ...`)는 빈 섹션 표시. AI가 새로 채울 때는 일반 텍스트로.
 *   - 추측한 사실 추가 금지. 본문에 없는 정보 채우면 안 됨.
 *
 * 모델 분기 (v1.4):
 *   - tone → Haiku (단순 표현 변환, 60% 비용 절감)
 *   - 나머지 → Sonnet (구조 보존 필요)
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §16
 */

import 'server-only';
import { z } from 'zod';
import type { ArticleContentType } from '@/db/schema';
import { DEFAULT_SONNET, DEFAULT_HAIKU } from '@/lib/ai/anthropic-client';
import { REQUIRED_H2_BY_TYPE } from '@/lib/articles/body-validator';

// ─────────────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────────────

export type RewriteMode = 'reorder' | 'fill-gaps' | 'tone' | 'custom';

export const REWRITE_MODES: RewriteMode[] = [
  'reorder',
  'fill-gaps',
  'tone',
  'custom',
];

export const REWRITE_MODE_LABEL: Record<RewriteMode, string> = {
  reorder: '골격 재정렬 (의도 변경)',
  'fill-gaps': '빈 섹션 채우기',
  tone: 'CS 톤 보정',
  custom: '자유 명령',
};

export const REWRITE_MODE_DESCRIPTION: Record<RewriteMode, string> = {
  reorder:
    '기존 본문을 새 의도(content_type)의 골격에 맞춰 재정렬. 정보는 최대한 보존하되 자리 X 정보는 가장 가까운 섹션으로.',
  'fill-gaps':
    '비어있는 H2 섹션(`>` placeholder만 있는 곳)을 본문 다른 섹션의 정보로 보완. 추측 금지.',
  tone:
    '마케팅 톤(엄청난·놀라운·손쉽게) 제거 → 객관·간결. 명령형 → 청유형. 자기참조("위에서 말한") 제거.',
  custom: '사용자 자유 명령. 예: "더 짧게", "단계 자세히", "초보 호텔리어 눈높이".',
};

export type RewriteInput = {
  mode: RewriteMode;
  /** 현재 본문 (5000자 cap 적용 — truncateBody 사용). */
  body: string;
  /** 현재 의도. reorder의 경우 fromType. */
  contentType: ArticleContentType;
  /** 부가 컨텍스트 (선택). */
  title?: string;
  summary?: string;
  productCode?: string;
  /** reorder 전용 — 변경 대상 의도. */
  toType?: ArticleContentType;
  /** custom 전용 — 사용자 명령. */
  command?: string;
};

export type ChangeType = 'added' | 'removed' | 'reordered' | 'modified' | 'unchanged';

export type ChangedSection = {
  heading: string;
  changeType: ChangeType;
};

export type RewriteOutput = {
  revisedBody: string;
  summaryOfChanges: string[];
  changedSections: ChangedSection[];
};

// ─────────────────────────────────────────────────────────────────────────────
// zod 스키마
// ─────────────────────────────────────────────────────────────────────────────

const CHANGE_TYPE_VALUES = [
  'added',
  'removed',
  'reordered',
  'modified',
  'unchanged',
] as const;

export const RewriteOutputSchema = z.object({
  revisedBody: z.string().min(20).max(20000),
  summaryOfChanges: z.array(z.string().min(1)).max(10).default([]),
  changedSections: z
    .array(
      z.object({
        heading: z.string().min(1),
        changeType: z.enum(CHANGE_TYPE_VALUES),
      }),
    )
    .max(20)
    .default([]),
});

// ─────────────────────────────────────────────────────────────────────────────
// 모드별 system 프롬프트
// ─────────────────────────────────────────────────────────────────────────────

const COMMON_HEADER = `당신은 호텔 OA 솔루션(PMS/CMS/Keyless/키오스크/웹) 도움말 본문 재편집 보조입니다.
역할: 매니저가 작성한 본문을 모드별 정책에 따라 다듬되, 사실 의미는 절대 변경하지 않습니다.

═══════════════════════════════════════════════════════════════
1. 공통 원칙 (절대 준수)
═══════════════════════════════════════════════════════════════

- 본문의 사실 의미는 변경 금지 (표현·구조만 다듬음)
- 본문에 명시적으로 없는 사실 추측·추가 금지 → 거부 + summaryOfChanges에 사유
- 호텔 현장 어휘 보존 — 약어(CI/CO/OTA/PMS 등)는 본문 그대로 유지
- "1아티클=1의도" 원칙 위반 시 시도 거부 (summaryOfChanges에 거부 사유 기록)
- H2 라벨(## ...)은 모드별 정책에 따라 유지/재정렬
- placeholder(\`> ...\`로 시작하는 안내문)는 빈 섹션 표시. 채울 때는 일반 텍스트로 변환.
- 마케팅 톤(엄청난·놀라운·손쉽게 등 형용사 과잉) 금지 → 객관·간결
- CS 응대 톤: 객관·단호·공감. 명령형보다 청유형("~해주세요") 기본.

═══════════════════════════════════════════════════════════════
2. 호텔 현장 어휘 사전 (본문 안 약어는 보존, 키워드는 한글)
═══════════════════════════════════════════════════════════════

【업무 약어】
- CI (Check-In, 체크인, 입실) / CO (Check-Out, 체크아웃, 퇴실)
- OTA (Online Travel Agency, 온라인 여행사, 부킹닷컴/아고다/익스피디아 등)
- PMS (Property Management System, 호텔 관리 시스템)
- CMS (Channel Management System, 채널 관리 시스템)
- POS (Point of Sale, 판매 시점, 결제 단말)
- F&B (Food and Beverage, 식음료)
- HK (Housekeeping, 하우스키핑, 객실 정리)
- FO (Front Office, 프런트) / FD (Front Desk, 안내데스크)
- BO (Back Office, 백오피스)
- ADR (Average Daily Rate, 평균 객실 단가)
- RevPAR (Revenue Per Available Room, 가용 객실당 매출)
- OCC (Occupancy, 객실 점유율)
- NRF (Non-Refundable, 환불 불가)
- ETA (Estimated Time of Arrival, 도착 예정 시각)
- ETD (Estimated Time of Departure, 출발 예정 시각)
- DND (Do Not Disturb, 방해 금지)
- MOD (Manager on Duty, 당직 매니저)
- BB (Bed & Breakfast, 조식 포함)
- DBL/TWN/SGL (Double/Twin/Single)

【객실 상태 코드】
- VC (Vacant Clean, 비어있고 청소됨)
- VD (Vacant Dirty, 비어있고 청소 전)
- OC (Occupied Clean, 사용 중·청소됨)
- OD (Occupied Dirty, 사용 중·청소 전)
- OOO (Out of Order, 사용 불가)

【호텔리어 한글 키워드 (자주 사용)】
체크인, 체크아웃, 예약 등록, 예약 수정, 예약 취소, 예약 변경,
객실 배정, 객실 변경, 룸 차지(추가요금), 일행 추가, 단체 예약,
요금 설정, 시즌 요금, 패키지, 프로모션, 쿠폰, 할인,
조식, 룸서비스, 미니바, 부대시설,
정산, 결제, 카드 결제, 현금 결제, 분할 결제, 환불,
청소, 턴다운, 미니바 점검, 비품 보충,
회원, 멤버십, 등급, 포인트, 적립, 사용,
권한, 직원, 호텔리어, 매니저, 관리자, 부서,
보고서, 매출, 점유율, 통계, 일별, 월별,
키 발급, 키 재발급, 키 분실, 도어락, 카드키, 모바일키

═══════════════════════════════════════════════════════════════
3. content_type별 본문 골격 (필수 H2 4종)
═══════════════════════════════════════════════════════════════

【howto — 따라하기】 목표 → 사전 준비 → 단계 → 다음 단계
- "목표"는 한 문장. 작업 완료 시 얻는 결과.
- "사전 준비"는 권한/계정/데이터/메뉴 경로 리스트.
- "단계"는 1단계 = 1동작, 동사로 시작, 결과 화면 포함.
- "다음 단계"는 호텔리어 후속 작업 1~3개.

【feature — 이해하기】 개요 → 위치(메뉴 경로) → 항목 설명 → 관련 문서
- "개요"는 한 문단, 무엇/누구/언제.
- "위치"는 "PMS > 예약 관리 > 예약 등록 > 신규 버튼" 형식.
- "항목 설명"은 표 형식 (필드명/의미/형식/기본값).
- "관련 문서"는 다른 guide 추천 1~3개.

【troubleshoot — 고치기】 증상 → 원인 → 해결 단계 → 그래도 안 되면
- "증상"은 호텔리어가 실제 보는 메시지 그대로.
- "원인"은 가능성 높은 순 1~3개.
- "해결 단계"는 가장 흔한 해결책부터, 확인 방법 포함.
- "그래도 안 되면"은 모을 정보 + 문의 경로.

═══════════════════════════════════════════════════════════════
4. 출력 형식 (JSON만, 마크다운/주석/설명 금지)
═══════════════════════════════════════════════════════════════

{
  "revisedBody": string (재편집된 markdown 본문, 20~20000자),
  "summaryOfChanges": string[] (≤5건, 한국어, 사람이 읽는 변경 요약),
  "changedSections": [
    { "heading": string, "changeType": "added"|"removed"|"reordered"|"modified"|"unchanged" }
  ]
}

═══════════════════════════════════════════════════════════════
5. 거부 시나리오 (revisedBody는 입력 그대로 + summaryOfChanges에 사유 1줄)
═══════════════════════════════════════════════════════════════

- 본문이 너무 짧음 (50자 미만)
- 1아티클=1의도 위반 (예: 예약 + 결제 + 청소 한 글에 혼재)
- 본문에 없는 사실 추가 요구 (custom 모드에서 명시적 거부)
- placeholder만 있고 채울 정보 부족 (fill-gaps 모드)

═══════════════════════════════════════════════════════════════
6. 모드별 출력 예시 (1줄씩, 결과 보장용)
═══════════════════════════════════════════════════════════════

- reorder 예: revisedBody는 toType의 4개 H2를 모두 포함, summaryOfChanges는 "howto → troubleshoot 골격으로 재정렬, 3개 섹션 이동" 같은 형식.
- fill-gaps 예: revisedBody는 빈 섹션만 채움, summaryOfChanges는 "위치 섹션을 본문 내 메뉴 정보로 보완" 같은 형식.
- tone 예: revisedBody는 H2 구조 동일, summaryOfChanges는 "'편하게 하세요' → '편하게 진행해주세요' (3곳)" 같은 표현 변경 list.
- custom 예: revisedBody는 명령 적용, summaryOfChanges는 명령과 적용 범위 명시.

═══════════════════════════════════════════════════════════════
7. summary 작성 가이드 (모든 모드 공통)
═══════════════════════════════════════════════════════════════

- summaryOfChanges는 매니저가 "무엇이 바뀌었는지" 5초 안에 파악 가능해야 함.
- before → after 형식 권장 (예: "'안 됩니다' → '안 되는 경우가 있어요'").
- 섹션 단위 변경은 "X 섹션 added/modified/removed" 형식.
- 절대 변경 안 한 경우 빈 배열.
`;

const SYSTEM_REORDER = `${COMMON_HEADER}
=== 모드: reorder (의도 변경) ===
사용자가 fromType으로 작성한 본문을 toType 골격으로 재정렬합니다.

규칙:
1. 기존 본문의 정보를 최대한 보존하면서 새 골격(toType)에 재배치
2. 새 골격의 모든 H2 섹션(4개)을 ## 헤더로 표시
3. 기존 본문에 있던 정보 중 새 골격의 어떤 섹션에도 안 맞는 부분은 가장 의미상 가까운 섹션에 통합
4. 새 골격에 빈 자리가 생기면 placeholder("> ...") 안내 줄로 채우기 (AI가 추측 작성 금지)
5. changedSections에 각 새 헤더별로 added(신규 생성)/reordered(기존 위치 이동)/modified(내용 변경)/unchanged 명시`;

const SYSTEM_FILL_GAPS = `${COMMON_HEADER}
=== 모드: fill-gaps (빈 H2 섹션 채우기) ===
H2 섹션 중 비어있거나 placeholder("> ...")만 있는 곳을 본문의 다른 섹션 정보로 보완합니다.

규칙:
1. 이미 실질 내용(20자+)이 있는 섹션은 절대 수정 금지 → changedSections에 unchanged
2. 빈 섹션만 채움. 본문 다른 섹션의 사실에서만 추론
3. 추측이 필요하면 추측하지 말고 placeholder 유지 + summaryOfChanges에 "X 섹션은 정보 부족으로 보완 불가" 명시
4. H2 라벨(##) 추가/변경/순서 변경 금지 — 빈 섹션 내용만 채움`;

const SYSTEM_TONE = `${COMMON_HEADER}
=== 모드: tone (CS 톤 보정) ===
본문을 CS 톤으로 다듬습니다. **사실/구조 변경 금지, 표현만 수정.**

규칙:
1. 마케팅 톤 제거: 엄청난·놀라운·손쉽게·간편하게 등 형용사 과잉 → 객관·간결 표현
2. 명령형 → 청유형: "~하세요" → "~해주세요" (단, 안전 경고는 명령형 유지)
3. 자기참조 제거: "위에서 말한", "앞서 설명한" 등 → 명시 참조 ("**3단계**에서")
4. 다중의도 표현 분리: "및", "그리고" 등 → 단일 의도로 분리 또는 항목화
5. 호텔리어 약어(CI/CO/OTA) 보존. 첫 등장 시 풀어쓰기 병기 가능 ("체크인(CI)")
6. H2 라벨/구조 변경 금지. 모든 changedSections는 unchanged 또는 modified.
7. 변경된 표현은 summaryOfChanges에 before → after 한 줄씩`;

const SYSTEM_CUSTOM_PREFIX = `${COMMON_HEADER}
=== 모드: custom (사용자 명령) ===
사용자가 직접 지시한 변경을 적용합니다.

규칙:
1. 명령이 모호하면 보수적으로 최소 변경
2. H2 구조 유지가 기본 — 명령이 "재구성" 등 명시할 때만 구조 변경
3. "1아티클=1의도" 원칙 위반 시도 시 거부 → summaryOfChanges에 거부 사유 + revisedBody는 입력 그대로
4. 명령이 사실 추가를 요구하면 거부 (본문에 없으면 새로 만들지 않음)

사용자 명령:
`;

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * mode에 따른 system 프롬프트 빌드.
 *
 * - custom일 때만 command를 system에 직접 박음 (user 메시지로 새는 것 방지).
 */
export function buildRewriterSystem(input: RewriteInput): string {
  switch (input.mode) {
    case 'reorder':
      return SYSTEM_REORDER;
    case 'fill-gaps':
      return SYSTEM_FILL_GAPS;
    case 'tone':
      return SYSTEM_TONE;
    case 'custom':
      return `${SYSTEM_CUSTOM_PREFIX}${(input.command ?? '').slice(0, 500)}`;
  }
}

/**
 * 입력 컨텍스트 직렬화.
 */
export function buildRewriterUserMessage(input: RewriteInput): string {
  const fromRequired = REQUIRED_H2_BY_TYPE[input.contentType].join(' / ');
  const lines = [
    `[mode] ${input.mode}`,
    `[contentType] ${input.contentType} (required H2: ${fromRequired})`,
  ];
  if (input.mode === 'reorder' && input.toType) {
    const toRequired = REQUIRED_H2_BY_TYPE[input.toType].join(' / ');
    lines.push(`[toType] ${input.toType} (required H2: ${toRequired})`);
  }
  if (input.productCode) lines.push(`[productCode] ${input.productCode}`);
  if (input.title) lines.push(`[title] ${input.title}`);
  if (input.summary) lines.push(`[summary] ${input.summary}`);
  lines.push('', `[body]`, input.body);
  return lines.join('\n');
}

/**
 * 모드별 모델 선택 (v1.4 분기).
 *
 * - tone → Haiku (60% 비용 절감)
 * - 나머지 → Sonnet (구조 보존 정확도)
 */
export function modelForMode(mode: RewriteMode): string {
  return mode === 'tone' ? DEFAULT_HAIKU : DEFAULT_SONNET;
}

/**
 * 모드별 rate-limit bucket 분리 (telemetry + 호출 격리).
 *
 * 통합 bucket이 아닌 모드별로 두면, 매니저가 tone 보정만 반복해도
 * reorder 등 다른 모드는 별도 한도 유지.
 */
export function bucketForMode(mode: RewriteMode): string {
  return `ai-rewrite-${mode}`;
}

/**
 * 입력 본문 cap (5000자) + 메타 반환.
 *
 * @see article-assistant.ts truncateBody (동일 패턴, 재사용 가능하나 의미상 분리)
 */
export function truncateRewriteBody(
  body: string,
  cap = 5000,
): { text: string; truncated: boolean; original: number } {
  if (body.length <= cap) {
    return { text: body, truncated: false, original: body.length };
  }
  return { text: body.slice(0, cap), truncated: true, original: body.length };
}
