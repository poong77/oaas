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

const REQUIRED_H2_BY_TYPE: Record<ArticleContentType, string[]> = {
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
