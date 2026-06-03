/**
 * 리스트 페이지 공통 파라미터 헬퍼.
 *
 * 모든 어드민 리스트는 URL 쿼리스트링 `pageSize` 로 페이지당 표시 개수를 제어한다.
 * 허용값은 PAGE_SIZE_OPTIONS 로 제한(화이트리스트)하여 임의 값 주입을 막는다.
 */

export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

/** searchParams.pageSize(문자열)를 허용된 숫자로 파싱. 벗어나면 fallback(기본 20). */
export function parsePageSize(raw: string | undefined, fallback: PageSizeOption = 20): number {
  const n = Number(raw);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : fallback;
}
