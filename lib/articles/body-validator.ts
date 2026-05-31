/**
 * 본문 검증기 — content_type별 필수 H2 + 자기완결 본문.
 *
 * 결정사항 (Plan Q-9, Q-10):
 *   - errors: published 차단 (draft 저장은 허용)
 *   - warnings: 저장 허용, UI 표시만
 *
 * H2 매칭 규칙: 괄호 부분 무시 (예: "위치(메뉴 경로)" → "위치"만 비교).
 *
 * @see docs/02-design/features/아티클관리시스템.design.md §6.2
 */

import type { ArticleContentType } from '@/db/schema';

/** content_type별 필수 H2 — 발행 차단 + 본문 골격(templates.ts)과 동기. */
export const REQUIRED_H2_BY_TYPE: Record<ArticleContentType, string[]> = {
  howto: ['목표', '사전 준비', '단계', '다음 단계'],
  feature: ['개요', '위치(메뉴 경로)', '항목 설명', '관련 문서'],
  troubleshoot: ['증상', '원인', '해결 단계', '그래도 안 되면'],
};

const NON_SELF_CONTAINED_PHRASES = [
  '위에서 말한',
  '앞서 설명한',
  '위에서 본',
  '앞에 나온',
] as const;

const TITLE_MULTI_INTENT_PATTERNS = [
  /\s및\s/,
  /\s+그리고\s+/,
  /,/,
  /\sand\s/i,
  /\s\+\s/,
];

export type ValidationResult = {
  /** published 전환 차단 사유 */
  errors: string[];
  /** UI에 표시만, 저장은 허용 */
  warnings: string[];
};

export function validateBody(
  bodyMarkdown: string,
  contentType: ArticleContentType,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // H2 추출 — Tiptap Option A로 본문이 markdown+inline HTML이어도 ## 라인은 markdown 그대로
  const h2Headings = [...bodyMarkdown.matchAll(/^##\s+(.+)$/gm)].map((m) =>
    m[1]!.trim(),
  );

  const required = REQUIRED_H2_BY_TYPE[contentType];
  for (const req of required) {
    // 괄호 부분 제거 — "위치(메뉴 경로)" → "위치"
    const core = req.split('(')[0]!.trim();
    if (!h2Headings.some((h) => h.includes(core))) {
      errors.push(`필수 H2 누락: "${req}"`);
    }
  }

  for (const phrase of NON_SELF_CONTAINED_PHRASES) {
    if (bodyMarkdown.includes(phrase)) {
      warnings.push(
        `자기완결 본문 위반: "${phrase}" — RAG 청크 독립 노출 원칙 위반`,
      );
    }
  }

  return { errors, warnings };
}

/** title 다중 의도 의심 — 별도 워닝. */
export function validateTitle(title: string): { warnings: string[] } {
  const warnings: string[] = [];
  for (const pat of TITLE_MULTI_INTENT_PATTERNS) {
    if (pat.test(title)) {
      warnings.push(
        `제목에 여러 작업이 묶인 듯합니다 — 한 글 = 한 의도 원칙 권장`,
      );
      break;
    }
  }
  return { warnings };
}

/** summary 권장 길이 워닝 (D-4: 2000자 hard, 200자 권장 워닝). */
export function validateSummary(summary: string | null | undefined): {
  warnings: string[];
} {
  const warnings: string[] = [];
  if (summary && summary.length > 200) {
    warnings.push(
      `요약 200자 권장 (현재 ${summary.length}자) — 검색 결과 노출 영역에 잘릴 수 있습니다`,
    );
  }
  return warnings.length > 0 ? { warnings } : { warnings: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// knowledge-base-overhaul Phase 1 (A1) — H2 진척률 + 골격 감지
// ─────────────────────────────────────────────────────────────────────────────

export type BodyOutlineItem = {
  /** 필수 H2 라벨 (예: "목표", "위치(메뉴 경로)") */
  text: string;
  /** 본문에 등장 여부 */
  present: boolean;
  /** H2 다음에 실질적 본문(20자+, placeholder/blockquote 제외)이 있는가 */
  hasContent: boolean;
};

export type BodyOutline = {
  /** REQUIRED_H2_BY_TYPE.length */
  totalRequired: number;
  /** 본문에 등장한 필수 H2 수 (= items 중 present:true 개수) */
  presentRequired: number;
  /** items 중 hasContent:true 개수 (체크리스트 ✓ 기준) */
  completedRequired: number;
  /** 각 필수 H2 항목 상태 */
  items: BodyOutlineItem[];
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * H2 다음 본문 영역에 실질적 텍스트가 있는지 (20자+, blockquote/공백 제거).
 *
 * 골격(>로 시작하는 placeholder)만 있으면 false.
 *
 * 정규식 주의: JavaScript는 `\z`(EOF) 미지원 → lookahead `(?=\n##\s|$)`로 대체.
 *              `(?:^|\n)`으로 H2 라인 시작 매칭 (멀티라인 플래그 없이).
 */
function hasMeaningfulContent(body: string, headingCore: string): boolean {
  // 다음 ## 또는 문자열 끝(EOF) 직전까지를 슬라이스
  const re = new RegExp(
    `(?:^|\\n)##\\s+[^\\n]*${escapeRegex(headingCore)}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
    'u',
  );
  const m = body.match(re);
  if (!m) return false;
  // placeholder blockquote(>로 시작)와 공백만 제거 후 길이 측정
  const stripped = m[1]!
    .split('\n')
    .filter((line) => !line.trim().startsWith('>'))
    .join('\n')
    .replace(/^\s*$/gm, '')
    .trim();
  return stripped.length >= 20;
}

/**
 * content_type 기준 H2 진척률 — sidebar 체크리스트 데이터 소스.
 *
 * - present: 필수 H2가 본문에 존재하는가
 * - hasContent: H2 다음에 실질적 텍스트(20자+, >blockquote 제외)가 있는가
 *
 * @example
 * const outline = extractBodyOutline(body, 'howto');
 * // → { totalRequired: 4, presentRequired: 4, completedRequired: 2, items: [...] }
 */
export function extractBodyOutline(
  body: string,
  contentType: ArticleContentType,
): BodyOutline {
  const required = REQUIRED_H2_BY_TYPE[contentType];
  const items: BodyOutlineItem[] = required.map((text) => {
    // 괄호 부분 제거 매칭 — "위치(메뉴 경로)" → "위치"
    const core = text.split('(')[0]!.trim();
    const present = new RegExp(
      `(?:^|\\n)##\\s+[^\\n]*${escapeRegex(core)}`,
      'u',
    ).test(body);
    const hasContent = present && hasMeaningfulContent(body, core);
    return { text, present, hasContent };
  });
  return {
    totalRequired: required.length,
    presentRequired: items.filter((i) => i.present).length,
    completedRequired: items.filter((i) => i.hasContent).length,
    items,
  };
}

/**
 * 골격 주입 직후 상태 감지 — heading + > placeholder + 공백/리스트 뿐인가.
 *
 * 사용처: IntentSelector 의도 변경 시 ConfirmDialog 표시 여부 결정.
 *   - true → 본문이 "비어있다" 간주, 즉시 덮어쓰기
 *   - false → 매니저가 실제 작성한 내용 존재, 덮어쓰기 confirm 필요
 */
export function isPlaceholderOnly(body: string): boolean {
  const meaningfulLines = body
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (t.startsWith('#')) return false;
      if (t.startsWith('>')) return false;
      return true;
    });
  // 의미 있는 라인 0건 + 본문 비어있지 않음 → 골격 주입 상태
  return meaningfulLines.length === 0;
}
