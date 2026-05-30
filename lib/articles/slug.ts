/**
 * slug 유틸 — 아티클 URL의 [slug] 부분.
 *
 * 패턴: `^[a-z0-9]+(-[a-z0-9]+)*$` (Plan §2)
 *   - 소문자, 숫자, 하이픈만
 *   - 시작/끝 하이픈 불가
 *   - 연속 하이픈 불가
 *
 * 제목으로부터 자동 생성 시:
 *   - 한글은 음차하지 않음 (영문/숫자만 추출 후 부족하면 random suffix)
 *   - 공백 → 하이픈
 *   - 영문 + 숫자만 남기고 lowercase
 *
 * @see docs/02-design/features/아티클관리시스템.design.md §6.1
 */

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * 제목/입력 텍스트 → slug 추정값.
 *
 * 한글이 포함된 경우 영문/숫자만 추출하며, 결과가 비면 'article'로 폴백.
 * 호출자는 충돌 검사 후 -2, -3 등 suffix를 붙여야 함.
 */
export function suggestSlug(input: string): string {
  if (!input) return 'article';
  const ascii = input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // 영문/숫자/공백/하이픈만
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!ascii || ascii.length < 2) return 'article';
  return ascii.slice(0, 80);
}

/** slug 형식 검증 (Zod 외 빠른 체크용). */
export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}
