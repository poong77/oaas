/**
 * 전역 setup — 3종 시드 계정으로 미리 로그인하여 storageState 저장.
 *
 * 각 spec은 storageState 파일을 use 옵션으로 지정하여 빠르게 인증 상태 진입.
 */

import { test as setup } from '@playwright/test';
import { TEST_USERS, STORAGE_STATE_PATHS } from './fixtures/users';
import { loginViaUI } from './helpers/auth';

setup('인증 storage state 준비', async ({ browser }) => {
  for (const key of Object.keys(TEST_USERS) as Array<keyof typeof TEST_USERS>) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginViaUI(page, TEST_USERS[key]);
    await ctx.storageState({ path: STORAGE_STATE_PATHS[key] });
    await ctx.close();
  }
});
