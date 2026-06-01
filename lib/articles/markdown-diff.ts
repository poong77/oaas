/**
 * Markdown H2 섹션 단위 diff (Phase 4 — A6 재편집).
 *
 * 사용처:
 *   - `DiffPreviewModal` — 사이드-바이-사이드 비교 + 섹션별 부분 적용
 *   - shell — "선택만 적용" 시 일부 섹션만 교체하여 setBody
 *
 * H2 분할 규칙:
 *   - body-validator의 `(?:^|\n)##\s+...` 패턴과 **반드시 동기**.
 *     (D1·정찰 §7에서 확인)
 *   - 첫 H2 이전 영역은 `__preamble__` 가상 키로 보관 (드물지만 가능)
 *
 * 라인 diff:
 *   - `diff` 패키지의 `diffLines` 사용 (jsdiff)
 *   - 섹션 내부 차이를 added/removed/equal로 분류
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §16
 */

import { diffLines, type Change } from 'diff';

/** 첫 H2 이전 영역의 가상 키 (드문 경우용). */
export const PREAMBLE_KEY = '__preamble__';

export type Section = {
  /** "## 목표" 처럼 H2 라인 그대로 (preamble은 PREAMBLE_KEY) */
  heading: string;
  /** 그 H2 바로 다음 줄부터 다음 H2 직전까지 (heading 라인 미포함) */
  body: string;
  /** 본문 전체에서 이 섹션의 시작 라인 인덱스 (디버깅용) */
  startLine: number;
};

export type DiffLine = {
  type: 'equal' | 'add' | 'remove';
  /** 줄바꿈 미포함 단일 라인 */
  text: string;
};

export type SectionDiff = {
  /** before/after 중 등장하는 모든 heading 합집합 (순서: after 우선) */
  heading: string;
  before: string;
  after: string;
  changed: boolean;
  /** 라인 단위 diff (UI 색상 표시용) */
  lineDiff: DiffLine[];
};

// ─────────────────────────────────────────────────────────────────────────────
// H2 split
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 본문을 H2 섹션 배열로 분할.
 *
 * - body-validator 매칭 패턴과 동기 (괄호 포함 라벨도 그대로 보존).
 * - 첫 H2 이전 비어있지 않은 라인이 있으면 `PREAMBLE_KEY`로 보관.
 */
export function splitByH2(body: string): Section[] {
  const lines = (body ?? '').split('\n');
  const sections: Section[] = [];
  let cursor: Section | null = null;
  let preambleBuf: string[] = [];
  let preambleStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const isH2 = /^##\s+/.test(line);
    if (isH2) {
      // preamble flush
      if (cursor === null && preambleBuf.some((l) => l.trim() !== '')) {
        sections.push({
          heading: PREAMBLE_KEY,
          body: preambleBuf.join('\n'),
          startLine: preambleStart,
        });
        preambleBuf = [];
      }
      // 이전 섹션 push
      if (cursor !== null) sections.push(cursor);
      cursor = { heading: line, body: '', startLine: i };
      continue;
    }
    if (cursor === null) {
      if (preambleBuf.length === 0) preambleStart = i;
      preambleBuf.push(line);
    } else {
      cursor.body = cursor.body === '' ? line : `${cursor.body}\n${line}`;
    }
  }

  // 마지막 섹션 또는 preamble만 있는 경우
  if (cursor !== null) {
    sections.push(cursor);
  } else if (preambleBuf.some((l) => l.trim() !== '')) {
    sections.push({
      heading: PREAMBLE_KEY,
      body: preambleBuf.join('\n'),
      startLine: preambleStart,
    });
  }

  return sections;
}

/**
 * 섹션 배열을 markdown 본문으로 직렬화.
 *
 * - heading이 PREAMBLE_KEY면 body만 출력
 * - 다른 경우 heading 라인 + 빈 줄 + body
 * - 마지막 섹션 뒤에는 \n 추가하지 않음
 */
