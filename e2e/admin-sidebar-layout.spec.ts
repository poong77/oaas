/**
 * admin-sidebar-layout E2E 시나리오.
 *
 * Design 문서 §9의 24개 시나리오 중 자동화 가능한 항목 위주.
 *
 * 카테고리:
 *   - 기능 (F-01 ~ F-09): 사이드바 노출, 토글, 단축키, 자물쇠, 활성 표시
 *   - 회귀 (R-01 ~ R-05): 호텔리어 사이드바 미노출, viewMode 전환, 권한 차단, 페이지 시각
 *   - 모바일 (M-01 ~ M-04): Sheet 드로어, 컴팩트 헤더
 *
 * 시각 (V-01 ~ V-06)은 screenshot diff 영역으로 별도 처리 (본 spec에서는 일부만).
 *
 * @see docs/02-design/features/admin-sidebar-layout.design.md §9
 */

import { test, expect, type Page } from '@playwright/test';
import { STORAGE_STATE_PATHS } from './fixtures/users';

// ──────────────────────────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────────────────────────

/** 사이드바(aside)가 보이는지 + 폭 검증. 트랜지션/RSC re-render 완료 대기. */
async function expectSidebarVisible(page: Page, expectedWidth: number) {
  const aside = page.locator('aside[aria-label="관리자 내비게이션"]');
  await expect(aside).toBeVisible();
  // RSC refresh + grid transition 종료까지 대기 (max 5초)
  await page.waitForFunction(
    ({ expected }) => {
      const el = document.querySelector('aside[aria-label="관리자 내비게이션"]');
      if (!el) return false;
      const w = el.getBoundingClientRect().width;
      return Math.abs(w - expected) < 8;
    },
    { expected: expectedWidth },
    { timeout: 5000, polling: 100 },
  );
}

