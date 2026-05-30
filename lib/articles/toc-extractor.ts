/**
 * 본문 markdown → TocEntry[] 추출.
 *
 * 규칙:
 *   - H1~H3만 (마크다운 `#`, `##`, `###`)
 *   - 코드블록 내부 `#` 무시
 *   - anchor: 텍스트 lowercase + 특수문자 제거 + 공백→하이픈 (한글 보존)
 *   - anchor 중복 시 `-2`, `-3` 등 suffix
 *
 * Tiptap Option A로 본문이 "markdown + 인라인 HTML" hybrid여도 ## H2는 markdown 그대로.
 * (인라인 HTML은 본문 중간에 끼어 들어가는 span/font 등이므로 H2 라인에는 영향 없음)
 *
 * @see docs/02-design/features/아티클관리시스템.design.md §6.3, §9
 * @see db/seed.ts extractTocLocal — 시드 스크립트용 인라인 동등 구현
 */

import type { TocEntry } from '@/db/schema';

export function extractToc(markdown: string): TocEntry[] {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const entries: TocEntry[] = [];
  const anchorCounts = new Map<string, number>();
  let inCodeBlock = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;

    const level = match[1]!.length as 1 | 2 | 3;
    const text = match[2]!.replace(/[*_`~]/g, '').trim();
    if (!text) continue;

    const baseAnchor = slugifyAnchor(text);
    const usedCount = anchorCounts.get(baseAnchor) ?? 0;
    const anchor = usedCount === 0 ? baseAnchor : `${baseAnchor}-${usedCount + 1}`;
    anchorCounts.set(baseAnchor, usedCount + 1);

    entries.push({ level, text, anchor });
  }
  return entries;
}

function slugifyAnchor(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/[^\wㄱ-힣\s-]/g, '') // 영문/숫자/언더스코어/한글/공백/하이픈만
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return cleaned || `h-${Math.random().toString(36).slice(2, 8)}`;
}
