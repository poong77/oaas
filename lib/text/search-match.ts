/**
 * 검색 결과 점수·하이라이트 공용 헬퍼.
 *
 * 검색 매칭은 동의어 확장(expandKeywords) 결과로 이뤄지므로,
 * 점수와 하이라이트도 반드시 같은 "확장 term 집합" 기준으로 계산해야 한다.
 * 그러지 않으면 동의어로 찾은 결과("CI"로 찾은 "체크인" 문서)가 원본 검색어
 * 글자가 없다는 이유로 0점으로 가라앉거나, 하이라이트가 누락된다.
 */

/** 확장 term 중 하나라도 text에 포함되면 true (대소문자 무시). */
export function matchesAnyTerm(
  text: string | null | undefined,
  terms: string[],
): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return terms.some((t) => t.length > 0 && lower.includes(t.toLowerCase()));
}

/** keywords 배열 중 하나라도 확장 term과 매칭되면 true. */
export function keywordsMatchAnyTerm(
  keywords: string[] | null | undefined,
  terms: string[],
): boolean {
  if (!keywords || keywords.length === 0) return false;
  return keywords.some((k) => matchesAnyTerm(k, terms));
}

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

function escapeRegExp(s: string): string {
  return s.replace(REGEX_SPECIAL, '\\$&');
}

/**
 * 확장 term들을 하나의 대소문자 무시 정규식으로 합친다.
 *
 * - 2자 미만 term은 제외(과도한 하이라이트 방지)
 * - 긴 term을 우선 매칭하도록 길이 내림차순 정렬
 * - 매칭할 term이 없으면 null
 *
 * 반환된 정규식은 단일 캡처 그룹을 가지므로 `text.split(regex)` 결과에서
 * 홀수 인덱스가 매칭 구간이 된다.
 */
export function buildHighlightRegex(terms: string[]): RegExp | null {
  const cleaned = Array.from(
    new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 2)),
  ).sort((a, b) => b.length - a.length);
  if (cleaned.length === 0) return null;
  return new RegExp(`(${cleaned.map(escapeRegExp).join('|')})`, 'gi');
}
