/**
 * admin-help-panel E2E 시나리오 (admin 축소판).
 *
 * 사이드바 footer / 모바일 헤더의 ? 트리거 → 우측 Sheet 슬라이드인 동작 검증.
 *
 * NOTE — admin 단일 계정으로 축소 실행:
 *   global.setup의 manager/hotelier 로그인 단계에서 Next.js 16 dev + NextAuth v5
 *   조합 hang 이슈 회피용. 도움말 패널 자체는 어드민/매니저 공통 컴포넌트라
 *   admin 검증만으로도 회귀 검출에 충분.
 *
 * 카테고리:
 *   - 데스크탑 펼침 (H-01 ~ H-04): 트리거 노출, 패널 열림, 콘텐츠 검증, Esc/X 닫기
 *   - 데스크탑 접힘 (H-05): 접힘 모드에서도 동작
 *   - 모바일 (H-06): 헤더 ? 버튼 동작
 *
 * 콘텐츠 검증 포인트:
 *   - SheetTitle: "리치 에디터 운영자 가이드"
 *   - 핵심 카드 헤딩: "단축키 (어드민·매니저)", "빠른답변 변수 치환표"
 *   - 변수표 4종 ({{호텔명}}, {{호텔리어명}}, {{티켓번호}}, {{매니저명}})
 *
 * 실행:
 *   npx playwright test --config=e2e/playwright.config.ts e2e/admin-help-panel.spec.ts \
 *     --project=chromium --no-deps
 *
 * @see app/(admin)/admin/_components/admin-help-button.tsx
 * @see app/(admin)/admin/_components/admin-editor-help-content.tsx
 */

import { test, expect, type Page } from '@playwright/test';
import { STORAGE_STATE_PATHS } from './fixtures/users';

// ──────────────────────────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────────────────────────

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

/** Sheet content (Radix Dialog) 로케이터 — role="dialog" + 제목 매칭 */
function sheetDialog(page: Page) {
  return page.getByRole('dialog', { name: /리치 에디터 운영자 가이드/ });
}

// ──────────────────────────────────────────────────────────────────
// ADMIN — 데스크탑 펼침
// ──────────────────────────────────────────────────────────────────
test.describe('데스크탑 펼침', () => {
  test.use({
    storageState: STORAGE_STATE_PATHS.admin,
    viewport: { width: 1440, height: 900 },
  });

  test('H-01: 사이드바 footer에 ? 도움말 트리거 노출', async ({ page }) => {
    await setCollapsedCookie(page, false);
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    const aside = page.locator('aside[aria-label="관리자 내비게이션"]');
    const helpBtn = aside.getByRole('button', { name: /에디터·단축키 도움말/ });
    await expect(helpBtn).toBeVisible();
    // 펼침 모드: "도움말" 라벨도 노출
    await expect(helpBtn).toContainText('도움말');
  });

  test('H-02: ? 클릭 → Sheet 열림 + 핵심 콘텐츠 노출', async ({ page }) => {
    await setCollapsedCookie(page, false);
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    const helpBtn = page
      .locator('aside[aria-label="관리자 내비게이션"]')
      .getByRole('button', { name: /에디터·단축키 도움말/ });
    await helpBtn.click();

    const dialog = sheetDialog(page);
    await expect(dialog).toBeVisible();

    // 핵심 카드 헤딩 검증
    await expect(dialog.getByRole('heading', { name: /단축키 \(어드민·매니저\)/ })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /빠른답변 변수 치환표/ })).toBeVisible();

    // 변수 4종 모두 노출
    for (const v of ['{{호텔명}}', '{{호텔리어명}}', '{{티켓번호}}', '{{매니저명}}']) {
      await expect(dialog.getByText(v, { exact: false }).first()).toBeVisible();
    }
  });

  test('H-03: Esc 키로 Sheet 닫힘', async ({ page }) => {
    await setCollapsedCookie(page, false);
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    await page
      .locator('aside[aria-label="관리자 내비게이션"]')
      .getByRole('button', { name: /에디터·단축키 도움말/ })
      .click();

    const dialog = sheetDialog(page);
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('H-04: 닫기 버튼(X)으로 Sheet 닫힘', async ({ page }) => {
    await setCollapsedCookie(page, false);
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    await page
      .locator('aside[aria-label="관리자 내비게이션"]')
      .getByRole('button', { name: /에디터·단축키 도움말/ })
      .click();

    const dialog = sheetDialog(page);
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: '닫기' }).click();
    await expect(dialog).toBeHidden();
  });
});

// ──────────────────────────────────────────────────────────────────
// ADMIN — 데스크탑 접힘
// ──────────────────────────────────────────────────────────────────
test.describe('데스크탑 접힘', () => {
  test.use({
    storageState: STORAGE_STATE_PATHS.admin,
    viewport: { width: 1440, height: 900 },
  });

  test('H-05: 접힘 상태에서 ? 아이콘 노출 + 클릭 시 Sheet 열림', async ({ page }) => {
    await setCollapsedCookie(page, true);
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    const helpBtn = page
      .locator('aside[aria-label="관리자 내비게이션"]')
      .getByRole('button', { name: /에디터·단축키 도움말/ });
    await expect(helpBtn).toBeVisible();
    // 접힘 모드: "도움말" 텍스트 라벨은 노출 안 됨 (아이콘만)
    await expect(helpBtn).not.toContainText('도움말');

    await helpBtn.click();
    await expect(sheetDialog(page)).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────
// ADMIN — 모바일
// ──────────────────────────────────────────────────────────────────
test.describe('모바일', () => {
  test.use({
    storageState: STORAGE_STATE_PATHS.admin,
    viewport: { width: 390, height: 844 },
  });

  test('H-06: 모바일 헤더 우측 ? 버튼 → Sheet 열림', async ({ page }) => {
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    // 모바일 헤더 내 ? 버튼 — 햄버거 메뉴와 구분되는 별도 트리거
    const header = page.locator('header').filter({ has: page.getByRole('button', { name: /메뉴 열기/ }) });
    const helpBtn = header.getByRole('button', { name: /에디터·단축키 도움말/ });
    await expect(helpBtn).toBeVisible();

    await helpBtn.click();
    await expect(sheetDialog(page)).toBeVisible();
  });
});
