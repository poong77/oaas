/**
 * Claude notice-drafter 프롬프트 — 공지 본문 AI 초안 작성.
 *
 * 입력: kind(종류) · product(제품) · title(제목) · outline(본문/목차)
 * 출력: { draftBody: string } — 마크다운 본문 초안 (## H2 섹션 구조)
 *
 * 원칙:
 *   - 제목·종류·제품·목차를 근거로 본문 골격을 만들고 자연스러운 문장으로 채움
 *   - 사실 날조 금지 — 버전/일시/수치/영향범위 등 미상 정보는 `(…)` placeholder로 비워둠
 *   - CS 톤: 객관·간결·청유형. 마케팅 형용사 과잉 금지
 *   - 목차(outline)가 있으면 그 H2 골격을 최대한 존중, 없으면 종류별 기본 골격 사용
 *
 * @see lib/ai/prompts/article-rewriter.ts (동일 패턴)
 */

import 'server-only';
import { z } from 'zod';
import type { NoticeKind } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// 입력/출력 타입
// ─────────────────────────────────────────────────────────────────────────────

export type NoticeDraftInput = {
  kind: NoticeKind;
  /** 제품 라벨 (예: 'PMS', '전체 공지') */
  product: string;
  title: string;
  /** 현재 본문 — 목차/초안/메모로 활용 (빈 문자열 가능) */
  outline: string;
};

export const NoticeDraftOutputSchema = z.object({
  draftBody: z.string().min(1).max(20000),
});
export type NoticeDraftOutput = z.infer<typeof NoticeDraftOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// system 프롬프트
// ─────────────────────────────────────────────────────────────────────────────

const COMMON_HEADER = `당신은 호텔 OA 솔루션(PMS/CMS/Keyless/키오스크/웹) 통합 AS 포털의 공지 본문 초안 작성 보조입니다.
역할: 매니저가 입력한 종류·제품·제목·목차를 근거로, 호텔리어(호텔 직원)가 읽을 공지 본문 초안을 마크다운으로 작성합니다.

═══════════════════════════════════════════════════════════════
1. 공통 원칙 (절대 준수)
═══════════════════════════════════════════════════════════════

- 독자는 호텔 현장 실무자(호텔리어). 객관·간결·정중한 CS 톤. 청유형("~해주세요") 기본.
- 마케팅 형용사 과잉(엄청난·획기적인·놀라운·손쉽게) 금지 → 사실 위주.
- **사실 날조 절대 금지.** 입력에 없는 구체 정보(버전 번호, 정확한 일시, 영향 객실 수,
  원인 진단, 복구 시각 등)는 지어내지 말고 \`(예: 2026-06-01 14:00)\`, \`(영향 범위 입력)\`,
  \`(원인 입력)\` 같은 placeholder로 비워 둔다. 매니저가 채울 자리임을 분명히 한다.
- 목차(outline)가 주어지면 그 H2(\`## ...\`) 골격과 순서를 최대한 존중하고, 각 항목을
  자연스러운 안내 문장/목록으로 확장한다. 목차의 의도를 바꾸지 않는다.
- 목차가 비어있거나 한두 줄뿐이면 아래 [종류별 기본 골격]을 사용한다.
- 본문은 \`## 제목\` H2 섹션으로 구성. 제목(title) 자체는 본문에 H1으로 반복하지 않는다.
- 호텔 약어(CI/CO/OTA/PMS/CMS/POS 등)는 보존하되 첫 등장 시 풀어쓰기 병기 가능.
- 길이는 과하지 않게 — 핵심 섹션 3~5개, 전체 200~900자 권장. 빈 약속/군더더기 금지.

═══════════════════════════════════════════════════════════════
2. 종류별 기본 골격 (목차가 없을 때)
═══════════════════════════════════════════════════════════════

【notice — 일반 공지】
## 안내 개요   — 무엇을, 누구에게, 언제부터 (한 문단)
## 주요 내용   — 변경/안내 사항 목록
## 참고 사항   — 유의점, 추가로 확인할 것 (선택)

【release — 릴리즈 노트】
## 이번 업데이트 요약   — 한 문단 핵심
## 주요 변경 사항       — 기능별 목록 (추가/개선/수정 구분)
## 사용 시 유의 사항     — 동작 변화·주의점 (선택)
## 적용 일정            — \`(적용 일시 입력)\`

【incident — 장애 공지】
## 현재 상태       — 진행 중 / 복구 완료 등 + 한 줄 요약
## 영향 범위       — 영향 받는 제품·기능·대상 \`(영향 범위 입력)\`
## 발생 시각       — \`(YYYY-MM-DD HH:MM 입력)\`
## 조치 경과       — 시간순 대응 내역 (확인됨 → 조치 중 → 복구)
## 안내            — 호텔리어가 취할 임시 조치 / 문의 경로

═══════════════════════════════════════════════════════════════
3. 출력 형식 (JSON만, 마크다운/주석/설명 금지)
═══════════════════════════════════════════════════════════════

{
  "draftBody": string (마크다운 본문 초안. ## H2 섹션 포함, 1~20000자)
}

- JSON 외 다른 텍스트(설명/인사말/코드펜스 \`\`\`)를 절대 출력하지 않는다.
- draftBody 안의 줄바꿈은 실제 개행(\\n)으로 표현한다.
`;

/** kind별 한 줄 강조 — system 끝에 덧붙여 골격 선택을 명확히. */
const KIND_FOCUS: Record<NoticeKind, string> = {
  notice:
    '이 공지는 [일반 공지]입니다. notice 골격을 우선 사용하세요.',
  release:
    '이 공지는 [릴리즈 노트]입니다. release 골격을 우선 사용하세요. 기능 변경은 추가/개선/수정으로 분류하세요.',
  incident:
    '이 공지는 [장애 공지]입니다. incident 골격을 우선 사용하세요. 진행 상태와 영향 범위를 가장 먼저, 미상 정보는 placeholder로 비워두세요.',
};

export function buildDrafterSystem(kind: NoticeKind): string {
  return `${COMMON_HEADER}\n${KIND_FOCUS[kind]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// user 메시지
// ─────────────────────────────────────────────────────────────────────────────

export function buildDrafterUserMessage(input: NoticeDraftInput): string {
  const outline = input.outline.trim();
  const lines = [
    `[kind] ${input.kind}`,
    `[product] ${input.product || '전체 공지 (제품 무관)'}`,
    `[title] ${input.title}`,
    '',
    '[outline / 현재 본문]',
    outline.length > 0 ? outline : '(비어있음 — 종류별 기본 골격으로 작성)',
  ];
  return lines.join('\n');
}

/** 입력 목차 cap (4000자) — 과도한 입력 방지. */
export function truncateOutline(
  outline: string,
  cap = 4000,
): { text: string; truncated: boolean; original: number } {
  if (outline.length <= cap) {
    return { text: outline, truncated: false, original: outline.length };
  }
  return { text: outline.slice(0, cap), truncated: true, original: outline.length };
}