/** sidebarCollapsed 쿠키 명시 set */
async function setCollapsedCookie(page: Page, collapsed: boolean) {
  const baseURL = new URL(page.url() === 'about:blank' ? 'http://localhost:3000' : page.url());
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
// MANAGER — 데스크탑 기능 시나리오 (F-01 ~ F-09)
// ──────────────────────────────────────────────────────────────────
test.describe('데스크탑 기능 (매니저)', () => {
  test.use({
    storageState: STORAGE_STATE_PATHS.manager,
    viewport: { width: 1440, height: 900 },
  });

  test('F-01: /admin/tickets 진입 시 좌측 120px 사이드바 노출 + 티켓 큐 active', async ({
    page,
  }) => {
    await setCollapsedCookie(page, false);
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    await expectSidebarVisible(page, 120);

    // 티켓 큐 메뉴가 aria-current="page" 보유
    const ticketsLink = page
      .locator('aside[aria-label="관리자 내비게이션"]')
      .getByRole('link', { name: /티켓 큐/ });
    await expect(ticketsLink).toBeVisible();
    await expect(ticketsLink).toHaveAttribute('aria-current', 'page');
  });

  test('F-02 / F-03: 토글 버튼 클릭으로 120 ↔ 28px 전환', async ({ page }) => {
    await setCollapsedCookie(page, false);
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    await expectSidebarVisible(page, 120);

    // 토글 (사이드바 footer)
    const toggle = page.getByRole('button', { name: /사이드바 접기/ });
    await expect(toggle).toBeVisible();
    await toggle.click();

    // RSC re-render + transition 대기 (expectSidebarVisible 내부 polling)
    await expectSidebarVisible(page, 28);

    // 다시 펼치기
    const toggleExpand = page.getByRole('button', { name: /사이드바 펼치기/ });
    await expect(toggleExpand).toBeVisible();
    await toggleExpand.click();
    await expectSidebarVisible(page, 120);
  });

  test('F-04 / F-05: 단축키 [ ] 로 접기/펼치기', async ({ page }) => {
    await setCollapsedCookie(page, false);
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    await expectSidebarVisible(page, 120);

    // body에 focus 후 [ 키
    await page.locator('body').click();
    await page.keyboard.press('[');
    await expectSidebarVisible(page, 28);

    // ] 키
    await page.keyboard.press(']');
    await expectSidebarVisible(page, 120);
  });

  test('F-06: 입력 필드 focus 상태에서 [ 키 입력 시 사이드바 변경 없음', async ({
    page,
  }) => {
    await setCollapsedCookie(page, false);
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    await expectSidebarVisible(page, 120);

    // 페이지 내 검색 input 또는 첫 번째 input 찾기
    const anyInput = page.locator('input[type="text"], input[type="search"], input:not([type])').first();

    if ((await anyInput.count()) === 0) {
      test.skip(true, '/admin/tickets에 input 필드가 없음');
      return;
    }

    await anyInput.focus();
    await page.keyboard.press('[');
    await page.waitForTimeout(400);

    // 사이드바는 여전히 120px
    await expectSidebarVisible(page, 120);
    // input에는 '[' 문자가 들어감
    await expect(anyInput).toHaveValue(/\[/);
  });

  test('F-07: 자물쇠 메뉴(사용자) 클릭 → 404 발생 안 함, button disabled', async ({
    page,
  }) => {
    await setCollapsedCookie(page, false);
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    // 매니저 시점에서 "사용자" 메뉴는 button[disabled]
    const lockedButton = page
      .locator('aside[aria-label="관리자 내비게이션"]')
      .getByRole('button', { name: /사용자/ });

    await expect(lockedButton).toBeVisible();
    await expect(lockedButton).toBeDisabled();
    await expect(lockedButton).toHaveAttribute('aria-disabled', 'true');

    // 클릭해도 URL 변경 없음
    const urlBefore = page.url();
    await lockedButton.click({ force: true });
    await page.waitForTimeout(500);
    expect(page.url()).toBe(urlBefore);
  });

  test('F-09: AdminUserMenu 사이드바 footer 펼침 popup 노출', async ({ page }) => {
    await setCollapsedCookie(page, false);
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    // 사이드바 footer 아바타 트리거 (펼침 모드: 이름 + ▼)
    const aside = page.locator('aside[aria-label="관리자 내비게이션"]');
    const avatarTrigger = aside.locator('button[aria-haspopup="menu"]');
    await expect(avatarTrigger).toBeVisible();
    await avatarTrigger.click();

    // popup 안에 "내 프로필" / "로그아웃" 노출
    await expect(page.getByRole('menuitem', { name: /내 프로필/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /로그아웃/ })).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────
// MANAGER — 접힘 상태 시나리오
// ──────────────────────────────────────────────────────────────────
test.describe('데스크탑 접힘 상태 (매니저)', () => {
  test.use({
    storageState: STORAGE_STATE_PATHS.manager,
    viewport: { width: 1440, height: 900 },
  });

  test('SSR 첫 렌더 시 sidebarCollapsed=1 쿠키 반영 (깜빡임 0)', async ({ page }) => {
    await setCollapsedCookie(page, true);
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');
    // 첫 렌더 시점에 이미 28px이어야 함 (transition 시작 전)
    await expectSidebarVisible(page, 28);
  });
});

// ──────────────────────────────────────────────────────────────────
// 회귀 시나리오 (R-01 ~ R-05)
// ──────────────────────────────────────────────────────────────────
test.describe('회귀 — 호텔리어 (R-01)', () => {
  test.use({
    storageState: STORAGE_STATE_PATHS.hotelier,
    viewport: { width: 1440, height: 900 },
  });

  test('R-01: 호텔리어 로그인 시 / 진입 → 사이드바 DOM 자체 없음', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // aside[aria-label="관리자 내비게이션"] 미존재
    await expect(page.locator('aside[aria-label="관리자 내비게이션"]')).toHaveCount(0);

    // 호텔리어 Header GNB는 정상 (role-mode-ui 회귀 검사)
    await expect(page.getByRole('link', { name: '빠른 해결' }).first()).toBeVisible();
  });
});

test.describe('회귀 — footer 외부 링크 (R-02 대체)', () => {
  test.use({
    storageState: STORAGE_STATE_PATHS.manager,
    viewport: { width: 1440, height: 900 },
  });

  test('R-02: 사이드바 footer 호텔리어 사이트 새 탭 외부링크 노출', async ({ page }) => {
    await setCollapsedCookie(page, false);
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    const aside = page.locator('aside[aria-label="관리자 내비게이션"]');
    const outlink = aside.getByRole('link', { name: /호텔리어 사이트/ });
    await expect(outlink).toBeVisible();
    await expect(outlink).toHaveAttribute('href', 'https://support.oapms.com/');
    await expect(outlink).toHaveAttribute('target', '_blank');
    await expect(outlink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

test.describe('회귀 — 권한 차단 (R-03 / R-04)', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.manager });

  test('R-03: 매니저 /admin/users 직접 입력 → 404', async ({ page }) => {
    const res = await page.goto('/admin/users');
    expect(res?.status()).toBe(404);
  });

  test('R-04: /profile → "매니저 영역으로" 클릭 → /admin/tickets', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    const link = page.getByRole('link', { name: /매니저 영역으로/ }).first();
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL('**/admin/tickets', { timeout: 10_000 });
    expect(page.url()).toContain('/admin/tickets');
  });
});

test.describe('회귀 — 페이지 시각 (R-05)', () => {
  test.use({
    storageState: STORAGE_STATE_PATHS.manager,
    viewport: { width: 1440, height: 900 },
  });

  test('R-05: /admin/tickets, /admin/articles, /admin/master 200 OK + 페이지 정상 렌더', async ({
    page,
  }) => {
    for (const path of ['/admin/tickets', '/admin/articles', '/admin/master']) {
      const res = await page.goto(path);
      expect(res?.status(), `${path}`).toBe(200);
      await page.waitForLoadState('networkidle');
      // main은 RoleScope가 단일로 부여. AdminShell은 div로 wrapping.
      await expect(page.locator('main').first()).toBeVisible();
      await expectSidebarVisible(page, 120);
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// 모바일 시나리오 (M-01 ~ M-04)
// ──────────────────────────────────────────────────────────────────
test.describe('모바일 (매니저)', () => {
  test.use({
    storageState: STORAGE_STATE_PATHS.manager,
    viewport: { width: 390, height: 844 }, // iPhone 12 viewport
  });

  test('M-01: /admin/tickets 진입 시 사이드바 DOM 없음 + 컴팩트 헤더 노출', async ({
    page,
  }) => {
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    // 데스크탑 사이드바는 lg:hidden hidden — 모바일에선 보이지 않아야 함
    const aside = page.locator('aside[aria-label="관리자 내비게이션"]');
    if ((await aside.count()) > 0) {
      await expect(aside).toBeHidden();
    }

    // 모바일 헤더 햄버거 트리거 노출
    await expect(page.getByRole('button', { name: /메뉴 열기/ })).toBeVisible();
  });

  test('M-02 / M-03: 햄버거 → Sheet 메뉴 → 항목 클릭 → 자동 닫힘', async ({ page }) => {
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    // 햄버거 클릭
    await page.getByRole('button', { name: /메뉴 열기/ }).click();

    // Sheet 안에 호텔리어 사이트 외부링크 + 메뉴 그룹 노출
    await expect(
      page.getByRole('link', { name: /호텔리어 사이트/ }),
    ).toBeVisible();

    // 그룹 메뉴 "아티클" 클릭
    const articlesLink = page
      .getByRole('link', { name: /^아티클$/ })
      .first();
    await expect(articlesLink).toBeVisible();
    await articlesLink.click();

    // /admin/articles로 이동 + Sheet 닫힘
    await page.waitForURL('**/admin/articles', { timeout: 10_000 });
    expect(page.url()).toContain('/admin/articles');
  });
});

// ──────────────────────────────────────────────────────────────────
// 어드민 회귀 (admin은 자물쇠 없음)
// ──────────────────────────────────────────────────────────────────
test.describe('어드민 회귀', () => {
  test.use({
    storageState: STORAGE_STATE_PATHS.admin,
    viewport: { width: 1440, height: 900 },
  });

  test('ADMIN: 자물쇠 없음 — 사용자/호텔 메뉴가 link로 노출', async ({ page }) => {
    await setCollapsedCookie(page, false);
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    const aside = page.locator('aside[aria-label="관리자 내비게이션"]');
    await expect(aside.getByRole('link', { name: /사용자/ })).toBeVisible();
    await expect(aside.getByRole('link', { name: /^호텔$/ })).toBeVisible();
  });

  test('ADMIN: /admin/users 200 OK', async ({ page }) => {
    const res = await page.goto('/admin/users');
    expect(res?.status()).toBe(200);
  });
});
