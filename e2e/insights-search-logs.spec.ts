/**
 * 검색로그(insights/search-logs) E2E 시나리오.
 *
 * 어드민 > 인사이트 > 검색로그 (`/admin/insights/search-logs`).
 *   - 진입/렌더 (SL-01 ~ SL-05)
 *   - 사이드바 네비게이션 (SL-06)
 *   - 권한 (SL-07 어드민 OK / SL-08 호텔리어 404)
 *   - 모바일 Sheet 네비게이션 (SL-09)
 *
 * 데이터 유무에 무관하게 통과하도록 "테이블 헤더 OR EmptyState" 형태로 단언.
 *
 * @see docs/02-design/features/search-logs.design.md
 */

import { test, expect, type Page } from '@playwright/test';
import { STORAGE_STATE_PATHS } from './fixtures/users';
import { expectNotFound } from './helpers/assert';

const PATH = '/admin/insights/search-logs';

/** sidebarCollapsed 쿠키 set (펼침 상태 보장). */
async function setCollapsedCookie(page: Page, collapsed: boolean) {
  const baseURL = new URL(
    page.url() === 'about:blank' ? 'http://localhost:3000' : page.url(),
  );
  await page.context().addCookies([
    {
      name: 'sidebarCollapsed',
      value: collapsed ? '1' : '',
      domain: baseURL.hostname,
      path: '/',
    },
  ]);
}

// ──────────────────────────────────────────────────────────────────
// MANAGER — 진입/렌더
// ──────────────────────────────────────────────────────────────────
test.describe('검색로그 진입/렌더 (매니저)', () => {
  test.use({
    storageState: STORAGE_STATE_PATHS.manager,
    viewport: { width: 1440, height: 900 },
  });

  test('SL-01: 진입 200 OK + 페이지 헤더 "검색로그" 노출', async ({ page }) => {
    const res = await page.goto(PATH);
    expect(res?.status()).toBe(200);
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: '검색로그' }),
    ).toBeVisible();
  });

  test('SL-02: 사이드바 "인사이트" 그룹 + "검색로그" 메뉴 active', async ({
    page,
  }) => {
    await setCollapsedCookie(page, false);
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');

    const aside = page.locator('aside[aria-label="관리자 내비게이션"]');
    await expect(aside).toBeVisible();

    // 그룹 라벨 "인사이트"
    await expect(aside.getByText('인사이트', { exact: true })).toBeVisible();

    // 검색로그 메뉴 link + 현재 페이지 표시
    const link = aside.getByRole('link', { name: /검색로그/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('aria-current', 'page');
  });

  test('SL-03: 요약 카드 4종(검색 수/결과 클릭/티켓 전환/결과없음) 노출', async ({
    page,
  }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');

    const main = page.locator('main').first();
    await expect(main.getByText('검색 수', { exact: true })).toBeVisible();
    await expect(main.getByText('결과 클릭', { exact: true })).toBeVisible();
    await expect(main.getByText('티켓 전환', { exact: true })).toBeVisible();
    await expect(main.getByText('결과없음', { exact: true })).toBeVisible();
  });

  test('SL-04: 기간 필터 4버튼(오늘 실시간 기본) + "최근 30일" 클릭 → ?period=30d', async ({
    page,
  }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');

    // 오늘(실시간)이 맨 왼쪽 + 기본값
    await expect(
      page.getByRole('button', { name: /오늘 \(실시간\)/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /어제 \(1일\)/ }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /최근 7일/ })).toBeVisible();

    const thirty = page.getByRole('button', { name: /최근 30일/ });
    await expect(thirty).toBeVisible();
    await thirty.click();

    await page.waitForURL(/[?&]period=30d/, { timeout: 10_000 });
    expect(page.url()).toContain('period=30d');
  });

  test('SL-05: 테이블 헤더 또는 EmptyState 노출 (데이터 무관)', async ({
    page,
  }) => {
    await page.goto(PATH);
    await page.waitForLoadState('networkidle');

    // 데이터 있으면 테이블 헤더 "유입 키워드", 없으면 EmptyState 안내문구.
    const tableHeader = page.getByRole('columnheader', {
      name: /유입 키워드/,
    });
    const emptyState = page.getByText('이 기간에 검색 이력이 없습니다');

    await expect(tableHeader.or(emptyState).first()).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────
// MANAGER — 사이드바 네비게이션
// ──────────────────────────────────────────────────────────────────
test.describe('검색로그 사이드바 네비게이션 (매니저)', () => {
  test.use({
    storageState: STORAGE_STATE_PATHS.manager,
    viewport: { width: 1440, height: 900 },
  });

  test('SL-06: /admin/tickets → 사이드바 검색로그 클릭 → 이동', async ({
    page,
  }) => {
    await setCollapsedCookie(page, false);
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    const aside = page.locator('aside[aria-label="관리자 내비게이션"]');
    const link = aside.getByRole('link', { name: /검색로그/ });
    await expect(link).toBeVisible();
    await link.click();

    await page.waitForURL(`**${PATH}`, { timeout: 10_000 });
    expect(page.url()).toContain(PATH);
    await expect(
      page.getByRole('heading', { name: '검색로그' }),
    ).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────
// 권한
// ──────────────────────────────────────────────────────────────────
test.describe('검색로그 권한 — 어드민', () => {
  test.use({
    storageState: STORAGE_STATE_PATHS.admin,
    viewport: { width: 1440, height: 900 },
  });

  test('SL-07: 어드민 진입 200 OK', async ({ page }) => {
    const res = await page.goto(PATH);
    expect(res?.status()).toBe(200);
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('heading', { name: '검색로그' }),
    ).toBeVisible();
  });
});

test.describe('검색로그 권한 — 호텔리어 회귀', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.hotelier });

  test('SL-08: 호텔리어 직접 진입 → 404', async ({ page }) => {
    await page.goto(PATH);
    // Next16 스트리밍 SSR은 notFound()도 HTTP 200을 반환 → not-found UI로 차단 검증
    await expectNotFound(page);
  });
});

// ──────────────────────────────────────────────────────────────────
// 모바일
// ──────────────────────────────────────────────────────────────────
test.describe('검색로그 모바일 (매니저)', () => {
  test.use({
    storageState: STORAGE_STATE_PATHS.manager,
    viewport: { width: 390, height: 844 },
  });

  test('SL-09: 햄버거 → Sheet → 검색로그 클릭 → 이동', async ({ page }) => {
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /메뉴 열기/ }).click();

    const link = page.getByRole('link', { name: /검색로그/ }).first();
    await expect(link).toBeVisible();
    await link.click();

    await page.waitForURL(`**${PATH}`, { timeout: 10_000 });
    expect(page.url()).toContain(PATH);
  });
});
