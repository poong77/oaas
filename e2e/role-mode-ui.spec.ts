/**
 * role-mode-ui E2E 시나리오.
 *
 * Design 문서 §12에서 핵심 7건 추출:
 *   T-04: manager 어드민 영역 분리 (호텔리어 UI 비노출)
 *   T-06: 권한 차단 (manager /admin/users → 404)
 *   T-07: UserNav 404 버그 수정 검증
 *   T-08: 호텔리어 시점 보기 ON
 *   T-09: 시점 보기 OFF
 *   R-01: 호텔리어 회귀 검사
 *   AUTH: 비로그인 회귀
 *
 * 참고: app/(admin)/admin/page.tsx가 별도로 존재하지 않으면 /admin/tickets로
 * 리다이렉트되거나 group route에 따라 동작. 본 테스트는 /admin/tickets 명시.
 */

import { test, expect } from '@playwright/test';
import { STORAGE_STATE_PATHS } from './fixtures/users';
import { expectNotFound } from './helpers/assert';

// ──────────────────────────────────────────────────────────────────
// AUTH-회귀: 비로그인 / 진입 시 호텔리어 톤 + 200 OK
// ──────────────────────────────────────────────────────────────────
test.describe('비로그인 회귀', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('AUTH: / 진입 시 200 OK + data-role="hotelier"', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);

    // RoleScope가 data-role을 부여하는 컨테이너 검증
    const scopeDiv = page.locator('[data-role]').first();
    await expect(scopeDiv).toHaveAttribute('data-role', 'hotelier');
  });
});

// ──────────────────────────────────────────────────────────────────
// MANAGER 시나리오
// ──────────────────────────────────────────────────────────────────
test.describe('매니저 시나리오', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.manager });

  test('T-04: /admin/tickets 진입 시 매니저 톤 + 호텔리어 UI 비노출', async ({
    page,
  }) => {
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    // data-role 검증 — (admin) layout 또는 RoleScope가 부여
    const rootScope = page.locator('[data-role]').first();
    const roleAttr = await rootScope.getAttribute('data-role');
    expect(['manager', 'admin']).toContain(roleAttr);

    // 호텔리어 GNB의 "빠른 해결" 링크가 없어야 함 (헤더 자체 비노출)
    await expect(page.locator('header a:has-text("빠른 해결")')).toHaveCount(0);

    // 챗봇 FAB (aria-label="챗봇 열기") 비노출
    await expect(page.locator('button[aria-label="챗봇 열기"]')).toHaveCount(0);

    // AdminNav의 "티켓 큐" 또는 ㅁ스터데이터 등 어드민 메뉴는 노출
    await expect(
      page.getByRole('link', { name: /티켓 큐|서비스 상태/ }).first(),
    ).toBeVisible();
  });

  test('T-06: /admin/users 직접 접근 → 404 (매니저 권한 부족)', async ({
    page,
  }) => {
    await page.goto('/admin/users');
    // Next16 스트리밍 SSR은 notFound()도 HTTP 200을 반환 → not-found UI로 차단 검증
    await expectNotFound(page);
  });

  test('T-07: /profile → "매니저 영역으로 →" 클릭 → /admin/tickets (404 버그 수정 검증)', async ({
    page,
  }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // UserNav의 "매니저 영역으로 →" 링크 클릭
    const link = page
      .getByRole('link', { name: /매니저 영역으로/ })
      .first();
    await expect(link).toBeVisible();
    await link.click();

    // /admin/tickets로 정상 이동 (이전 버그: /admin/users → 404)
    await page.waitForURL('**/admin/tickets', { timeout: 10_000 });
    expect(page.url()).toContain('/admin/tickets');
  });

  // T-08 / T-09 (호텔리어 시점 보기 ON/OFF) 제거 — 시점 보기 기능 폐기 (2026-05-29).
  // admin/manager는 호텔리어 사이트(support.oapms.com)로 가는 사이드바 외부 링크로 대체.
});

// ──────────────────────────────────────────────────────────────────
// HOTELIER 회귀
// ──────────────────────────────────────────────────────────────────
test.describe('호텔리어 회귀', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.hotelier });

  test('R-01: /tickets 진입 시 200 OK + data-role="hotelier"', async ({
    page,
  }) => {
    const res = await page.goto('/tickets');
    expect(res?.status()).toBe(200);
    await page.waitForLoadState('networkidle');

    const rootScope = page.locator('[data-role]').first();
    await expect(rootScope).toHaveAttribute('data-role', 'hotelier');

    // 호텔리어 GNB 정상 노출 (구 '빠른 해결' → '도움말 찾기'로 라벨 변경)
    await expect(
      page.getByRole('link', { name: '도움말 찾기' }).first(),
    ).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────
// ADMIN 회귀
// ──────────────────────────────────────────────────────────────────
test.describe('어드민 회귀', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.admin });

  test('ADMIN: /admin/users 정상 접근 (어드민 권한)', async ({ page }) => {
    const res = await page.goto('/admin/users');
    expect(res?.status()).toBe(200);
  });

  test('ADMIN: /admin/tickets → data-role="admin" (현행 보라 유지)', async ({
    page,
  }) => {
    await page.goto('/admin/tickets');
    await page.waitForLoadState('networkidle');

    const rootScope = page.locator('[data-role]').first();
    const roleAttr = await rootScope.getAttribute('data-role');
    // RoleScope가 'admin'을 부여하거나, /admin layout이 admin/manager 부여
    expect(['admin']).toContain(roleAttr);
  });
});
