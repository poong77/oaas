/**
 * 마이페이지 개편 스모크 (읽기 전용).
 *
 * 2026-06-11 개편 검증: /profile 서버오류 회귀 방지 + 5탭 렌더.
 * 폼 제출/발송 없이 탐색·렌더만 확인(운영DB 안전).
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS } from './fixtures/users';
import { loginViaUI } from './helpers/auth';

test.describe('마이페이지 개편 스모크', () => {
  test('호텔리어 /profile — 5탭 렌더 + 서버오류 없음', async ({ page }) => {
    const errors: string[] = [];
    page.on('response', (res) => {
      // 로컬 서버에 S3 자격증명이 없어 마스터 아이콘 프록시는 503(환경 잡음) → 제외
      if (res.status() >= 500 && !res.url().includes('/api/files/master-icon')) {
        errors.push(`${res.status()} ${res.url()}`);
      }
    });

    await loginViaUI(page, TEST_USERS.hotelier);
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // 서버 에러 화면(Next 에러 바운더리) 부재 확인
    await expect(page.getByText('A server error occurred')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: '마이페이지' }),
    ).toBeVisible();

    // 5개 탭 버튼
    for (const label of [
      '내 정보',
      '비밀번호 변경',
      '호텔 & 솔루션',
      '직원 목록',
      '변경이력',
    ]) {
      await expect(
        page.getByRole('button', { name: label }),
      ).toBeVisible();
    }

    // 호텔 & 솔루션 탭
    await page.getByRole('button', { name: '호텔 & 솔루션' }).click();
    await expect(
      page.getByRole('heading', { name: '호텔 정보' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: '솔루션 링크' }),
    ).toBeVisible();
    await expect(
      page.getByText('조회 전용입니다', { exact: false }),
    ).toBeVisible();

    // 직원 목록 탭 (한 줄 리스트 헤더)
    await page.getByRole('button', { name: '직원 목록' }).click();
    await expect(
      page.getByRole('columnheader', { name: '이름' }),
    ).toBeVisible();

    // 변경이력 탭
    await page.getByRole('button', { name: '변경이력' }).click();
    await expect(
      page.getByText('데이터 수정 이력', { exact: false }),
    ).toBeVisible();

    expect(errors, `5xx 응답 발생: ${errors.join(', ')}`).toHaveLength(0);
  });

  test('호텔리어 주요 페이지 health', async ({ page }) => {
    await loginViaUI(page, TEST_USERS.hotelier);
    for (const path of ['/', '/tickets', '/profile']) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} 상태`).toBeLessThan(400);
      await expect(page.getByText('A server error occurred')).toHaveCount(0);
    }
  });

  test('매니저 운영 페이지 health (읽기 전용)', async ({ page }) => {
    await loginViaUI(page, TEST_USERS.manager);
    for (const path of [
      '/admin/insights/dashboard',
      '/admin/tickets',
      '/admin/articles',
      '/admin/master',
    ]) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} 상태`).toBeLessThan(400);
      await expect(page.getByText('A server error occurred')).toHaveCount(0);
    }
  });

  test('어드민 조직 페이지 health (읽기 전용)', async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin);
    for (const path of ['/admin/users', '/admin/hotels', '/admin/insights/dashboard']) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} 상태`).toBeLessThan(400);
      await expect(page.getByText('A server error occurred')).toHaveCount(0);
    }
  });
});
