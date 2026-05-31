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

/** 공백·하이픈·언더스코어 등 구분자. collapse 키 생성용. */
const SEPARATOR_REGEX = /[\s\-_·.]+/gu;

/**
 * 띄어쓰기/붙여쓰기/하이픈 무시 매칭 키.
 *
 * normalizeTerm 후 공백·하이픈·언더스코어·가운뎃점을 모두 제거한다.
 * 동의어 사전에 한 형태만 등록해도 변형 표기를 매칭하기 위해 사용
 * (인덱스 등록 + 질의 양쪽에서 동일 키로 비교).
 *
 * @example
 *   collapseSpacing('실시간 객실')  // '실시간객실'
 *   collapseSpacing('실시간객실')   // '실시간객실'
 *   collapseSpacing('check-in')     // 'checkin'
 *   collapseSpacing('check in')     // 'checkin'
 */
export function collapseSpacing(input: string): string {
  return normalizeTerm(input).replace(SEPARATOR_REGEX, '');
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
