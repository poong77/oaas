/**
 * 사용자 관리 검색 — 호텔명 검색 E2E.
 *
 * 변경 배경: lib/services/users.ts listUsers() 검색 OR 조건에 호텔명을 추가하고
 * (띄어쓰기·하이픈·점 무시 매칭), count 쿼리에도 hotels leftJoin을 더했다.
 * placeholder 도 "…·호텔명 검색" 으로 갱신.
 *
 * 데이터 주도 방식: 시드/마이그레이션 DB 차이에 강하도록, 현재 목록에서
 * 실제 호텔명을 읽어 그 이름으로 검색한다. (특정 호텔명 하드코딩 회피)
 *
 * 검증 시나리오:
 *   S-01 호텔명으로 검색하면 결과가 나오고, 노출된 행의 호텔 컬럼이 검색어를 포함
 *   S-02 띄어쓰기를 제거해도 동일 호텔이 매칭 (collapseSpacing 기능)
 *   S-03 placeholder 에 "호텔명" 안내 노출
 *   S-04 존재하지 않는 검색어는 0건
 */

import { test, expect, type Page } from '@playwright/test';
import { STORAGE_STATE_PATHS } from './fixtures/users';

test.use({
  storageState: STORAGE_STATE_PATHS.admin,
  viewport: { width: 1440, height: 900 },
});

const SEARCH_INPUT = 'input[aria-label="사용자 검색"]';

/** "N 명 검색됨" 요약에서 숫자만 추출. */
async function readResultCount(page: Page): Promise<number> {
  const summary = page.getByText('명 검색됨');
  await expect(summary).toBeVisible();
  const text = (await summary.innerText()).replace(/[^0-9]/g, '');
  return Number(text || '0');
}

/** 데스크탑 테이블의 호텔 컬럼(3번째 td) 텍스트 목록. */
async function hotelCells(page: Page): Promise<string[]> {
  const rows = page.locator('table tbody tr');
  const n = await rows.count();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push((await rows.nth(i).locator('td').nth(2).innerText()).trim());
  }
  return out;
}

/** 검색어 입력 후 제출(Enter) → 목록 갱신 대기. */
async function search(page: Page, term: string) {
  const input = page.locator(SEARCH_INPUT);
  await input.fill(term);
  await input.press('Enter');
  // URL 에 q 반영 + RSC 재렌더 대기
  await page.waitForURL(/[?&]q=/, { timeout: 15_000 });
  await expect(page.getByText('불러오는 중…')).toHaveCount(0);
}

test.describe('사용자 관리 — 호텔명 검색', () => {
  test('S-03 검색창 placeholder 에 호텔명 안내가 노출된다', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator(SEARCH_INPUT)).toHaveAttribute(
      'placeholder',
      /호텔명/,
    );
  });

  test('S-01 호텔명으로 검색하면 해당 호텔 소속 사용자가 노출된다', async ({
    page,
  }) => {
    await page.goto('/admin/users');
    await expect(page.locator('table tbody tr').first()).toBeVisible();

    // 현재 목록에서 실제 호텔명을 가진 행을 하나 고른다.
    const cells = await hotelCells(page);
    const hotelName = cells.find(
      (c) => c && c !== '소속 없음' && c.length >= 2,
    );
    test.skip(!hotelName, '호텔명이 있는 사용자가 없어 검증 불가 (빈 DB)');

    await search(page, hotelName!);

    const count = await readResultCount(page);
    expect(count).toBeGreaterThan(0);

    // 노출된 행들의 호텔 컬럼이 모두 검색어(호텔명)를 포함해야 한다.
    const resultHotels = await hotelCells(page);
    expect(resultHotels.length).toBeGreaterThan(0);
    for (const h of resultHotels) {
      expect(h).toContain(hotelName!);
    }
  });

  test('S-02 띄어쓰기를 제거해도 호텔명이 매칭된다', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('table tbody tr').first()).toBeVisible();

    // 공백이 포함된 호텔명을 찾는다 (collapseSpacing 검증 대상).
    const cells = await hotelCells(page);
    const spaced = cells.find(
      (c) => c && c !== '소속 없음' && /\s/.test(c),
    );
    test.skip(!spaced, '공백 포함 호텔명이 없어 띄어쓰기 매칭 검증 불가');

    const collapsed = spaced!.replace(/\s+/g, '');
    await search(page, collapsed);

    const count = await readResultCount(page);
    expect(count).toBeGreaterThan(0);

    const resultHotels = await hotelCells(page);
    // 공백 제거 기준으로 원래 호텔명이 결과에 포함되어야 한다.
    expect(
      resultHotels.some((h) => h.replace(/\s+/g, '').includes(collapsed)),
    ).toBeTruthy();
  });

  test('S-04 존재하지 않는 검색어는 0건', async ({ page }) => {
    await page.goto('/admin/users');
    await search(page, 'ZZ존재하지않는호텔명QX9');

    const count = await readResultCount(page);
    expect(count).toBe(0);
    await expect(page.locator('table tbody tr')).toHaveCount(0);
  });
});
