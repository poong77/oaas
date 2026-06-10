/**
 * 시안 교체 회귀 E2E (2026-06-10).
 *
 * 이번 작업에서 실제 라우트에 적용한 시안 디자인/동선이 깨지지 않는지 검증한다.
 * 데이터 주도(시드 차이에 강하게): 가능한 한 존재 여부·동선 위주로 단언.
 *
 * 검증:
 *   홈      — "무엇을 도와드릴까요?" + 카테고리 제품별/역할별 탭 전환 + 1:1 문의 CTA
 *   문의    — 1:1 문의 접수 섹션(문제분류/상세 내용/연락 방법) + 상세 유형 칩 비어있지 않음
 *   공지    — 필터 탭 + 행 클릭 시 상세(/notices/[id]) 진입
 *   마이페이지 — 사용자 카드(이메일) + 탭 전환(내 정보/비밀번호/직원 관리) + 직원 ID 컬럼
 *   로그인   — (미인증) "로그인" 카드 + 식별자 입력
 */

import { test, expect } from '@playwright/test';
import { STORAGE_STATE_PATHS, TEST_USERS } from './fixtures/users';

test.use({
  storageState: STORAGE_STATE_PATHS.hotelier,
  viewport: { width: 1440, height: 900 },
});

test.describe('홈 — 시안 B안', () => {
  test('헤드라인·카테고리 탭·문의 CTA', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: '무엇을 도와드릴까요?' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: '카테고리 찾아보기' }),
    ).toBeVisible();

    // 제품별 ↔ 역할별 탭 전환
    await page.getByRole('button', { name: '역할별', exact: true }).click();
    await expect(
      page.getByRole('button', { name: '제품별', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: '제품별', exact: true }).click();

    // 1:1 문의 CTA
    await expect(
      page.getByRole('link', { name: '1:1 문의하기' }),
    ).toBeVisible();
  });
});

test.describe('문의 접수 — 시안대로', () => {
  test('섹션 + 상세 유형 칩이 비어있지 않음', async ({ page }) => {
    await page.goto('/tickets/new');

    await expect(
      page.getByRole('heading', { name: '1:1 문의 접수' }),
    ).toBeVisible();
    for (const label of ['문제분류', '상세 내용', '연락 방법']) {
      await expect(
        page.getByRole('heading', { name: label }),
      ).toBeVisible();
    }

    // 상세 유형 칩: 비어있던 회귀(캐시 빈결과) 방지 — '기타'는 항상 존재.
    await expect(
      page.getByRole('button', { name: '기타', exact: true }).first(),
    ).toBeVisible();

    // 접수 버튼
    await expect(
      page.getByRole('button', { name: '접수하기' }),
    ).toBeVisible();
  });
});

test.describe('공지 — 시안 리스트', () => {
  test('필터 탭 + 행→상세 진입', async ({ page }) => {
    await page.goto('/notices');

    await expect(page.getByRole('heading', { name: '공지사항' })).toBeVisible();
    for (const t of ['전체', '공지사항', '서비스 장애', '릴리즈']) {
      await expect(page.getByRole('link', { name: t, exact: true })).toBeVisible();
    }

    // 행이 있으면 첫 행 클릭 → 상세 URL 진입 (데이터 없으면 skip)
    const firstRow = page.locator('a[href^="/notices/"]').first();
    if (await firstRow.count()) {
      await firstRow.click();
      await expect(page).toHaveURL(/\/notices\/[0-9a-f-]{8,}/);
    }
  });
});

test.describe('마이페이지 — 시안 탭', () => {
  test('사용자 카드 + 탭 전환 + 직원 ID 컬럼', async ({ page }) => {
    await page.goto('/profile');

    await expect(page.getByRole('heading', { name: '마이페이지' })).toBeVisible();
    // 사이드바 사용자 카드 — 이메일 노출 (DOM 순서상 사이드바가 먼저)
    await expect(
      page.getByText(TEST_USERS.hotelier.email).first(),
    ).toBeVisible();

    // 직원 관리 탭 → 직원 목록 + ID 컬럼
    await page.getByRole('button', { name: '직원 관리' }).click();
    await expect(
      page.getByRole('heading', { name: '직원 목록' }),
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'ID', exact: true }),
    ).toBeVisible();

    // 비밀번호 변경 탭
    await page.getByRole('button', { name: '비밀번호 변경' }).click();
    await expect(page.getByText('현재 비밀번호')).toBeVisible();

    // 내 정보 탭 — 로그인 ID 필드
    await page.getByRole('button', { name: '내 정보', exact: true }).click();
    await expect(page.getByText('로그인 ID')).toBeVisible();
  });
});

test.describe('로그인 — 시안 카드 (미인증)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('로그인 카드 + 식별자 입력', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
    await expect(
      page.getByPlaceholder('이메일 주소 또는 아이디'),
    ).toBeVisible();
  });
});
