/**
 * E2E 공용 assertion 헬퍼.
 */

import { type Page, expect } from '@playwright/test';

/**
 * notFound() 차단 검증.
 *
 * Next.js 16 스트리밍 SSR은 서버 컴포넌트에서 notFound()가 호출돼도
 * HTTP 응답 헤더가 이미 전송된 뒤라 status 코드가 200으로 나간다(본문만 404 UI로 대체).
 * 따라서 `res.status() === 404` 검사는 더 이상 유효하지 않으므로,
 * 렌더된 기본 not-found UI 노출로 "차단됨"을 검증한다.
 *
 * (커스텀 not-found.tsx가 없어 Next 기본 페이지 "This page could not be found."가 렌더됨)
 */
export async function expectNotFound(page: Page): Promise<void> {
  await expect(
    page.getByText('This page could not be found', { exact: false }),
  ).toBeVisible();
}
