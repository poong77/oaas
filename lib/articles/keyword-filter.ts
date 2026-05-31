/**
 * 키워드 한글 정책 (knowledge-base-overhaul v1.5).
 *
 * 정책:
 *   - articles.keywords 입력은 **한글 단어만** 허용 (가-힣 + 공백 + 숫자)
 *   - 영어 약어(CI, OTA, PMS), 영문 동의어(check-in) 등은 어드민
 *     `master/synonyms`에서 별도 입력 (term_synonyms 마스터)
 *   - 추천 알고리즘은 검색 시 자동으로 동의어 확장 (expandKeywords)
 *
 * 이렇게 분리하는 이유:
 *   1. 호텔리어 사용 검색어 vs 시스템 매칭 사전 분리 (UX 일관성)
 *   2. AI 보조가 keywords에 영어를 채워 넣는 패턴 방지
 *   3. 동의어 마스터의 단일 진실 원천화
 *
 * @see docs/02-design/knowledge-base-overhaul/PLAN.md §1-2 A3
 */

/**
 * 한글 키워드 검증.
 *
 * 허용:
 *   - 가-힣 (한글 음절)
 *   - ㄱ-ㅎ, ㅏ-ㅣ (자모 — 거의 안 쓰지만 호환)
 *   - 숫자 0-9
 *   - 공백, ·, /, -
 *
 * 거부:
 *   - 영문 알파벳 (a-zA-Z)
 *   - 영문 약어 (CI, OTA, PMS 등)
 *   - 한자, 일본어, 이모지
 *
 * 빈 문자열은 false.
 */
export function isKoreanKeyword(s: string | null | undefined): boolean {
  if (!s) return false;
  const trimmed = s.trim();
  if (!trimmed) return false;
  // 한글 음절/자모 + 숫자 + 공백 + 일부 구분자만 허용
  if (!/^[가-힣ㄱ-ㅎㅏ-ㅣ0-9\s·/\-()]+$/u.test(trimmed)) return false;
  // 한글 음절이 최소 1개는 있어야 함 (숫자만은 키워드로 부적합)
  if (!/[가-힣]/u.test(trimmed)) return false;
  return true;
}

/**
 * 한글 키워드 배열로 정제. 한글이 아닌 요소는 제외.
 *
 * @example
 * filterKoreanKeywords(['체크인', 'CI', '예약', 'reservation'])
 *   // → ['체크인', '예약']
 */
export function filterKoreanKeywords(items: string[]): string[] {
  return items.map((s) => s.trim()).filter(isKoreanKeyword);
}

/** 사용자에게 보여줄 거부 사유 메시지. */
export const KOREAN_KEYWORD_REJECT_MESSAGE =
  '키워드는 한글만 입력할 수 있어요. 영어 약어(CI, OTA 등)나 영문 동의어는 어드민 → 마스터 → 동의어 사전에 등록해주세요.';
