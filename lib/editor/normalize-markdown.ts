/**
 * Tiptap → Markdown 직렬화 결과 정규화.
 *
 * 배경: `tiptap-markdown` 0.9.0의 라운드 트립 손상.
 *   - 줄바꿈을 CRLF로 변환
 *   - 라인 중간의 `>` 를 `&gt;` HTML entity로 과잉 escape
 *   - block image 다음 빈 줄이 사라져 H2와 한 줄로 붙음 (![alt](url)## 헤더)
 *
 * 적용 위치: `editor.storage.markdown.getMarkdown()` 호출 직후.
 *   - onUpdate (저장될 markdown 정규화)
 *   - setContent 비교 (라운드트립 일치 검사)
 *
 * 멱등성: 깨끗한 markdown을 다시 normalize해도 결과 동일.
 *   - 이미 LF, 이미 `>`, 이미 image 뒤 빈 줄 → no-op.
 */

/** 줄 중간의 `>` 가 `&gt;`로 HTML entity escape되는 것 복원. */
function unescapeAngleBrackets(md: string): string {
  // `&gt;` / `&lt;` 모두 복원. blockquote는 줄 시작의 raw `>`라서 영향 없음.
  return md.replace(/&gt;/g, '>').replace(/&lt;/g, '<');
}

/** CRLF → LF. */
function normalizeLineEndings(md: string): string {
  return md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * block image (`![alt](url)`) 다음에 빈 줄을 보장.
 *
 * tiptap-markdown은 image를 inline으로 직렬화하여 다음 block과 한 줄로 붙임.
 * 예: `![alt](url)## 헤더` → `![alt](url)\n\n## 헤더`
 *
 * 규칙:
 *   - image markdown 뒤에 줄바꿈이 없으면 `\n\n` 삽입
 *   - 이미 `\n\n`이면 그대로 (멱등)
 *   - 이미 `\n` 한 번만 있어도 한 번 더 추가
 */
function ensureBlockImageSpacing(md: string): string {
  // 캡처: 전체 image markdown
  // 매치 조건: image 뒤가 줄바꿈이 아니거나(다음 글자 직접 붙음), 단일 \n + 비공백
  return md
    // image 직후 비공백(같은 줄) → \n\n + 내용
    .replace(/(!\[[^\]]*\]\([^)]+\))(?=\S)/g, '$1\n\n')
    // image 직후 \n + 비공백/비공백 줄(= 빈 줄 없이 바로 다음 block) → \n\n
    .replace(/(!\[[^\]]*\]\([^)]+\))\n(?!\n|$)/g, '$1\n\n');
}

/**
 * 직렬화 손상 3종 일괄 복원.
 *
 * @example
 *   const md = editor.storage.markdown.getMarkdown();
 *   const clean = normalizeMarkdown(md);
 *   onChange(clean);
 */
export function normalizeMarkdown(md: string): string {
  if (!md) return md;
  let out = normalizeLineEndings(md);
  out = unescapeAngleBrackets(out);
  out = ensureBlockImageSpacing(out);
  return out;
}
