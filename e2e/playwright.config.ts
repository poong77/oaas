import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 설정 — role-mode-ui Phase 도입 (2026-05-28).
 *
 * - chromium만 사용 (시간 절약, CI에서도 동일)
 * - dev 서버는 사용자가 직접 띄우거나 webServer가 자동 시작
 * - 시드 계정 storage state 기반 인증 (e2e/global.setup.ts)
 *
 * 실행:
 *   npx playwright test --config=e2e/playwright.config.ts
 */
export default defineConfig({
  testDir: './',
  outputDir: './test-results',
  fullyParallel: false, // NextAuth 세션 충돌 방지 — 직렬 실행
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: './playwright-report', open: 'never' }],
  ],

  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },

  projects: [
    // setup: 시드 계정으로 로그인하여 storageState 생성
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  // dev 서버가 이미 실행 중이면 재사용, 아니면 자동 시작.
  // SKIP_WEB_SERVER=1 로 명시적으로 skip 가능 (외부에서 dev 띄운 상황 — port 충돌 회피)
  webServer: process.env.SKIP_WEB_SERVER
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        cwd: '../',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
