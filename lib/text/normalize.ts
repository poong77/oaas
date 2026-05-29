/**
 * 검색·동의어 매칭용 텍스트 정규화 헬퍼.
 *
 * synonyms-master Phase Q-2/Q-3 결정 반영:
 *   - lower + trim + NFC 정규화 후 비교
 *   - 검색 토큰 분리 시 2자 미만 토큰 제외
 */

/** Q-2: NFC + lower + trim. */
export function normalizeTerm(input: string): string {
  return input.normalize('NFC').toLowerCase().trim();
}

const SPLIT_REGEX = /[\s,.;:/\\!?"'()[\]{}<>~`@#$%^&*+=|]+/u;
const MIN_TOKEN_LENGTH = 2;

/**
 * 검색 쿼리를 토큰으로 분리.
 *
 * - 공백·구두점·따옴표 등으로 split
 * - lower + trim 후 2자 이상만 남김 (Q-3)
 * - 중복 제거
 *
 * @example
 *   tokenizeQuery("CI 결제실패") // ['ci', '결제실패']
 *   tokenizeQuery("a CI") // ['ci'] (1자 'a' 제외)
 *   tokenizeQuery("") // []
 */
export function tokenizeQuery(input: string): string[] {
  if (!input) return [];
  const tokens = normalizeTerm(input)
    .split(SPLIT_REGEX)
    .map((t) => t.trim())
    .filter((t) => t.length >= MIN_TOKEN_LENGTH);
  return Array.from(new Set(tokens));
}
