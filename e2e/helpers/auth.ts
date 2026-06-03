/**
 * NextAuth Credentials 로그인 헬퍼.
 *
 * - 로그인 폼(/login)에 email/password 입력 → 제출 → 리다이렉트 대기.
 * - 성공 시 session 쿠키가 브라우저 컨텍스트에 저장됨.
 *
 * 사용:
 *   await loginViaUI(page, TEST_USERS.manager);
 *   await page.context().storageState({ path: 'e2e/.auth/manager.json' });
 */

import type { Page } from '@playwright/test';
import type { TEST_USERS } from '../fixtures/users';

type TestUser = (typeof TEST_USERS)[keyof typeof TEST_USERS];

export async function loginViaUI(page: Page, user: TestUser): Promise<void> {
  // NT-04 홈 팝업 배너가 로그인 페이지 input을 가리는 케이스 회피:
  // 진입 전에 localStorage로 "오늘 하루 안 보기"를 사전 설정
  await page.goto('/');
  await page.evaluate(() => {
    try {
      localStorage.setItem(
        'home-popup-dismissed-today',
        new Date().toDateString(),
      );
    } catch {
      // localStorage 미지원/차단 환경은 무시
    }
  });

  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // 혹시 다른 모달이 가렸으면 닫기 시도 (best effort)
  const overlayClose = page
    .locator(
      'button[aria-label*="닫기"], button[aria-label*="close" i], button:has-text("오늘 하루 안 보기")',
    )
    .first();
  if (await overlayClose.isVisible({ timeout: 500 }).catch(() => false)) {
    await overlayClose.click().catch(() => undefined);
  }

  // /login 페이지의 폼 필드 — "이메일/아이디 로그인" 도입으로 식별자 필드는
  // id="identifier"(type=text). 구버전 email 셀렉터도 폴백으로 유지.
  const emailInput = page
    .locator(
      'input#identifier, input[name="identifier"], input[type="email"], input[name="email"], input[id*="email" i]',
    )
    .first();
  const passwordInput = page
    .locator('input[type="password"], input[name="password"]')
    .first();

  await emailInput.fill(user.email);
  await passwordInput.fill(user.password);

  // 제출 버튼 — type="submit" 또는 "로그인" 텍스트
  const submitButton = page
    .locator(
      'button[type="submit"]:has-text("로그인"), button[type="submit"], button:has-text("로그인")',
    )
    .first();
  await submitButton.click();

  // 로그인 후 / 또는 /admin/tickets로 리다이렉트 — 어쨌든 /login에서 벗어나야 정상
  await page.waitForURL(
    (url) => !url.pathname.startsWith('/login'),
    { timeout: 15_000 },
  );
}