export function joinSections(sections: Section[]): string {
  return sections
    .map((s) =>
      s.heading === PREAMBLE_KEY ? s.body : `${s.heading}\n${s.body}`,
    )
    .join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// section diff
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 두 본문의 섹션별 diff.
 *
 * - heading 키 정합:
 *   · 동일 heading은 같은 섹션으로 매칭 (대소문자/공백 trim 후 비교)
 *   · after에만 있는 heading → added 섹션 (before: '')
 *   · before에만 있는 heading → removed 섹션 (after: '')
 * - 순서: after 우선 (사용자에게 보여줄 결과 본문 순서)
 *
 * @example
 * const result = diffMarkdownByH2(beforeBody, afterBody);
 * // result.sections: [{ heading: '## 증상', before, after, changed, lineDiff }, ...]
 */
export function diffMarkdownByH2(
  before: string,
  after: string,
): { sections: SectionDiff[]; anyChanged: boolean } {
  const beforeSecs = splitByH2(before);
  const afterSecs = splitByH2(after);

  const beforeMap = new Map<string, Section>();
  for (const s of beforeSecs) beforeMap.set(normalizeHeading(s.heading), s);

  const afterMap = new Map<string, Section>();
  for (const s of afterSecs) afterMap.set(normalizeHeading(s.heading), s);

  const result: SectionDiff[] = [];
  const seenKeys = new Set<string>();

  // after 순서대로 (사용자에게 보여줄 흐름)
  for (const s of afterSecs) {
    const key = normalizeHeading(s.heading);
    seenKeys.add(key);
    const beforeSec = beforeMap.get(key);
    result.push(makeSectionDiff(s.heading, beforeSec?.body ?? '', s.body));
  }
  // before에만 있는 (제거된) 섹션
  for (const s of beforeSecs) {
    const key = normalizeHeading(s.heading);
    if (seenKeys.has(key)) continue;
    result.push(makeSectionDiff(s.heading, s.body, ''));
  }

  const anyChanged = result.some((r) => r.changed);
  return { sections: result, anyChanged };
}

function normalizeHeading(heading: string): string {
  return heading.trim().toLowerCase();
}

function makeSectionDiff(heading: string, before: string, after: string): SectionDiff {
  const lineDiff = computeLineDiff(before, after);
  const changed = before.trim() !== after.trim();
  return { heading, before, after, changed, lineDiff };
}

/**
 * 라인 단위 diff (jsdiff).
 *
 * 빈 본문 → 단일 'equal' 비어있는 라인. UI에서 "변경 없음" 표시 가능.
 */
export function computeLineDiff(before: string, after: string): DiffLine[] {
  const changes: Change[] = diffLines(before, after);
  const out: DiffLine[] = [];
  for (const c of changes) {
    const type: DiffLine['type'] = c.added ? 'add' : c.removed ? 'remove' : 'equal';
    // 끝의 빈 라인 1개 제거 (split('\n') 후 마지막 '' 방지)
    const lines = c.value.replace(/\n$/, '').split('\n');
    for (const l of lines) out.push({ type, text: l });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 부분 적용
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 섹션별 선택적 병합 — 사용자가 일부만 "적용" 체크한 경우.
 *
 * @param beforeBody  현재 본문 (사용자 편집 중)
 * @param afterBody   AI 제안 결과 본문
 * @param applyKeys   적용할 heading 키들 (normalizeHeading 결과)
 * @returns           selected가 after를, 나머지가 before를 보존한 결과 본문
 */
export function applySelectedSections(
  beforeBody: string,
  afterBody: string,
  applyKeys: Set<string>,
): string {
  const beforeSecs = splitByH2(beforeBody);
  const afterSecs = splitByH2(afterBody);

  const afterMap = new Map<string, Section>();
  for (const s of afterSecs) afterMap.set(normalizeHeading(s.heading), s);

  // before 순서 보존 + applyKeys 해당하면 after 본문 사용
  const merged: Section[] = beforeSecs.map((s) => {
    const key = normalizeHeading(s.heading);
    if (applyKeys.has(key) && afterMap.has(key)) {
      return { ...s, body: afterMap.get(key)!.body, heading: afterMap.get(key)!.heading };
    }
    return s;
  });

  // after에만 있는 섹션 중 선택된 것 추가 (끝에 append)
  for (const s of afterSecs) {
    const key = normalizeHeading(s.heading);
    if (!applyKeys.has(key)) continue;
    const exists = merged.some((m) => normalizeHeading(m.heading) === key);
    if (!exists) merged.push(s);
  }

  return joinSections(merged);
}
